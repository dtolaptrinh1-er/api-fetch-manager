/**
 * selftest.ts — Self-Test Mode runner (addendum v1.5).
 *
 * Chạy một loạt kịch bản headless kiểm tra các tính năng cốt lõi END-TO-END
 * trên chính storage/engine đang chạy (KHÔNG gọi mạng ngoài): mã hóa credential,
 * resolve placeholder, transforms, extract JSONPath, sinh curl, sandbox, và CRUD
 * qua store. Mỗi kịch bản gom nhiều assertion + capture giá trị để hiển thị ở UI.
 *
 * Nguyên tắc:
 *  - Không rò rỉ secret: mọi giá trị credential trong output đều đã mask.
 *  - Idempotent: dùng owner tạm có prefix, tự dọn sau khi chạy.
 *  - Không phụ thuộc network: chỉ test logic nội bộ để kết quả ổn định.
 */

import type { AppContext } from '../context.js';
import * as store from './stores.js';
import { genId, now } from '../lib/ids.js';
import { resolveTemplate } from '../engine/placeholder.js';
import { applyTransform, listTransforms } from '../engine/transforms.js';
import { extractJsonPath } from '../engine/extract.js';
import { runSandbox } from '../engine/sandbox.js';
import { buildCurl } from '../lib/curl-builder.js';
import type {
  SelfTestAssertion,
  SelfTestRun,
  SelfTestScenarioResult,
} from '../lib/types.js';

interface ScenarioCtx {
  ctx: AppContext;
  ownerId: string;
}

interface Scenario {
  id: string;
  feature: string;
  title: string;
  /** Element text giả lập để UI hiển thị "đã test đúng chức năng nào". */
  elementText: string;
  run: (c: ScenarioCtx) => Promise<{
    captured: Record<string, unknown>;
    builtCurl?: string;
    assertions: SelfTestAssertion[];
  }>;
}

function assertEq(name: string, expected: unknown, actual: unknown): SelfTestAssertion {
  const pass = JSON.stringify(expected) === JSON.stringify(actual);
  return { name, pass, expected, actual };
}
function assertTrue(name: string, actual: boolean): SelfTestAssertion {
  return { name, pass: actual === true, expected: true, actual };
}

