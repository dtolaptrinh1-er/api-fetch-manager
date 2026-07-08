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
});
