/**
 * seed-presets.ts — Seed 4 flow-preset mặc định + danh mục dùng chung vào database.
 * ⚠️ Chỉ cấu trúc mẫu, KHÔNG chứa secret thật. Chạy: tsx scripts/seed-presets.ts
 */
import { createContext } from '../src/context.js';
import * as store from '../src/modules/stores.js';

async function main() {
 const ctx = createContext();
 console.log(`[seed-presets] storage=${ctx.config.storageMode}`);

 // Danh mục dùng chung
 for (const s of ['github.com', 'cloudflare.com', 'supabase.com']) await store.addCatalog(ctx, 'service', s);
 for (const b of ['fetch-repo', 'get-user', 'dispatch-workflow', 'get-account-id']) await store.addCatalog(ctx, 'business', b);

 const presets = [
 {
 name: 'GitHub - Fetch repo', service: 'github.com', business: 'fetch-repo', stopOnError: true,
 inputs: [{ name: 'owner', required: true, source: 'runtime' as const }, { name: 'repo', required: true, source: 'runtime' as const }],
 credentialRefs: [{ placeholder: 'github.token', key: 'github.token' }],
 steps: [{ id: 'get', method: 'GET', urlTemplate: 'https://api.github.com/repos/{{input.owner}}/{{input.repo}}', headers: { Authorization: 'Bearer {{github.token}}', Accept: 'application/vnd.github+json' }, bodyTemplate: '', extract: [{ field: 'repoUrl', jsonPath: '$.html_url', pinToVar: 'github.lastRepoUrl' }] }],
 },
 {
 name: 'GitHub - Get user', service: 'github.com', business: 'get-user', stopOnError: true,
 inputs: [], credentialRefs: [{ placeholder: 'github.token', key: 'github.token' }],
 steps: [{ id: 'me', method: 'GET', urlTemplate: 'https://api.github.com/user', headers: { Authorization: 'Bearer {{github.token}}', Accept: 'application/vnd.github+json' }, bodyTemplate: '', extract: [{ field: 'login', jsonPath: '$.login' }] }],
 },
 {
 name: 'GitHub - Dispatch workflow', service: 'github.com', business: 'dispatch-workflow', stopOnError: true,
 inputs: [{ name: 'owner', required: true, source: 'runtime' as const }, { name: 'repo', required: true, source: 'runtime' as const }, { name: 'workflowId', required: true, source: 'runtime' as const }, { name: 'ref', required: true, source: 'runtime' as const }],
 credentialRefs: [{ placeholder: 'github.token', key: 'github.token' }],
 steps: [{ id: 'dispatch', method: 'POST', urlTemplate: 'https://api.github.com/repos/{{input.owner}}/{{input.repo}}/actions/workflows/{{input.workflowId}}/dispatches', headers: { Authorization: 'Bearer {{github.token}}', Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, bodyTemplate: '{"ref":"{{input.ref}}"}', extract: [] }],
 },
 {
 name: 'Cloudflare - Get account id', service: 'cloudflare.com', business: 'get-account-id', stopOnError: true,
 inputs: [], credentialRefs: [{ placeholder: 'cloudflare.token', key: 'cloudflare.token' }],
 steps: [{ id: 'accounts', method: 'GET', urlTemplate: 'https://api.cloudflare.com/client/v4/accounts', headers: { Authorization: 'Bearer {{cloudflare.token}}', 'Content-Type': 'application/json' }, bodyTemplate: '', extract: [{ field: 'accountId', jsonPath: '$.result[0].id', pinToVar: 'cloudflare.accountId' }] }],
 },
 ];

 for (const p of presets) {
 await store.saveFlowPreset(ctx, p as any);
 console.log(`[seed-presets] preset: ${p.name}`);
 }
 console.log('[seed-presets] ✅ Hoàn tất seed 4 preset + danh mục.');
 process.exit(0);
}

main().catch((e) => { console.error('[seed-presets] Lỗi:', e); process.exit(1); });
