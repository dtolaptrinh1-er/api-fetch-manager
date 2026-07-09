import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { _resetConfigForTest, loadConfig } from '../src/config/env.js';

// API-level integration test dùng app.inject() — không cần mở port thật.
// Xoá ADMIN_TOKEN để không dính token từ .env local (nếu không sẽ bị 401).
process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;

describe('API integration (inject)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // reset cache config để build server KHÔNG dính token đã cache/từ .env
    delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;
    process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
    _resetConfigForTest();
    const built = await buildServer();
    app = built.app;
    await app.ready();
  });

  it('GET /api/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('owner + credential: lưu ciphertext, list trả masked (không plaintext)', async () => {
    const own = await app.inject({
      method: 'POST',
      url: '/api/owners',
      payload: { email: 'e2e@example.com' },
    });
    const ownerId = own.json().data.id;

    const plaintext = 'ghp_FAKE_ABCDEFGHIJKLMNOP1234';
    await app.inject({
      method: 'POST',
      url: `/api/owners/${ownerId}/credentials`,
      payload: { key: 'github.token', value: plaintext, service: 'github.com', label: 'main' },
    });

    const list = await app.inject({ method: 'GET', url: `/api/owners/${ownerId}/credentials` });
    const creds = list.json().data;
    expect(creds).toHaveLength(1);
    expect(creds[0].masked).not.toBe(plaintext);
    expect(JSON.stringify(creds)).not.toContain(plaintext);
    expect(creds[0].masked).toContain('****');

    const reveal = await app.inject({
      method: 'POST',
      url: `/api/owners/${ownerId}/credentials/${creds[0].id}/reveal`,
    });
    expect(reveal.json().data.value).toBe(plaintext);
  });

  it('1 key nhiều giá trị', async () => {
    const own = await app.inject({ method: 'POST', url: '/api/owners', payload: { email: 'multi@example.com' } });
    const id = own.json().data.id;
    for (const v of ['v1', 'v2', 'v3']) {
      await app.inject({ method: 'POST', url: `/api/owners/${id}/credentials`, payload: { key: 'dpdns.apikey', value: v, service: 'dpdns' } });
    }
    const list = await app.inject({ method: 'GET', url: `/api/owners/${id}/credentials` });
    expect(list.json().data.filter((c: any) => c.key === 'dpdns.apikey')).toHaveLength(3);
  });

  it('parse-curl → template → có step', async () => {
    const parsed = await app.inject({
      method: 'POST',
      url: '/api/templates/parse-curl',
      payload: { curl: `curl -X POST https://api.github.com/user/repos -H "Authorization: Bearer x" -d '{"name":"demo"}'` },
    });
    expect(parsed.json().data.step.method).toBe('POST');
    expect(parsed.json().data.credentialRefs.length).toBeGreaterThan(0);
  });

  it('fetch/test-step trả response JSON format-ready và không lộ credential đã lưu', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ login: 'octo', tokenEcho: 'seed_token' }),
    })) as any;
    try {
      const own = await app.inject({ method: 'POST', url: '/api/owners', payload: { email: 'test-step@example.com' } });
      const ownerId = own.json().data.id;
      await app.inject({
        method: 'POST',
        url: `/api/owners/${ownerId}/credentials`,
        payload: { key: 'github.token', value: 'seed_token', service: 'github.com' },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/fetch/test-step',
        payload: {
          ownerId,
          stepIndex: 0,
          template: {
            name: 'GitHub - Get user',
            service: 'github.com',
            business: 'get-user',
            credentialRefs: [{ placeholder: 'github.token', key: 'github.token' }],
            steps: [{ id: 'me', method: 'GET', urlTemplate: 'https://api.github.com/user', headers: { Authorization: 'Bearer {{github.token}}' } }],
          },
        },
      });
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.data.steps[0].response.json.login).toBe('octo');
      expect(JSON.stringify(body)).not.toContain('seed_token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('issue CRUD + markdown export', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/issues',
      payload: {
        type: 'bug',
        title: 'Button lưu không phản hồi',
        description: 'Click không có gì xảy ra',
        expectedResult: 'Lưu thành công',
        elements: [{ selector: '#save-btn', outerHTML: '<button>Lưu</button>' }],
      },
    });
    const id = created.json().data.id;
    const md = await app.inject({ method: 'GET', url: `/api/issues/${id}/markdown` });
    expect(md.json().data.markdown).toContain('[BUG]');
    expect(md.json().data.markdown).toContain('#save-btn');
  });

  it('variables CRUD + resolve', async () => {
    await app.inject({ method: 'POST', url: '/api/variables', payload: { scope: 'global', key: 'api.base', value: 'https://x' } });
    const list = await app.inject({ method: 'GET', url: '/api/variables?scope=global' });
    expect(list.json().data['api.base'].value).toBe('https://x');
  });

  it('admin token bảo vệ /api khi được cấu hình, nhưng vẫn mở /api/health', async () => {
    process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
    process.env.API_FETCH_MANAGER_ADMIN_TOKEN = 'test-admin-token';
    _resetConfigForTest();
    const built = await buildServer();
    const secured = built.app;
    await secured.ready();
    try {
      const health = await secured.inject({ method: 'GET', url: '/api/health' });
      expect(health.statusCode).toBe(200);

      const unauth = await secured.inject({ method: 'GET', url: '/api/owners' });
      expect(unauth.statusCode).toBe(401);

      const auth = await secured.inject({ method: 'GET', url: '/api/owners', headers: { authorization: 'Bearer test-admin-token' } });
      expect(auth.statusCode).toBe(200);
      expect(auth.json().ok).toBe(true);
    } finally {
      await secured.close();
      delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;
      process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
      _resetConfigForTest();
    }
  });

  it('file/firebase storage fail-fast nếu thiếu ADMIN_TOKEN', () => {
    process.env.API_FETCH_MANAGER_STORAGE_MODE = 'file';
    delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;
    _resetConfigForTest();
    expect(() => loadConfig()).toThrow(/ADMIN_TOKEN bắt buộc/);
    process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
    _resetConfigForTest();
  });

  it('sandbox-test chặn network', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/engine/sandbox-test', payload: { code: 'fetch("http://evil")' } });
    expect(res.json().data.error).toBeTruthy();
  });

  it('sandbox-test chạy transform hợp lệ', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/engine/sandbox-test', payload: { code: 'return inputs.x.toUpperCase();', inputs: { x: 'hi' } } });
    expect(res.json().data.result).toBe('HI');
  });

  /* ---------- Meta / status bar (addendum v1.4 §4) ---------- */
  it('GET /api/meta trả build/env/storage', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta' });
    expect(res.statusCode).toBe(200);
    const d = res.json().data;
    expect(d.storage).toBe('memory');
    expect(typeof d.buildShaShort).toBe('string');
    expect(typeof d.env).toBe('string');
    expect(typeof d.commitUrl).toBe('string');
  });

  /* ---------- Services & Resources (addendum v1.4 §5) ---------- */
  it('GET /api/services seed danh mục mặc định (>=6)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/services' });
    const list = res.json().data as any[];
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(list.some((s) => s.host === 'github.com')).toBe(true);
    expect(list.some((s) => s.host === 'cron-job.org')).toBe(true);
  });

  it('CRUD resource item theo owner + service', async () => {
    const own = await app.inject({ method: 'POST', url: '/api/owners', payload: { email: 'res@example.com' } });
    const ownerId = own.json().data.id;
    const created = await app.inject({
      method: 'POST',
      url: '/api/resources',
      payload: { ownerId, service: 'github.com', resourceType: 'repo', label: 'demo', data: { html_url: 'https://github.com/x/demo' } },
    });
    expect(created.statusCode).toBe(200);
    const id = created.json().data.id;

    const list = await app.inject({ method: 'GET', url: `/api/resources?ownerId=${ownerId}&service=github.com` });
    expect((list.json().data as any[]).some((r) => r.id === id)).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/api/resources/${id}` });
    expect(del.json().data.deleted).toBe(true);
    const after = await app.inject({ method: 'GET', url: `/api/resources?ownerId=${ownerId}` });
    expect((after.json().data as any[]).some((r) => r.id === id)).toBe(false);
  });

  it('POST /api/resources thiếu field → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/resources', payload: { service: 'github.com' } });
    expect(res.statusCode).toBe(400);
  });

  /* ---------- Fetch → cURL (addendum v1.5) ---------- */
  it('POST /api/fetch/build-curl mask token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/fetch/build-curl',
      payload: { method: 'POST', url: 'https://api.x/y', headers: { Authorization: 'Bearer TOP_SECRET' }, body: '{}', maskValues: ['TOP_SECRET'] },
    });
    const curl = res.json().data.curl as string;
    expect(curl).toContain('-X POST');
    expect(curl).not.toContain('TOP_SECRET');
  });

  /* ---------- Self-Test Mode (addendum v1.5) ---------- */
  it('POST /api/selftest/run trả toàn bộ PASS + GET results', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/selftest/run' });
    expect(res.statusCode).toBe(200);
    const run = res.json().data;
    expect(run.total).toBeGreaterThanOrEqual(8);
    expect(run.failed).toBe(0);

    const results = await app.inject({ method: 'GET', url: '/api/selftest/results' });
    expect(results.json().data.runId).toBe(run.runId);
  });
});

