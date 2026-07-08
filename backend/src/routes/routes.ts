/**
 * routes.ts — Đăng ký toàn bộ REST API (prefix /api). Response chuẩn { ok, data?, error? }.
 * Map [SYS] 4 + 10.4/10.5.
 */
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { ok, err, type CredentialMasked } from '../lib/types.js';
import * as store from '../modules/stores.js';
import { parseCurl } from '../modules/parse-curl.js';
import { executeFlow } from '../engine/executor.js';
import { issueToMarkdown } from '../lib/markdown.js';
import { resolveTemplate } from '../engine/placeholder.js';
import { listTransforms } from '../engine/transforms.js';
import { runSandbox } from '../engine/sandbox.js';
import { normalizeCredentialPayload } from '../lib/credential-import.js';
import { now } from '../lib/ids.js';

export function registerRoutes(app: FastifyInstance, ctx: AppContext): void {
 // AuthN/AuthZ tối thiểu: nếu ADMIN_TOKEN được cấu hình, mọi endpoint /api
 // (trừ health) phải gửi Authorization: Bearer.
 app.addHook('preHandler', async (req, reply) => {
 if (!req.url.startsWith('/api') || req.url === '/api/health') return;
 const token = ctx.config.adminToken;
 if (!token) return;
 const auth = req.headers.authorization ?? '';
 if (auth !== `Bearer ${token}`) return reply.code(401).send(err('Unauthorized'));
 });

 // Health
 app.get('/api/health', async () => ok({ status: 'up', storage: ctx.config.storageMode }));

 /* ---------- Owners & Credentials ([SYS] 4.1) ---------- */
 app.get('/api/owners', async () => ok(await store.listOwners(ctx)));

 app.post('/api/owners', async (req, reply) => {
 const b = req.body as { email?: string; isSaveRtdbEmail?: boolean };
 if (!b?.email) return reply.code(400).send(err('email là bắt buộc'));
 return ok(await store.createOwner(ctx, b.email, b.isSaveRtdbEmail ?? true));
 });

 app.get('/api/owners/:id/credentials', async (req) => {
 const { id } = req.params as { id: string };
 const creds = await store.listCredentials(ctx, id);
 const masked: CredentialMasked[] = creds.map((c) => {
 const plain = ctx.tryDecrypt({ valueEnc: c.valueEnc, iv: c.iv });
 return {
 id: c.id,
 key: c.key,
 service: c.service,
 label: c.label,
 masked: plain === null ? '\u26a0 khong giai ma duoc (sai khoa?)' : ctx.mask(plain),
 createdAt: c.createdAt,
 };
 });
 return ok(masked);
 });

 /** Danh sách key duy nhất của owner (cho KeyPicker chèn placeholder). */
 app.get('/api/owners/:id/credential-keys', async (req) => {
 const { id } = req.params as { id: string };
 return ok(await store.listCredentialKeys(ctx, id));
 });

 app.post('/api/owners/:id/credentials', async (req, reply) => {
 const { id } = req.params as { id: string };
 const b = req.body as { key?: string; value?: string; service?: string; label?: string };
 if (!b?.key || b.value === undefined || !b.service)
 return reply.code(400).send(err('key, value, service là bắt buộc'));
 const cred = await store.addCredential(ctx, id, { key: b.key, value: b.value, service: b.service, label: b.label });
 return ok({ id: cred.id, key: cred.key, service: cred.service, label: cred.label, createdAt: cred.createdAt });
 });

 app.put('/api/owners/:id/credentials/:credId', async (req) => {
 const { id, credId } = req.params as { id: string; credId: string };
 await store.updateCredential(ctx, id, credId, req.body as any);
 return ok({ updated: true });
 });

 app.delete('/api/owners/:id/credentials/:credId', async (req) => {
 const { id, credId } = req.params as { id: string; credId: string };
 await store.removeCredential(ctx, id, credId);
 return ok({ deleted: true });
 });

 /** Lộ giá trị thật (đã qua confirm ở FE) — trả plaintext CHỦ ĐÍCH cho 1 credential. */
 app.post('/api/owners/:id/credentials/:credId/reveal', async (req, reply) => {
 const { id, credId } = req.params as { id: string; credId: string };
 await store.addLog(ctx, {
 level: 'warn', service: 'security', business: 'credential-reveal',
 message: 'Credential plaintext reveal requested', scope: 'api',
 detail: { ownerId: id, credId, ip: req.ip }, createdAt: now(),
 });
 const creds = await store.listCredentials(ctx, id);
 const c = creds.find((x) => x.id === credId);
 if (!c) return reply.code(404).send(err('Không tìm thấy credential'));
 const val = ctx.tryDecrypt({ valueEnc: c.valueEnc, iv: c.iv });
 if (val === null) return reply.code(409).send(err('Không giải mã được credential (sai ENCRYPTION_KEY?).'));
 return ok({ value: val });
 });

 /** Nhập credential từ ngoài ([REQ] 2.1): body { payload, ownerId? }. */
 app.post('/api/credentials/import-json', async (req, reply) => {
 const b = req.body as { payload?: unknown; ownerId?: string };
 if (b?.payload === undefined) return reply.code(400).send(err('payload (JSON hoặc base64) là bắt buộc'));
 let normalized;
 try {
 normalized = normalizeCredentialPayload(b.payload);
 } catch (e: any) {
 return reply.code(400).send(err(e?.message ?? 'payload không hợp lệ'));
 }
 if (normalized.items.length === 0) {
 return reply.code(400).send(err('Không tìm thấy mục credential nào (userExtras/items/credentials rỗng).'));
 }
 let ownerId = b.ownerId;
 if (!ownerId) {
 if (!normalized.email) return reply.code(400).send(err('Thiếu ownerId và payload không có email để tạo owner.'));
 const existing = (await store.listOwners(ctx)).find((o) => o.email === normalized.email);
 ownerId = existing ? existing.id : (await store.createOwner(ctx, normalized.email, normalized.isSaveRtdbEmail ?? true)).id;
 }
 const credsCreated = await store.addCredentialsBulk(ctx, ownerId, normalized.items);
 return ok({ ownerId, credsCreated });
 });

 /* ---------- Catalogs (danh mục dùng chung — addendum v1.2 §3) ---------- */
 app.get('/api/catalogs', async (req) => {
 const q = req.query as { field?: string };
 if (!q.field) return ok([]);
 return ok(await store.listCatalog(ctx, q.field));
 });
 app.post('/api/catalogs', async (req, reply) => {
 const b = req.body as { field?: string; value?: string };
 if (!b?.field || !b?.value) return reply.code(400).send(err('field & value là bắt buộc'));
 return ok(await store.addCatalog(ctx, b.field, b.value));
 });

 /* ---------- Flow presets (lưu DB, addendum v1.2 §8) ---------- */
 app.get('/api/flow-presets', async () => {
 await store.ensureDefaultPresets(ctx);
 return ok(await store.listFlowPresets(ctx));
 });
 app.post('/api/flow-presets', async (req, reply) => {
 const b = req.body as any;
 if (!b?.name || !Array.isArray(b?.steps)) return reply.code(400).send(err('name & steps[] là bắt buộc'));
 return ok(await store.saveFlowPreset(ctx, {
 name: b.name, service: b.service ?? '', business: b.business ?? '',
 stopOnError: b.stopOnError, inputs: b.inputs, credentialRefs: b.credentialRefs, steps: b.steps,
 }));
 });

 /* ---------- Import / Export ([SYS] 4.1) ---------- */
 app.get('/api/export', async (req) => {
 await store.addLog(ctx, {
 level: 'warn', service: 'security', business: 'credential-export',
 message: 'Plaintext credential export requested', scope: 'api',
 detail: { ip: req.ip }, createdAt: now(),
 });
 const owners = await store.listOwners(ctx);
 const data: any = { owners: {}, credentials: {}, templates: await store.listTemplates(ctx) };
 for (const o of owners) {
 data.owners[o.id] = o;
 const creds = await store.listCredentials(ctx, o.id);
 data.credentials[o.id] = creds.map((c) => ({
 key: c.key, value: ctx.tryDecrypt({ valueEnc: c.valueEnc, iv: c.iv }) ?? '', service: c.service, label: c.label,
 }));
 }
 return ok(data);
 });

 app.post('/api/import', async (req) => {
 const b = req.body as any;
 let ownersCreated = 0;
 let credsCreated = 0;
 for (const [oldOwnerId, o] of Object.entries<any>(b?.owners ?? {})) {
 const owner = await store.createOwner(ctx, o.email, o.isSaveRtdbEmail ?? true);
 ownersCreated++;
 const creds = b.credentials?.[oldOwnerId] ?? [];
 for (const c of creds) {
 await store.addCredential(ctx, owner.id, c);
 credsCreated++;
 }
 }
 return ok({ ownersCreated, credsCreated });
 });

 /* ---------- Templates / Fetch Builder ([SYS] 4.3, 5) ---------- */
 app.post('/api/templates/parse-curl', async (req, reply) => {
 const b = req.body as { curl?: string };
 if (!b?.curl) return reply.code(400).send(err('curl là bắt buộc'));
 return ok(parseCurl(b.curl));
 });

 app.get('/api/templates', async () => ok(await store.listTemplates(ctx)));
 app.get('/api/templates/:id', async (req, reply) => {
 const { id } = req.params as { id: string };
 const t = await store.getTemplate(ctx, id);
 return t ? ok(t) : reply.code(404).send(err('Không tìm thấy template'));
 });
 app.post('/api/templates', async (req, reply) => {
 const b = req.body as any;
 if (!b?.name || !Array.isArray(b?.steps)) return reply.code(400).send(err('name & steps[] là bắt buộc'));
 return ok(await store.saveTemplate(ctx, b));
 });
 app.put('/api/templates/:id', async (req) => {
 const { id } = req.params as { id: string };
 await store.updateTemplate(ctx, id, req.body as any);
 return ok({ updated: true });
 });
 app.delete('/api/templates/:id', async (req) => {
 const { id } = req.params as { id: string };
 await store.removeTemplate(ctx, id);
 return ok({ deleted: true });
 });

 /* ---------- Fetch Execute ([SYS] 4.2, 10.1) ---------- */
 app.post('/api/fetch/execute', async (req, reply) => {
 const b = req.body as { ownerId?: string; templateId?: string; params?: Record<string, unknown> };
 if (!b?.ownerId || !b?.templateId) return reply.code(400).send(err('ownerId & templateId là bắt buộc'));
 const tpl = await store.getTemplate(ctx, b.templateId);
 if (!tpl) return reply.code(404).send(err('Không tìm thấy template'));
 const result = await executeFlow(ctx, { ownerId: b.ownerId, template: tpl, runtimeInputs: b.params });
 return ok(result);
 });

 /* ---------- History & Logs ([SYS] 4.4) ---------- */
 app.get('/api/history', async (req, reply) => {
 const q = req.query as { ownerId?: string; service?: string; success?: string };
 if (!q.ownerId) return reply.code(400).send(err('ownerId là bắt buộc'));
 const filter: any = {};
 if (q.service) filter.service = q.service;
 if (q.success !== undefined) filter.success = q.success === 'true';
 return ok(await store.listHistory(ctx, q.ownerId, filter));
 });
 app.get('/api/logs', async (req) => {
 const q = req.query as { service?: string; business?: string; level?: string };
 return ok(await store.listLogs(ctx, q));
 });

 /* ---------- Issues ([SYS] 4.5) ---------- */
 app.get('/api/issues', async (req) => {
 const q = req.query as { type?: string; status?: string };
 return ok(await store.listIssues(ctx, q));
 });
 app.post('/api/issues', async (req, reply) => {
 const b = req.body as any;
 if (!b?.title || !b?.type) return reply.code(400).send(err('title & type là bắt buộc'));
 return ok(
 await store.createIssue(ctx, {
 type: b.type, title: b.title, description: b.description,
 expectedResult: b.expectedResult, elements: b.elements ?? [], status: b.status ?? 'open',
 }),
 );
 });
 app.put('/api/issues/:id', async (req) => {
 const { id } = req.params as { id: string };
 await store.updateIssue(ctx, id, req.body as any);
 return ok({ updated: true });
 });
 app.delete('/api/issues/:id', async (req) => {
 const { id } = req.params as { id: string };
 await store.removeIssue(ctx, id);
 return ok({ deleted: true });
 });
 app.get('/api/issues/:id/markdown', async (req, reply) => {
 const { id } = req.params as { id: string };
 const issue = await store.getIssue(ctx, id);
 if (!issue) return reply.code(404).send(err('Không tìm thấy issue'));
 return ok({ markdown: issueToMarkdown(issue) });
 });

 /* ---------- Variables ([SYS] 10.4) ---------- */
 app.get('/api/variables', async (req) => {
 const q = req.query as { scope?: string };
 const scope = q.scope ?? 'global';
 return ok(await store.listVariables(ctx, scope));
 });
 app.post('/api/variables', async (req, reply) => {
 const b = req.body as { scope?: string; key?: string; value?: unknown; source?: 'manual' | 'extracted' };
 if (!b?.key) return reply.code(400).send(err('key là bắt buộc'));
 await store.setVariable(ctx, b.scope ?? 'global', b.key, b.value, b.source ?? 'manual');
 return ok({ saved: true });
 });
 app.put('/api/variables', async (req, reply) => {
 const b = req.body as { scope?: string; key?: string; value?: unknown };
 if (!b?.key) return reply.code(400).send(err('key là bắt buộc'));
 await store.setVariable(ctx, b.scope ?? 'global', b.key, b.value, 'manual');
 return ok({ updated: true });
 });
 app.delete('/api/variables', async (req, reply) => {
 const q = req.query as { scope?: string; key?: string };
 if (!q?.key) return reply.code(400).send(err('key là bắt buộc'));
 await store.removeVariable(ctx, q.scope ?? 'global', q.key);
 return ok({ deleted: true });
 });

 /* ---------- Extracted Data ([SYS] 10.5) ---------- */
 app.get('/api/extractions', async (req) => {
 const q = req.query as { ownerId?: string; service?: string };
 return ok(await store.listExtractions(ctx, q));
 });

 /* ---------- Placeholder Engine helpers ---------- */
 app.get('/api/engine/transforms', async () => ok(listTransforms()));
 app.post('/api/engine/resolve', async (req) => {
 const b = req.body as { template?: string; scope?: any };
 return ok({ result: resolveTemplate(b?.template ?? '', b?.scope ?? {}) });
 });
 app.post('/api/engine/sandbox-test', async (req, reply) => {
 const b = req.body as { code?: string; ctx?: any; inputs?: any; vars?: any };
 if (!b?.code) return reply.code(400).send(err('code là bắt buộc'));
 try {
 const result = runSandbox(b.code, { ctx: b.ctx, inputs: b.inputs, vars: b.vars });
 return ok({ result });
 } catch (e: any) {
 return ok({ error: e?.message ?? String(e) });
 }
 });
}
