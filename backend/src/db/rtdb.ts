/**
 * rtdb.ts — Storage adapter (PLAN Bước 0.3, [SYS] 2, 3, 10.4)
 *
 * SPEC yêu cầu Google RTDB tách 5 DB độc lập (keys, history, logs, issues, variables)
 * với `.indexOn`. Vì credential Firebase thật KHÔNG được commit (và secret trong doc
 * đã bị lộ → phải rotate), ta trừu tượng hóa storage qua interface `Db`, cung cấp:
 *
 *   - MemoryDb  : chạy in-memory (mặc định dev/test), reset khi restart.
 *   - FileDb    : lưu JSON xuống ổ đĩa (mỗi DB 1 file) → giữ dữ liệu qua restart.
 *   - FirebaseDb: (khi có credential) dùng RTDB REST API + OAuth service account.
 *
 * Cả 3 adapter cùng interface → business logic không đổi. Schema & `.indexOn`
 * được đặc tả trong docker/database.rules.json (dùng cho Firebase mode).
 *
 * Mô hình dữ liệu: mỗi DB là 1 cây JSON. API: get/set/update/push/remove/query
 * theo đường dẫn (path) phân tách bằng '/'.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppConfig } from '../config/env.js';
import { genId } from '../lib/ids.js';

export type DbName = 'keys' | 'history' | 'logs' | 'issues' | 'variables';

export interface QueryOptions {
  /** Lọc theo child key (giả lập orderByChild + equalTo của RTDB). */
  orderByChild?: string;
  equalTo?: string | number | boolean;
  limit?: number;
}

export interface Db {
  name: DbName;
  get<T = unknown>(path: string): Promise<T | null>;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, value: Record<string, unknown>): Promise<void>;
  /** Tạo child với id tự sinh, trả về id. */
  push(path: string, value: Record<string, unknown>): Promise<string>;
  remove(path: string): Promise<void>;
  /** Trả về map { childId: value } tại `path`, có thể lọc/limit. */
  query<T = unknown>(path: string, opts?: QueryOptions): Promise<Record<string, T>>;
}

/* ------------------------------------------------------------------ */
/* Helpers thao tác cây JSON theo path                                 */
/* ------------------------------------------------------------------ */

type Tree = Record<string, any>;

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function getAt(tree: Tree, path: string): any {
  const parts = splitPath(path);
  let cur: any = tree;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[p];
  }
  return cur === undefined ? null : cur;
}

function setAt(tree: Tree, path: string, value: any): void {
  const parts = splitPath(path);
  if (parts.length === 0) return;
  let cur: any = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function removeAt(tree: Tree, path: string): void {
  const parts = splitPath(path);
  if (parts.length === 0) return;
  let cur: any = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null) return;
    cur = cur[p];
  }
  delete cur[parts[parts.length - 1]];
}

function applyQuery<T>(node: Record<string, T> | null, opts?: QueryOptions): Record<string, T> {
  if (!node || typeof node !== 'object') return {};
  let entries = Object.entries(node) as [string, T][];
  if (opts?.orderByChild && opts.equalTo !== undefined) {
    entries = entries.filter(([, v]) => {
      const child = (v as any)?.[opts.orderByChild!];
      return child === opts.equalTo;
    });
  }
  if (opts?.limit && opts.limit > 0) entries = entries.slice(0, opts.limit);
  return Object.fromEntries(entries) as Record<string, T>;
}

/* ------------------------------------------------------------------ */
/* MemoryDb                                                            */
/* ------------------------------------------------------------------ */

class MemoryDb implements Db {
  private tree: Tree = {};
  constructor(public name: DbName) {}

  async get<T>(path: string) {
    return structuredClone(getAt(this.tree, path)) as T | null;
  }
  async set(path: string, value: unknown) {
    setAt(this.tree, path, structuredClone(value));
  }
  async update(path: string, value: Record<string, unknown>) {
    const cur = getAt(this.tree, path) ?? {};
    setAt(this.tree, path, { ...cur, ...structuredClone(value) });
  }
  async push(path: string, value: Record<string, unknown>) {
    const id = genId();
    setAt(this.tree, `${path}/${id}`, structuredClone(value));
    return id;
  }
  async remove(path: string) {
    removeAt(this.tree, path);
  }
  async query<T>(path: string, opts?: QueryOptions) {
    return applyQuery<T>(structuredClone(getAt(this.tree, path)), opts);
  }
}

/* ------------------------------------------------------------------ */
/* FileDb — lưu xuống JSON, giữ dữ liệu qua restart                    */
/* ------------------------------------------------------------------ */

class FileDb implements Db {
  private tree: Tree = {};
  private file: string;
  constructor(public name: DbName, dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, `rtdb-${name}.json`);
    if (existsSync(this.file)) {
      try {
        this.tree = JSON.parse(readFileSync(this.file, 'utf8'));
      } catch {
        this.tree = {};
      }
    }
  }
  private flush() {
    writeFileSync(this.file, JSON.stringify(this.tree, null, 2), 'utf8');
  }
  async get<T>(path: string) {
    return structuredClone(getAt(this.tree, path)) as T | null;
  }
  async set(path: string, value: unknown) {
    setAt(this.tree, path, structuredClone(value));
    this.flush();
  }
  async update(path: string, value: Record<string, unknown>) {
    const cur = getAt(this.tree, path) ?? {};
    setAt(this.tree, path, { ...cur, ...structuredClone(value) });
    this.flush();
  }
  async push(path: string, value: Record<string, unknown>) {
    const id = genId();
    setAt(this.tree, `${path}/${id}`, structuredClone(value));
    this.flush();
    return id;
  }
  async remove(path: string) {
    removeAt(this.tree, path);
    this.flush();
  }
  async query<T>(path: string, opts?: QueryOptions) {
    return applyQuery<T>(structuredClone(getAt(this.tree, path)), opts);
  }
}


