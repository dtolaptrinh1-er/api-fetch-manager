/**
 * context.ts — App context: gom config + rtdb + crypto helpers dùng chung.
 */
import { loadConfig, type AppConfig } from './config/env.js';
import { createRtdb, type RtdbRegistry } from './db/rtdb.js';
import { encrypt, decrypt, maskSecret, type EncryptedValue } from './lib/crypto.js';

export interface AppContext {
  config: AppConfig;
  db: RtdbRegistry;
  /** Thời điểm khởi tạo context (uptime cho status bar). */
  startedAt: number;
  /** Phiên bản app (từ package.json hoặc env). */
  version: string;
  encrypt(plaintext: string): EncryptedValue;
  decrypt(payload: EncryptedValue): string;
  /** Giải mã an toàn: lỗi (sai key/hỏng dữ liệu) → trả null thay vì ném. */
  tryDecrypt(payload: EncryptedValue): string | null;
  mask(plaintext: string): string;
}

export function createContext(): AppContext {
  const config = loadConfig();
  const db = createRtdb(config);
  const dec = (p: EncryptedValue) => decrypt(p, config.encryptionKey);
  return {
    config,
    db,
    startedAt: Date.now(),
    version: process.env.API_FETCH_MANAGER_VERSION ?? '1.0.0',
    encrypt: (p) => encrypt(p, config.encryptionKey),
    decrypt: dec,
    tryDecrypt: (p) => {
      try {
        return dec(p);
      } catch {
        return null;
      }
    },
    mask: maskSecret,
  };
}
