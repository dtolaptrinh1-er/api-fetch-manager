import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { createRtdb } from '../src/db/rtdb.js';
import type { AppConfig } from '../src/config/env.js';

function serviceAccountBase64(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const private_key = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return Buffer.from(JSON.stringify({ client_email: 'afm-test@example.iam.gserviceaccount.com', private_key })).toString('base64');
}

function config(): AppConfig {
  return {
    port: 8080,
    logLevel: 'silent',
    storageMode: 'firebase',
    dataDir: '.data-test',
    encryptionKey: Buffer.alloc(32, 1),
    adminToken: 'admin-token',
    httpTimeoutMs: 15_000,
    httpRetries: 2,
    httpMaxResponseBytes: 1_048_576,
    firebaseServiceAccount: serviceAccountBase64(),
    rtdb: {
      keys: 'https://keys.example.firebaseio.com',
      history: 'https://history.example.firebaseio.com',
      logs: 'https://logs.example.firebaseio.com',
      issues: 'https://issues.example.firebaseio.com',
      variables: 'https://variables.example.firebaseio.com',
    },
  };
}

describe('Firebase RTDB adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ký JWT service account, lấy OAuth token và gọi REST với Bearer token', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, init });
      if (href === 'https://oauth2.googleapis.com/token') {
        const body = init?.body as URLSearchParams;
        const assertion = body.get('assertion') ?? '';
        expect(assertion.split('.')).toHaveLength(3);
        expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
        return new Response(JSON.stringify({ access_token: 'ya29.test-token', expires_in: 3600 }), { status: 200 });
      }
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer ya29.test-token');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const db = createRtdb(config());
    await db.keys.set('owners/o1', { email: 'a@example.com' });
    await db.keys.get('owners/o1');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls[1].url).toBe('https://keys.example.firebaseio.com/owners/o1.json');
    expect(calls[1].init?.method).toBe('PUT');
    expect(calls[2].init?.method).toBe('GET');
  });

  it('map query sang orderBy/equalTo/limitToFirst REST params', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ o1: { email: 'a@example.com' } }), { status: 200 });
    }));

    const db = createRtdb(config());
    const out = await db.keys.query('owners', { orderByChild: 'email', equalTo: 'a@example.com', limit: 2 });

    expect(out.o1.email).toBe('a@example.com');
    const dbCall = (fetch as any).mock.calls.find(([url]: [string]) => String(url).startsWith('https://keys.example'));
    const url = new URL(String(dbCall[0]));
    expect(url.pathname).toBe('/owners.json');
    expect(url.searchParams.get('orderBy')).toBe('"email"');
    expect(url.searchParams.get('equalTo')).toBe('"a@example.com"');
    expect(url.searchParams.get('limitToFirst')).toBe('2');
  });
});
