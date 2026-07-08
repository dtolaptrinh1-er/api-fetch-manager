import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { _resetConfigForTest } from '../src/config/env.js';

process.env.API_FETCH_MANAGER_STORAGE_MODE = 'memory';
delete process.env.API_FETCH_MANAGER_ADMIN_TOKEN;

describe('Catalogs & Flow presets (inject)', () => {
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

 it('catalogs: thêm & liệt kê theo field, không trùng', async () => {
 await app.inject({ method: 'POST', url: '/api/catalogs', payload: { field: 'service', value: 'github.com' } });
 await app.inject({ method: 'POST', url: '/api/catalogs', payload: { field: 'service', value: 'github.com' } });
 await app.inject({ method: 'POST', url: '/api/catalogs', payload: { field: 'service', value: 'cloudflare.com' } });
 const res = await app.inject({ method: 'GET', url: '/api/catalogs?field=service' });
 expect(res.json().data).toEqual(['github.com', 'cloudflare.com']);
 });

 it('flow-presets: seed 4 mẫu mặc định khi rỗng', async () => {
 const res = await app.inject({ method: 'GET', url: '/api/flow-presets' });
 const presets = res.json().data;
 expect(presets.length).toBeGreaterThanOrEqual(4);
 const names = presets.map((p: any) => p.name);
 expect(names).toContain('GitHub - Tạo repo');
 expect(names).toContain('Cloudflare - Account id');
 expect(presets.every((p: any) => p.isPreset === true)).toBe(true);
 });

 it('credential-keys: trả key duy nhất của owner', async () => {
 const own = await app.inject({ method: 'POST', url: '/api/owners', payload: { email: 'kp@example.com' } });
 const id = own.json().data.id;
 for (const v of ['a', 'b']) {
 await app.inject({ method: 'POST', url: `/api/owners/${id}/credentials`, payload: { key: 'github.token', value: v, service: 'github.com' } });
 }
 await app.inject({ method: 'POST', url: `/api/owners/${id}/credentials`, payload: { key: 'cloudflare.token', value: 'x', service: 'cloudflare.com' } });
 const res = await app.inject({ method: 'GET', url: `/api/owners/${id}/credential-keys` });
 expect(res.json().data.sort()).toEqual(['cloudflare.token', 'github.token']);
 });
});