/* ------------------------------------------------------------------ */
/* FirebaseDb — Firebase RTDB REST adapter (5 DB/app URL độc lập)      */
/* ------------------------------------------------------------------ */


interface HttpPolicy {
  timeoutMs: number;
  retries: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 2_000);
}

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function parseFirebaseServiceAccount(encoded?: string): FirebaseServiceAccount {
  if (!encoded) throw new Error('[rtdb] API_FETCH_MANAGER_FIREBASE_SA là bắt buộc cho firebase mode.');
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    const sa = JSON.parse(json) as FirebaseServiceAccount;
    if (!sa.client_email || !sa.private_key) throw new Error('missing client_email/private_key');
    return sa;
  } catch (e: any) {
    throw new Error(`[rtdb] FIREBASE_SA phải là service-account JSON được base64 hóa hợp lệ: ${e?.message ?? e}`);
  }
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

class FirebaseTokenProvider {
  private token: { value: string; expiresAt: number } | null = null;
  constructor(private sa: FirebaseServiceAccount) {}

  async getAccessToken(): Promise<string> {
    const nowMs = Date.now();
    if (this.token && this.token.expiresAt - 60_000 > nowMs) return this.token.value;

    const { createSign } = await import('node:crypto');
    const nowSec = Math.floor(nowMs / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: this.sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
      aud: this.sa.token_uri ?? 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    };
    const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const assertion = `${unsigned}.${base64Url(signer.sign(this.sa.private_key))}`;

    const res = await fetch(claim.aud, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !body.access_token) {
      throw new Error(`[rtdb] Không lấy được Firebase access token (${res.status}): ${body.error_description ?? body.error ?? res.statusText}`);
    }
    this.token = { value: body.access_token, expiresAt: nowMs + Number(body.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }
}

class FirebaseDb implements Db {
  constructor(public name: DbName, private databaseUrl: string, private tokens: FirebaseTokenProvider, private policy: HttpPolicy) {
    if (!databaseUrl) throw new Error(`[rtdb] Thiếu RTDB URL cho database ${name}.`);
    this.databaseUrl = databaseUrl.replace(/\/+$/, '');
  }

  private url(path: string, params?: Record<string, string>): string {
    const clean = splitPath(path).map(encodeURIComponent).join('/');
    const u = new URL(`${this.databaseUrl}/${clean}.json`);
    if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.policy.retries; attempt++) {
      const token = await this.tokens.getAccessToken();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.policy.timeoutMs);
      try {
        const res = await fetch(this.url(path, params), {
          method,
          signal: controller.signal,
          headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        if ((res.status === 429 || res.status >= 500) && attempt < this.policy.retries) {
          await sleep(retryDelayMs(attempt));
          continue;
        }
        if (!res.ok) throw new Error(`[rtdb:${this.name}] ${method} ${path} failed (${res.status}): ${text || res.statusText}`);
        return parsed as T;
      } catch (e: any) {
        lastError = e?.name === 'AbortError' ? new Error(`[rtdb:${this.name}] ${method} ${path} timeout sau ${this.policy.timeoutMs}ms`) : e;
        if (attempt < this.policy.retries) {
          await sleep(retryDelayMs(attempt));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  async get<T>(path: string) {
    return await this.request<T | null>('GET', path);
  }
  async set(path: string, value: unknown) {
    await this.request('PUT', path, value);
  }
  async update(path: string, value: Record<string, unknown>) {
    await this.request('PATCH', path, value);
  }
  async push(path: string, value: Record<string, unknown>) {
    const res = await this.request<{ name: string }>('POST', path, value);
    return res.name;
  }
  async remove(path: string) {
    await this.request('DELETE', path);
  }
  async query<T>(path: string, opts?: QueryOptions) {
    const params: Record<string, string> = {};
    if (opts?.orderByChild) params.orderBy = JSON.stringify(opts.orderByChild);
    if (opts?.equalTo !== undefined) params.equalTo = JSON.stringify(opts.equalTo);
    if (opts?.limit && opts.limit > 0) params.limitToFirst = String(opts.limit);
    return (await this.request<Record<string, T> | null>('GET', path, undefined, params)) ?? {};
  }
}

/* ------------------------------------------------------------------ */
/* Registry — export 5 handle DB                                       */
/* ------------------------------------------------------------------ */

export interface RtdbRegistry {
  keys: Db;
  history: Db;
  logs: Db;
  issues: Db;
  variables: Db;
}

const DB_NAMES: DbName[] = ['keys', 'history', 'logs', 'issues', 'variables'];

export function createRtdb(config: AppConfig): RtdbRegistry {
  const firebaseTokens = config.storageMode === 'firebase' ? new FirebaseTokenProvider(parseFirebaseServiceAccount(config.firebaseServiceAccount)) : null;
  const httpPolicy = { timeoutMs: config.httpTimeoutMs, retries: config.httpRetries };
  const firebaseUrls: Record<DbName, string | undefined> = {
    keys: config.rtdb.keys,
    history: config.rtdb.history,
    logs: config.rtdb.logs,
    issues: config.rtdb.issues,
    variables: config.rtdb.variables,
  };

  const make = (name: DbName): Db => {
    switch (config.storageMode) {
      case 'file':
        return new FileDb(name, config.dataDir);
      case 'firebase':
        return new FirebaseDb(name, firebaseUrls[name]!, firebaseTokens!, httpPolicy);
      case 'memory':
      default:
        return new MemoryDb(name);
    }
  };

  const reg = {} as RtdbRegistry;
  for (const n of DB_NAMES) (reg as any)[n] = make(n);
  return reg;
}
