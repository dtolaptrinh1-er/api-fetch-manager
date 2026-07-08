/**
 * stores.ts — Repository layer trên RTDB adapter.
 * Mỗi hàm thao tác đúng 1 DB, trả dữ liệu domain. Business logic gọi qua đây.
 */

import type { AppContext } from '../context.js';
import { now } from '../lib/ids.js';
import type {
 Owner,
 Credential,
 FetchTemplate,
 HistoryEntry,
 LogEntry,
 Issue,
 Variable,
 ExtractionRecord,
} from '../lib/types.js';

/* ---------------- Owners & Credentials (rtdb-keys) ---------------- */

export async function listOwners(ctx: AppContext): Promise<Owner[]> {
 const map = await ctx.db.keys.query<Owner>('owners');
 return Object.entries(map).map(([id, o]) => ({ ...o, id }));
}

export async function createOwner(ctx: AppContext, email: string, isSaveRtdbEmail = true): Promise<Owner> {
 const id = await ctx.db.keys.push('owners', {
 email,
 isSaveRtdbEmail,
 createdAt: now(),
 updatedAt: now(),
 });
 const created = (await ctx.db.keys.get<Owner>(`owners/${id}`))!;
 return { ...created, id };
}

export async function getOwner(ctx: AppContext, id: string): Promise<Owner | null> {
 const o = await ctx.db.keys.get<Owner>(`owners/${id}`);
 return o ? { ...o, id } : null;
}

export async function listCredentials(ctx: AppContext, ownerId: string): Promise<Credential[]> {
 const map = await ctx.db.keys.query<Credential>(`credentials/${ownerId}`);
 return Object.entries(map).map(([id, c]) => ({ ...c, id }));
}

export async function addCredential(
 ctx: AppContext,
 ownerId: string,
 data: { key: string; value: string; service: string; label?: string },
): Promise<Credential> {
 const encd = ctx.encrypt(data.value);
 const id = await ctx.db.keys.push(`credentials/${ownerId}`, {
 key: data.key,
 valueEnc: encd.valueEnc,
 iv: encd.iv,
 service: data.service,
 label: data.label ?? '',
 createdAt: now(),
 });
 const created = (await ctx.db.keys.get<Credential>(`credentials/${ownerId}/${id}`))!;
 return { ...created, id };
}

export async function updateCredential(
 ctx: AppContext,
 ownerId: string,
 credId: string,
 patch: { value?: string; label?: string; service?: string; key?: string },
): Promise<void> {
 const upd: Record<string, unknown> = {};
 if (patch.value !== undefined) {
 const encd = ctx.encrypt(patch.value);
 upd.valueEnc = encd.valueEnc;
 upd.iv = encd.iv;
 }
 if (patch.label !== undefined) upd.label = patch.label;
 if (patch.service !== undefined) upd.service = patch.service;
 if (patch.key !== undefined) upd.key = patch.key;
 await ctx.db.keys.update(`credentials/${ownerId}/${credId}`, upd);
}

export async function removeCredential(ctx: AppContext, ownerId: string, credId: string): Promise<void> {
 await ctx.db.keys.remove(`credentials/${ownerId}/${credId}`);
}

/** Lấy credential đã giải mã theo key (in-memory, không log). Trả map key→plaintext. */
export async function resolveCredentialsByKey(
 ctx: AppContext,
 ownerId: string,
 keys: string[],
): Promise<Record<string, string>> {
 const all = await listCredentials(ctx, ownerId);
 const out: Record<string, string> = {};
 for (const k of keys) {
 const found = all.find((c) => c.key === k);
 if (found) { const v = ctx.tryDecrypt({ valueEnc: found.valueEnc, iv: found.iv }); if (v !== null) out[k] = v; }
 }
 return out;
}