/** Toàn bộ kịch bản self-test — thêm mới ở đây khi có tính năng mới. */
const SCENARIOS: Scenario[] = [
  {
    id: 'crypto-roundtrip',
    feature: 'Credentials',
    title: 'Mã hóa & giải mã credential (AES-256-GCM)',
    elementText: 'Nút "Thêm credential" · trang Credentials',
    run: async ({ ctx, ownerId }) => {
      const secret = 'ghp_SELFTEST_' + genId();
      const cred = await store.addCredential(ctx, ownerId, {
        key: 'selftest.token',
        value: secret,
        service: 'selftest',
      });
      const list = await store.listCredentials(ctx, ownerId);
      const found = list.find((c) => c.id === cred.id)!;
      const decrypted = ctx.tryDecrypt({ valueEnc: found.valueEnc, iv: found.iv });
      const masked = decrypted ? ctx.mask(decrypted) : '';
      return {
        captured: { key: cred.key, masked, storedIsCiphertext: found.valueEnc !== secret },
        assertions: [
          assertTrue('Value lưu là ciphertext (khác plaintext)', found.valueEnc !== secret),
          assertTrue('Giải mã khôi phục đúng plaintext', decrypted === secret),
          assertTrue('mask() che phần lớn ký tự', masked.includes('*') || masked.includes('•')),
        ],
      };
    },
  },
  {
    id: 'placeholder-transforms',
    feature: 'Fetch Builder',
    title: 'Resolve placeholder + transforms (lower/replace)',
    elementText: 'Ô URL/Body có {{...}} · Fetch Builder',
    run: async () => {
      const out = resolveTemplate('{{repoName | lower | replace(" ", "-")}}', { inputs: { repoName: 'My New Repo' } });
      const transforms = listTransforms();
      return {
        captured: { input: 'My New Repo', output: out, transformCount: transforms.length },
        assertions: [
          assertEq('lower+replace ra slug đúng', 'my-new-repo', out),
          assertTrue('Có đăng ký transform lower', transforms.includes('lower')),
          assertTrue('Có đăng ký transform replace', transforms.includes('replace')),
          assertEq('upper transform', 'ABC', applyTransform('upper', 'abc', [])),
        ],
      };
    },
  },
  {
    id: 'extract-jsonpath',
    feature: 'Extracted Data',
    title: 'Trích xuất giá trị bằng JSONPath',
    elementText: 'Cột "Value" · trang Extracted Data',
    run: async () => {
      const body = { html_url: 'https://github.com/acme/demo', result: [{ id: 'acc_123' }] };
      const repoUrl = extractJsonPath(body as any, '$.html_url');
      const accId = extractJsonPath(body as any, '$.result[0].id');
      return {
        captured: { repoUrl, accId },
        assertions: [
          assertEq('$.html_url', 'https://github.com/acme/demo', repoUrl),
          assertEq('$.result[0].id', 'acc_123', accId),
        ],
      };
    },
  },
  {
    id: 'curl-build',
    feature: 'Fetch Builder',
    title: 'Sinh lệnh curl từ step (credential đã mask)',
    elementText: 'Nút "Copy cURL" · Fetch Builder',
    run: async ({ ctx, ownerId }) => {
      await store.addCredential(ctx, ownerId, { key: 'github.token', value: 'ghp_SELFTEST_SECRET', service: 'github.com' });
      const curl = buildCurl({
        method: 'POST',
        url: 'https://api.github.com/user/repos',
        headers: { Authorization: 'Bearer ghp_SELFTEST_SECRET', 'Content-Type': 'application/json' },
        body: '{"name":"demo"}',
      }, { maskValues: ['ghp_SELFTEST_SECRET'] });
      return {
        captured: { hasPost: curl.includes('-X POST'), masked: !curl.includes('ghp_SELFTEST_SECRET') },
        builtCurl: curl,
        assertions: [
          assertTrue('curl chứa method POST', curl.includes('-X POST')),
          assertTrue('curl chứa URL', curl.includes('api.github.com/user/repos')),
          assertTrue('curl KHÔNG lộ token thô (đã mask)', !curl.includes('ghp_SELFTEST_SECRET')),
        ],
      };
    },
  },
  {
    id: 'sandbox',
    feature: 'Fetch Builder',
    title: 'Sandbox transform an toàn (không truy cập process)',
    elementText: 'Ô "Custom transform (JS)" · Fetch Builder',
    run: async () => {
      const okResult = runSandbox('return inputs.a + inputs.b', { inputs: { a: 2, b: 3 } });
      let blocked = false;
      try {
        runSandbox('return process.env', {});
      } catch {
        blocked = true;
      }
      return {
        captured: { okResult, blockedProcessAccess: blocked },
        assertions: [
          assertEq('Tính toán trong sandbox', '5', String(okResult)),
          assertTrue('Chặn truy cập process.env', blocked),
        ],
      };
    },
  },
  {
    id: 'variables-crud',
    feature: 'Variables',
    title: 'Lưu / đọc / xóa biến (owner scope ghi đè global)',
    elementText: 'Nút "Biến mới" · trang Variables',
    run: async ({ ctx, ownerId }) => {
      await store.setVariable(ctx, 'global', 'selftest.k', 'global-val', 'manual');
      await store.setVariable(ctx, ownerId, 'selftest.k', 'owner-val', 'manual');
      const resolved = await store.resolveVars(ctx, ownerId);
      await store.removeVariable(ctx, ownerId, 'selftest.k');
      await store.removeVariable(ctx, 'global', 'selftest.k');
      const afterDelete = await store.resolveVars(ctx, ownerId);
      return {
        captured: { resolved: resolved['selftest.k'], afterDelete: afterDelete['selftest.k'] ?? null },
        assertions: [
          assertEq('Owner scope ghi đè global', 'owner-val', resolved['selftest.k']),
          assertTrue('Xóa biến thành công', afterDelete['selftest.k'] === undefined),
        ],
      };
    },
  },
  {
    id: 'issues-crud',
    feature: 'Issues',
    title: 'Tạo issue + xuất Markdown',
    elementText: 'Nút "Tạo issue" · trang Issues',
    run: async ({ ctx }) => {
      const issue = await store.createIssue(ctx, {
        type: 'bug',
        title: 'SelfTest issue ' + genId(),
        description: 'auto',
        elements: [{ selector: '#x', outerHTML: '<button>x</button>', text: 'x' }],
        status: 'open',
      });
      const { issueToMarkdown } = await import('../lib/markdown.js');
      const md = issueToMarkdown(issue as any);
      await store.removeIssue(ctx, issue.id);
      return {
        captured: { id: issue.id, mdHasTitle: md.includes(issue.title) },
        assertions: [
          assertTrue('Issue được tạo có id', Boolean(issue.id)),
          assertTrue('Markdown chứa tiêu đề', md.includes(issue.title)),
          assertTrue('Markdown liệt kê element', md.includes('#x')),
        ],
      };
    },
  },
  {
    id: 'resources-crud',
    feature: 'Services & Resources',
    title: 'CRUD resource item theo service + owner',
    elementText: 'Nút "Thêm resource" · trang Services & Resources',
    run: async ({ ctx, ownerId }) => {
      const item = await store.saveResource(ctx, {
        ownerId,
        service: 'github.com',
        resourceType: 'repo',
        label: 'selftest-repo',
        data: { html_url: 'https://github.com/acme/selftest' },
      });
      const list = await store.listResources(ctx, { ownerId, service: 'github.com' });
      await store.removeResource(ctx, item.id);
      const after = await store.listResources(ctx, { ownerId, service: 'github.com' });
      return {
        captured: { created: item.label, listedCount: list.length, afterCount: after.length },
        assertions: [
          assertTrue('Resource được tạo', Boolean(item.id)),
          assertTrue('List chứa resource vừa tạo', list.some((r) => r.id === item.id)),
          assertTrue('Xóa resource thành công', !after.some((r) => r.id === item.id)),
        ],
      };
    },
  },
];

