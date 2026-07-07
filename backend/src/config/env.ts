/**
 * env.ts — Config loader & validator (PLAN Bước 0.2, [SYS] 7.2, [REQ] 4)
 *
 * Nguyên tắc:
 *  - MỌI biến môi trường bắt buộc prefix `API_FETCH_MANAGER_`.
 *  - Fail-fast: thiếu biến bắt buộc → app dừng ngay với message rõ ràng.
 *  - Không log giá trị secret.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

// Auto-load .env (đơn giản, không phụ thuộc thư viện) nếu tồn tại.
(() => {
  for (const f of ['.env', '.env.runtime']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
})();

export type StorageMode = 'memory' | 'file' | 'firebase';

export interface AppConfig {
  port: number;
  logLevel: string;
  storageMode: StorageMode;
  /** Thư mục lưu file JSON khi storageMode = 'file' */
  dataDir: string;
  /** Khóa mã hóa AES-256-GCM (32 byte, base64). */
  encryptionKey: Buffer;
  /** URL của từng RTDB (chỉ dùng khi storageMode = 'firebase'). */
  rtdb: {
    keys?: string;
    history?: string;
    logs?: string;
    issues?: string;
    variables?: string;
  };
  /** Service Account JSON (base64) cho Firebase RTDB REST adapter. */
  firebaseServiceAccount?: string;
  /** Bearer token quản trị cho mọi endpoint /api ngoài /api/health. */
  adminToken?: string;
}

const PREFIX = 'API_FETCH_MANAGER_';

function get(name: string): string | undefined {
  const full = PREFIX + name;
  const v = process.env[full];
  return v === undefined || v === '' ? undefined : v;
}

function required(name: string): string {
  const v = get(name);
  if (v === undefined) {
    throw new Error(
      `[config] Thiếu biến môi trường bắt buộc: ${PREFIX}${name}. ` +
        `Vui lòng khai báo trong .env (xem .env.example).`,
    );
  }
  return v;
}

/**
 * Sinh khóa mã hóa. Trong dev (storage memory/file) nếu không khai báo key,
 * ta cho phép tạo key tạm để chạy được ngay — nhưng CẢNH BÁO rõ ràng.
 * Firebase mode BẮT BUỘC có key thật.
 */
function resolveEncryptionKey(storageMode: StorageMode): Buffer {
  const raw = get('ENCRYPTION_KEY');
  if (raw) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new Error(
        `[config] ${PREFIX}ENCRYPTION_KEY phải là 32 byte base64 (AES-256). ` +
          `Độ dài hiện tại: ${buf.length} byte.`,
      );
    }
    return buf;
  }
  if (storageMode === 'firebase') {
    throw new Error(
      `[config] ${PREFIX}ENCRYPTION_KEY bắt buộc khi chạy storage firebase.`,
    );
  }
  // Dev fallback: key ngẫu nhiên cố định theo process (chỉ dev).
  // eslint-disable-next-line no-console
  console.warn(
    `[config] ⚠️  ${PREFIX}ENCRYPTION_KEY chưa khai báo — dùng key tạm cho dev. ` +
      `KHÔNG dùng cho production.`,
  );
  return randomBytes(32);
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const storageMode = (get('STORAGE_MODE') ?? 'memory') as StorageMode;
  if (!['memory', 'file', 'firebase'].includes(storageMode)) {
    throw new Error(
      `[config] ${PREFIX}STORAGE_MODE không hợp lệ: "${storageMode}". ` +
        `Cho phép: memory | file | firebase.`,
    );
  }

  const config: AppConfig = {
    port: Number(get('PORT') ?? 8080),
    logLevel: get('LOG_LEVEL') ?? 'info',
    storageMode,
    dataDir: get('DATA_DIR') ?? '.data',
    encryptionKey: resolveEncryptionKey(storageMode),
    rtdb: {
      keys: get('RTDB_KEYS_URL'),
      history: get('RTDB_HISTORY_URL'),
      logs: get('RTDB_LOGS_URL'),
      issues: get('RTDB_ISSUES_URL'),
      variables: get('RTDB_VARIABLES_URL'),
    },
    firebaseServiceAccount: get('FIREBASE_SA'),
    adminToken: get('ADMIN_TOKEN'),
  };

  if (storageMode === 'firebase') {
    required('FIREBASE_SA');
    required('RTDB_KEYS_URL');
    required('RTDB_HISTORY_URL');
    required('RTDB_LOGS_URL');
    required('RTDB_ISSUES_URL');
    required('RTDB_VARIABLES_URL');
  }

  if (storageMode !== 'memory' && !config.adminToken) {
    throw new Error(`[config] ${PREFIX}ADMIN_TOKEN bắt buộc khi STORAGE_MODE=${storageMode} để bảo vệ secret endpoints.`);
  }

  if (Number.isNaN(config.port) || config.port <= 0) {
    throw new Error(`[config] ${PREFIX}PORT không hợp lệ.`);
  }

  cached = config;
  return config;
}

/** Chỉ dùng cho test: reset cache config. */
export function _resetConfigForTest(): void {
  cached = null;
}
