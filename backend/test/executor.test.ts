import { describe, it, expect, beforeEach } from 'vitest';
import { createContext, type AppContext } from '../src/context.js';
import { executeFlow } from '../src/engine/executor.js';
import * as store from '../src/modules/stores.js';
import type { FetchTemplate } from '../src/lib/types.js';

// Storage memory mặc định, key tạm được sinh trong config.
process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';

function mockFetch(routes: Record<string, { status: number; body: any }>): typeof fetch {
  return (async (url: string) => {
    const r = routes[url] ?? { status: 404, body: { error: 'not found' } };
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => JSON.stringify(r.body),
    } as any;
  }) as any;
}

describe('executeFlow — sequential 2-step', () => {
  let ctx: AppContext;
  let ownerId: string;

  beforeEach(async () => {
    ctx = createContext();
    const owner = await store.createOwner(ctx, 'test@example.com');
    ownerId = owner.id;
    await store.addCredential(ctx, ownerId, { key: 'org.token', value: 'seed_token', service: 'example.com' });
  });

  it('step 2 dùng output step 1 qua {{ctx.auth.accessToken}} + pinToVar', async () => {
    const tpl: FetchTemplate = {
      id: 'flow1',
      name: 'Auth rồi tạo repo',
      service: 'github.com',
      business: 'create-repo',
      stopOnError: true,
      inputs: [
        { name: 'repoName', required: true, source: 'runtime' },
        { name: 'orgToken', source: 'store', varKey: 'orgToken' },
      ],
      credentialRefs: [{ placeholder: 'org.token', key: 'org.token' }],
      steps: [
        {
          id: 'auth',
          method: 'POST',
          urlTemplate: 'https://api.example.com/oauth/token',
          headers: { Authorization: 'Bearer {{org.token}}' },
          bodyTemplate: '{}',
          extract: [{ field: 'accessToken', jsonPath: '$.access_token' }],
        },
        {
          id: 'createRepo',
          method: 'POST',
          urlTemplate: 'https://api.github.com/user/repos',
          headers: { Authorization: 'Bearer {{ctx.auth.accessToken}}' },
          bodyTemplate: '{"name":"{{repoName | lower}}"}',
          extract: [{ field: 'repoUrl', jsonPath: '$.html_url', pinToVar: 'github.lastRepoUrl' }],
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    const fetchImpl = mockFetch({
      'https://api.example.com/oauth/token': { status: 200, body: { access_token: 'AT_123' } },
      'https://api.github.com/user/repos': { status: 201, body: { html_url: 'https://github.com/u/demo' } },
    });

    const res = await executeFlow(ctx, { ownerId, template: tpl, runtimeInputs: { repoName: 'My Demo' } }, fetchImpl);

    expect(res.ok).toBe(true);
    expect(res.steps).toHaveLength(2);
    expect(res.steps[0].extracted?.accessToken).toBe('AT_123');
    expect(res.steps[1].extracted?.repoUrl).toBe('https://github.com/u/demo');

    // pinToVar ghi vào rtdb-variables (owner scope)
    const vars = await store.listVariables(ctx, ownerId);
    expect(vars['github.lastRepoUrl'].value).toBe('https://github.com/u/demo');
    expect(vars['github.lastRepoUrl'].source).toBe('extracted');

    // history có 2 entry
    const hist = await store.listHistory(ctx, ownerId);
    expect(hist).toHaveLength(2);

    // extraction record được lưu
    const ex = await store.listExtractions(ctx, { ownerId });
    expect(ex.length).toBeGreaterThanOrEqual(2);
  });



  it('retry HTTP 5xx rồi thành công theo policy', async () => {
    const tpl: FetchTemplate = {
      id: 'flow-retry',
      name: 'retry',
      service: 'example.com',
      business: 'retry',
      stopOnError: true,
      steps: [{ id: 's1', method: 'GET', urlTemplate: 'https://api.example.com/flaky' }],
      createdAt: 0,
      updatedAt: 0,
    };
    ctx.config.httpRetries = 1;
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      const status = calls === 1 ? 503 : 200;
      return {
        ok: status === 200,
        status,
        headers: new Headers(),
        text: async () => JSON.stringify({ ok: true, calls }),
      } as any;
    }) as typeof fetch;

    const res = await executeFlow(ctx, { ownerId, template: tpl }, fetchImpl);

    expect(res.ok).toBe(true);
    expect(calls).toBe(2);
    expect(res.steps[0].status).toBe(200);
  });

  it('timeout HTTP được ghi thành lỗi step', async () => {
    const tpl: FetchTemplate = {
      id: 'flow-timeout',
      name: 'timeout',
      service: 'example.com',
      business: 'timeout',
      stopOnError: true,
      steps: [{ id: 's1', method: 'GET', urlTemplate: 'https://api.example.com/slow' }],
      createdAt: 0,
      updatedAt: 0,
    };
    ctx.config.httpRetries = 0;
    ctx.config.httpTimeoutMs = 5;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
      throw new Error('unreachable');
    }) as typeof fetch;

    const res = await executeFlow(ctx, { ownerId, template: tpl }, fetchImpl);

    expect(res.ok).toBe(false);
    expect(res.steps[0].error).toContain('timeout');
  });

  it('stopOnError: step lỗi → dừng + ghi log, không log plaintext token', async () => {
    const tpl: FetchTemplate = {
      id: 'flow2',
      name: 'fail',
      service: 'github.com',
      business: 'create-repo',
      stopOnError: true,
      credentialRefs: [{ placeholder: 'org.token', key: 'org.token' }],
      steps: [
        {
          id: 's1',
          method: 'POST',
          urlTemplate: 'https://api.example.com/fail',
          headers: { Authorization: 'Bearer {{org.token}}' },
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const fetchImpl = mockFetch({ 'https://api.example.com/fail': { status: 401, body: { error: 'unauthorized' } } });
    const res = await executeFlow(ctx, { ownerId, template: tpl }, fetchImpl);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/dừng/);

    const logs = await store.listLogs(ctx, { level: 'error' });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // token bị che, không lộ plaintext 'seed_token'
    const logStr = JSON.stringify(logs);
    expect(logStr).not.toContain('seed_token');
  });
});