/** Danh sách key credential (không giá trị) — cho KeyPicker. Trả [{key, service}] distinct. */
export async function listCredentialKeys(ctx: AppContext, ownerId: string): Promise<{ key: string; service: string }[]> {
 const all = await listCredentials(ctx, ownerId);
 const seen = new Map<string, string>();
 for (const c of all) if (!seen.has(c.key)) seen.set(c.key, c.service);
 return [...seen].map(([key, service]) => ({ key, service }));
}

/* ---------------- Catalogs (rtdb-keys/catalogs/<field>) — danh mục dùng chung ---------------- */

export async function listCatalog(ctx: AppContext, field: string): Promise<string[]> {
 const arr = await ctx.db.keys.get<string[]>(`catalogs/${field}`);
 return Array.isArray(arr) ? arr : [];
}
export async function addCatalog(ctx: AppContext, field: string, value: string): Promise<string[]> {
 const cur = await listCatalog(ctx, field);
 if (value && !cur.includes(value)) cur.push(value);
 await ctx.db.keys.set(`catalogs/${field}`, cur);
 return cur;
}

/* ---------------- Flow presets (rtdb-keys/flow-presets) — mẫu flow dùng chung ---------------- */

export async function listFlowPresets(ctx: AppContext): Promise<FetchTemplate[]> {
 const map = await ctx.db.keys.query<FetchTemplate>('flow-presets');
 return Object.entries(map).map(([id, t]) => ({ ...t, id }));
}
export async function saveFlowPreset(
 ctx: AppContext,
 preset: Omit<FetchTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<FetchTemplate> {
 const id = await ctx.db.keys.push('flow-presets', { ...preset, isPreset: true, createdAt: now(), updatedAt: now() });
 const created = (await ctx.db.keys.get<FetchTemplate>(`flow-presets/${id}`))!;
 return { ...created, id };
}

/* ---------------- Templates (lưu trong rtdb-keys/templates) ---------------- */

export async function listTemplates(ctx: AppContext): Promise<FetchTemplate[]> {
 const map = await ctx.db.keys.query<FetchTemplate>('templates');
 return Object.entries(map).map(([id, t]) => ({ ...t, id }));
}
export async function getTemplate(ctx: AppContext, id: string): Promise<FetchTemplate | null> {
 const t = await ctx.db.keys.get<FetchTemplate>(`templates/${id}`);
 return t ? { ...t, id } : null;
}
export async function saveTemplate(ctx: AppContext, tpl: Omit<FetchTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<FetchTemplate> {
 const id = await ctx.db.keys.push('templates', { ...tpl, createdAt: now(), updatedAt: now() });
 return (await getTemplate(ctx, id))!;
}
export async function updateTemplate(ctx: AppContext, id: string, patch: Partial<FetchTemplate>): Promise<void> {
 await ctx.db.keys.update(`templates/${id}`, { ...patch, updatedAt: now() });
}
export async function removeTemplate(ctx: AppContext, id: string): Promise<void> {
 await ctx.db.keys.remove(`templates/${id}`);
}

/* ---------------- History (rtdb-history) ---------------- */

export async function addHistory(ctx: AppContext, ownerId: string, entry: HistoryEntry): Promise<string> {
 return ctx.db.history.push(`history/${ownerId}`, entry as any);
}
export async function listHistory(
 ctx: AppContext,
 ownerId: string,
 filter?: { service?: string; success?: boolean },
): Promise<(HistoryEntry & { id: string })[]> {
 const map = await ctx.db.history.query<HistoryEntry>(`history/${ownerId}`);
 let list = Object.entries(map).map(([id, h]) => ({ ...h, id }));
 if (filter?.service) list = list.filter((h) => h.service === filter.service);
 if (filter?.success !== undefined) list = list.filter((h) => h.success === filter.success);
 return list.sort((a, b) => b.calledAt - a.calledAt);
}

/* ---------------- Logs (rtdb-logs) ---------------- */

export async function addLog(ctx: AppContext, entry: LogEntry): Promise<string> {
 return ctx.db.logs.push('logs', entry as any);
}
export async function listLogs(
 ctx: AppContext,
 filter?: { service?: string; business?: string; level?: string },
): Promise<(LogEntry & { id: string })[]> {
 const map = await ctx.db.logs.query<LogEntry>('logs');
 let list = Object.entries(map).map(([id, l]) => ({ ...l, id }));
 if (filter?.service) list = list.filter((l) => l.service === filter.service);
 if (filter?.business) list = list.filter((l) => l.business === filter.business);
 if (filter?.level) list = list.filter((l) => l.level === filter.level);
 return list.sort((a, b) => b.createdAt - a.createdAt);
}

/* ---------------- Issues (rtdb-issues) ---------------- */

export async function listIssues(ctx: AppContext, filter?: { type?: string; status?: string }): Promise<Issue[]> {
 const map = await ctx.db.issues.query<Issue>('issues');
 let list = Object.entries(map).map(([id, i]) => ({ ...i, id }));
 if (filter?.type) list = list.filter((i) => i.type === filter.type);
 if (filter?.status) list = list.filter((i) => i.status === filter.status);
 return list.sort((a, b) => b.createdAt - a.createdAt);
}
export async function getIssue(ctx: AppContext, id: string): Promise<Issue | null> {
 const i = await ctx.db.issues.get<Issue>(`issues/${id}`);
 return i ? { ...i, id } : null;
}
export async function createIssue(ctx: AppContext, data: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>): Promise<Issue> {
 const id = await ctx.db.issues.push('issues', { ...data, createdAt: now(), updatedAt: now() });
 return (await getIssue(ctx, id))!;
}
export async function updateIssue(ctx: AppContext, id: string, patch: Partial<Issue>): Promise<void> {
 await ctx.db.issues.update(`issues/${id}`, { ...patch, updatedAt: now() });
}
export async function removeIssue(ctx: AppContext, id: string): Promise<void> {
 await ctx.db.issues.remove(`issues/${id}`);
}

/* ---------------- Variables (rtdb-variables) ---------------- */

export async function listVariables(ctx: AppContext, scope: string): Promise<Record<string, Variable>> {
 return (await ctx.db.variables.get<Record<string, Variable>>(`variables/${scope}`)) ?? {};
}
export async function setVariable(ctx: AppContext, scope: string, key: string, value: unknown, source: Variable['source'] = 'manual'): Promise<void> {
 await ctx.db.variables.set(`variables/${scope}/${key}`, { value, updatedAt: now(), source });
}
export async function removeVariable(ctx: AppContext, scope: string, key: string): Promise<void> {
 await ctx.db.variables.remove(`variables/${scope}/${key}`);
}
/** Resolve biến: ưu tiên owner scope, fallback global. Trả map key→value. */
export async function resolveVars(ctx: AppContext, ownerId?: string): Promise<Record<string, unknown>> {
 const global = await listVariables(ctx, 'global');
 const owner = ownerId ? await listVariables(ctx, ownerId) : {};
 const out: Record<string, unknown> = {};
 for (const [k, v] of Object.entries(global)) out[k] = v.value;
 for (const [k, v] of Object.entries(owner)) out[k] = v.value; // owner ghi đè global
 return out;
}

/* ---------------- Extractions (rtdb-variables/extractions) ---------------- */

export async function addExtraction(ctx: AppContext, rec: Omit<ExtractionRecord, 'id'>): Promise<string> {
 return ctx.db.variables.push('extractions', rec as any);
}
export async function listExtractions(
 ctx: AppContext,
 filter?: { ownerId?: string; service?: string },
): Promise<ExtractionRecord[]> {
 const map = await ctx.db.variables.query<ExtractionRecord>('extractions');
 let list = Object.entries(map).map(([id, e]) => ({ ...e, id }));
 if (filter?.ownerId) list = list.filter((e) => e.ownerId === filter.ownerId);
 if (filter?.service) list = list.filter((e) => e.service === filter.service);
 return list.sort((a, b) => b.createdAt - a.createdAt);
}
