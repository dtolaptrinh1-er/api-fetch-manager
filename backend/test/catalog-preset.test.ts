import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { _resetConfigForTest } from '../src/config/env.js';

process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;

describe('Catalogs + Flow presets + credential-keys', () => {
 let app: FastifyInstance;
 beforeAll(async () => {
 _resetConfigForTest();
 const built = await buildServer();
 app = built.app;
 await app.ready();
 });
 afterAll(async () => { await app.close(); });

 it('catalog: thêm value dùng chung + tránh trùng', async () => {
 await app.inject({ method: 'POST', url: '/api/catalogs', payload: { field: 'service', value: 'github.com' } });
 const dup = await app.inject({ method: 'POST', url: '/api/catalogs', payload: { field: 'service', value: 'github.com' } });
 expect(dup.json().data).toEqual(['github.com']);
 const list = await app.inject({ method: 'GET', url: '/api/catalogs?field=service' });
 expect(list.json().data).toContain('github.com');
 });

 it('flow-preset: lưu + lấy ra dùng', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/api/flow-presets',
 payload: { name: 'Preset A', service: 'github.com', business: 'x', steps: [{ id: 's1', method: 'GET', urlTemplate: 'https://x', headers: {}, extract: [] }] },
 });
 expect(res.statusCode).toBe(200);
 expect(res.json().data.isPreset).toBe(true);
 const list = await app.inject({ method: 'GET', url: '/api/flow-presets' });
 expect(list.json().data.some((p: any) => p.name === 'Preset A')).toBe(true);
 });

 it('credential-keys: trả distinct key không lộ giá trị', async () => {
 const own = await app.inject({ method: 'POST', url: '/api/owners', payload: { email: 'kp@example.com' } });
 const id = own.json().data.id;
 await app.inject({ method: 'POST', url: `/api/owners/${id}/credentials`, payload: { key: 'github.token', value: 'ghp_FAKE_A', service: 'github.com' } });
 await app.inject({ method: 'POST', url: `/api/owners/${id}/credentials`, payload: { key: 'github.token', value: 'ghp_FAKE_B', service: 'github.com' } });
 const res = await app.inject({ method: 'GET', url: `/api/owners/${id}/credential-keys` });
 const data = res.json().data;
 expect(data).toHaveLength(1);
 expect(data[0]).toMatchObject({ key: 'github.token', service: 'github.com' });
 expect(JSON.stringify(data)).not.toContain('ghp_FAKE_A');
 });
});