/** Chạy toàn bộ self-test, trả kết quả và lưu vào store logs (audit). */
export async function runSelfTest(ctx: AppContext): Promise<SelfTestRun> {
  const runId = genId();
  const startedAt = now();
  // Owner tạm để cách ly dữ liệu test.
  const owner = await store.createOwner(ctx, `selftest+${runId}@local`, false);
  const scenarios: SelfTestScenarioResult[] = [];

  for (const sc of SCENARIOS) {
    try {
      const r = await sc.run({ ctx, ownerId: owner.id });
      const result: 'pass' | 'fail' = r.assertions.every((a) => a.pass) ? 'pass' : 'fail';
      scenarios.push({
        scenarioId: sc.id,
        feature: sc.feature,
        title: sc.title,
        elementText: sc.elementText,
        captured: r.captured,
        builtCurl: r.builtCurl,
        assertions: r.assertions,
        result,
      });
    } catch (e: any) {
      scenarios.push({
        scenarioId: sc.id,
        feature: sc.feature,
        title: sc.title,
        elementText: sc.elementText,
        captured: {},
        assertions: [{ name: 'Chạy kịch bản không lỗi', pass: false, expected: 'no-error', actual: e?.message ?? String(e) }],
        result: 'fail',
      });
    }
  }

  // Dọn owner tạm + credentials của nó.
  try {
    const creds = await store.listCredentials(ctx, owner.id);
    for (const c of creds) await store.removeCredential(ctx, owner.id, c.id);
    await ctx.db.keys.remove(`owners/${owner.id}`);
    await store.removeVariable(ctx, owner.id, 'selftest.k').catch(() => {});
  } catch { /* best-effort cleanup */ }

  const finishedAt = now();
  const passed = scenarios.filter((s) => s.result === 'pass').length;
  const failed = scenarios.length - passed;
  const run: SelfTestRun = {
    runId,
    scope: 'backend',
    startedAt,
    finishedAt,
    total: scenarios.length,
    passed,
    failed,
    scenarios,
  };

  await store.addLog(ctx, {
    level: failed > 0 ? 'warn' : 'info',
    scope: 'selftest',
    service: 'selftest',
    business: 'run',
    message: `Self-test: ${passed}/${scenarios.length} pass`,
    detail: { runId, passed, failed },
    createdAt: finishedAt,
  });

  return run;
}

/** Kết quả gần nhất (in-memory, đủ cho phiên chạy). */
let lastRun: SelfTestRun | null = null;
export function setLastRun(r: SelfTestRun): void {
  lastRun = r;
}
export function getLastRun(): SelfTestRun | null {
  return lastRun;
}
