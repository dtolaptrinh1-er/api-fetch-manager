import { describe, it, expect, beforeAll } from 'vitest';
import { createContext, type AppContext } from '../src/context.js';
import { _resetConfigForTest } from '../src/config/env.js';
import { runSelfTest } from '../src/modules/selftest.js';
import { buildCurl } from '../src/lib/curl-builder.js';
import * as store from '../src/modules/stores.js';

process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;

describe('Self-Test runner', () => {
  let ctx: AppContext;
  beforeAll(() => {
    _resetConfigForTest();
    process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
    delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;
    ctx = createContext();
  });

  it('chạy toàn bộ kịch bản và tất cả PASS', async () => {
    const run = await runSelfTest(ctx);
    expect(run.total).toBeGreaterThanOrEqual(8);
    // In chi tiết kịch bản fail (nếu có) để dễ debug.
    const failed = run.scenarios.filter((s) => s.result === 'fail');
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('Self-test FAIL:', JSON.stringify(failed, null, 2));
    }
    expect(run.failed).toBe(0);
    expect(run.passed).toBe(run.total);
  });

  it('dọn owner tạm sau khi chạy (không rác dữ liệu)', async () => {
    const before = (await store.listOwners(ctx)).length;
    await runSelfTest(ctx);
    const after = (await store.listOwners(ctx)).length;
    expect(after).toBe(before);
  });
});

describe('buildCurl', () => {
  it('sinh curl POST có header + body', () => {
    const curl = buildCurl({
      method: 'POST',
      url: 'https://api.github.com/user/repos',
      headers: { Authorization: 'Bearer abc', 'Content-Type': 'application/json' },
      body: '{"name":"demo"}',
    });
    expect(curl).toContain('-X POST');
    expect(curl).toContain('api.github.com/user/repos');
    expect(curl).toContain('-H');
    expect(curl).toContain('--data');
  });

  it('mask giá trị nhạy cảm, không lộ token', () => {
    const curl = buildCurl(
      { method: 'GET', url: 'https://x', headers: { Authorization: 'Bearer SECRET_TOKEN' } },
      { maskValues: ['SECRET_TOKEN'] },
    );
    expect(curl).not.toContain('SECRET_TOKEN');
    expect(curl).toContain('***REDACTED***');
  });

  it('GET không thêm -X và bỏ body', () => {
    const curl = buildCurl({ method: 'GET', url: 'https://x', body: 'ignored' });
    expect(curl).not.toContain('-X');
    expect(curl).not.toContain('--data');
  });
});
