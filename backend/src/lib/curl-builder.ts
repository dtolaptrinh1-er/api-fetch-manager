/**
 * curl-builder.ts — Sinh lệnh curl từ một HTTP request đã resolve (addendum v1.5 + Fetch Builder).
 *
 * Dùng chung: self-test và endpoint /api/fetch/build-curl. Có thể mask các giá trị nhạy
 * cảm (token) trước khi hiển thị cho người dùng — KHÔNG bao giờ để lộ plaintext credential.
 */

export interface CurlRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface CurlOptions {
  /** Danh sách giá trị cần mask (thay bằng ***REDACTED***). */
  maskValues?: string[];
  /** Chuỗi thay thế khi mask. */
  redactWith?: string;
}

function shellQuote(s: string): string {
  // Bọc single-quote an toàn cho POSIX shell.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function maskAll(text: string, values: string[], redactWith: string): string {
  let out = text;
  for (const v of values) {
    if (!v) continue;
    out = out.split(v).join(redactWith);
  }
  return out;
}

export function buildCurl(req: CurlRequest, opts: CurlOptions = {}): string {
  const redactWith = opts.redactWith ?? '***REDACTED***';
  const mask = (s: string) => (opts.maskValues && opts.maskValues.length ? maskAll(s, opts.maskValues, redactWith) : s);

  const parts: string[] = ['curl'];
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') parts.push('-X', method);

  parts.push(shellQuote(mask(req.url)));

  for (const [k, v] of Object.entries(req.headers ?? {})) {
    parts.push('\\\n  -H', shellQuote(`${k}: ${mask(v)}`));
  }

  if (req.body && method !== 'GET' && method !== 'HEAD') {
    parts.push('\\\n  --data', shellQuote(mask(req.body)));
  }

  return parts.join(' ');
}
