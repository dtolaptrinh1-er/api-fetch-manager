import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { _resetConfigForTest } from '../src/config/env.js';
import { normalizeCredentialPayload } from '../src/lib/credential-import.js';

process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;

const SAMPLE = {
 email: 'import@example.com',
 isSaveRtdbEmail: 'true',
 userExtras: [
 { key: 'github.token', value: 'ghp_FAKE_TOKEN_0001' },
 { key: 'dpdns.apikey', value: 'dp_live_FAKE_0002' },
 { key: 'meta.count', value: 3 },
 ],
};

describe('normalizeCredentialPayload', () => {
 it('nhận object JSON thuần + map userExtras', () => {
 const n = normalizeCredentialPayload(SAMPLE);
 expect(n.email).toBe('import@example.com');
 expect(n.isSaveRtdbEmail).toBe(true);
 expect(n.items).toHaveLength(3);
 expect(n.items[0]).toMatchObject({ key: 'github.token', value: 'ghp_FAKE_TOKEN_0001' });
 // value không phải string -> JSON.stringify
 expect(n.items[2].value).toBe('3');
 });

 it('nhận chuỗi JSON', () => {
 const n = normalizeCredentialPayload(JSON.stringify(SAMPLE));
 expect(n.items).toHaveLength(3);
 });

 it('nhận chuỗi base64 của JSON', () => {
 const b64 = Buffer.from(JSON.stringify(SAMPLE), 'utf8').toString('base64');
 const n = normalizeCredentialPayload(b64);
 expect(n.email).toBe('import@example.com');
 expect(n.items).toHaveLength(3);
 });

 it('ném lỗi khi payload rác', () => {
 expect(() => normalizeCredentialPayload('@@@ not json @@@')).toThrow();
 });
});

describe('POST /api/credentials/import-json (inject)', () => {
 let app: FastifyInstance;
 beforeAll(async () => {
 _resetConfigForTest();
 const built = await buildServer();
 app = built.app;
 await app.ready();
 });
 afterAll(async () => {
 await app.close();
 });

 it('import base64 → tạo owner theo email + lưu credential mã hoá (list masked)', async () => {
 const b64 = Buffer.from(JSON.stringify(SAMPLE), 'utf8').toString('base64');
 const res = await app.inject({
 method: 'POST',
 url: '/api/credentials/import-json',
 payload: { payload: b64 },
 });
 expect(res.statusCode).toBe(200);
 const data = res.json().data;
 expect(data.credsCreated).toBe(3);
 expect(data.ownerId).toBeTruthy();

 const list = await app.inject({ method: 'GET', url: `/api/owners/${data.ownerId}/credentials` });
 const creds = list.json().data;
 expect(creds).toHaveLength(3);
 // masked, KHÔNG chứa plaintext
 expect(JSON.stringify(creds)).not.toContain('ghp_FAKE_TOKEN_0001');
 // service suy từ prefix key
 const gh = creds.find((c: any) => c.key === 'github.token');
 expect(gh.service).toBe('github');
 });

 it('import lần 2 với ownerId có sẵn → cộng dồn credential', async () => {
 const owner = await app.inject({ method: 'POST', url: '/api/owners', payload: { email: 'reuse@example.com' } });
 const ownerId = owner.json().data.id;
 const res = await app.inject({
 method: 'POST',
 url: '/api/credentials/import-json',
 payload: { ownerId, payload: { userExtras: [{ key: 'x.token', value: 'v1' }] } },
 });
 expect(res.json().data.credsCreated).toBe(1);
 expect(res.json().data.ownerId).toBe(ownerId);
 });

 it('400 khi payload rỗng mục credential', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/api/credentials/import-json',
 payload: { payload: { email: 'x@y.z', userExtras: [] } },
 });
 expect(res.statusCode).toBe(400);
 });
});
