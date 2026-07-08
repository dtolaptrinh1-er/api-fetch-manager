/**
 * credential-import.ts — Chuẩn hoá payload nhập credential từ ngoài.
 * Chấp nhận: object JSON, chuỗi JSON, hoặc chuỗi base64 của JSON.
 * Cấu trúc nguồn: { email?, isSaveRtdbEmail?, userExtras: [{ key, value, service?, label? }] }
 * (cũng chấp nhận `items` hoặc `credentials` thay cho `userExtras`).
 */

export interface NormalizedCredentialItem {
  key: string;
  value: string;
  service?: string;
  label?: string;
}

export interface NormalizedImport {
  email?: string;
  isSaveRtdbEmail?: boolean;
  items: NormalizedCredentialItem[];
}

function tryParse(raw: string): unknown {
  const t = raw.trim();
  // 1) thử JSON trực tiếp
  try {
    return JSON.parse(t);
  } catch {
    // không phải JSON thuần → thử base64
  }
  let decoded: string;
  try {
    decoded = Buffer.from(t, 'base64').toString('utf8');
  } catch {
    throw new Error('Payload không phải JSON hợp lệ và không giải mã base64 được.');
  }
  try {
    return JSON.parse(decoded);
  } catch {
    throw new Error('Payload base64 giải mã ra không phải JSON hợp lệ.');
  }
}

/** Chuẩn hoá input (object | JSON string | base64 string) → NormalizedImport. */
export function normalizeCredentialPayload(input: unknown): NormalizedImport {
  const obj = typeof input === 'string' ? tryParse(input) : input;
  if (!obj || typeof obj !== 'object') {
    throw new Error('Payload không hợp lệ: cần JSON object, chuỗi JSON, hoặc base64 của JSON.');
  }
  const o = obj as Record<string, any>;
  const rawItems: any[] = Array.isArray(o.userExtras)
    ? o.userExtras
    : Array.isArray(o.items)
      ? o.items
      : Array.isArray(o.credentials)
        ? o.credentials
        : [];
  const items: NormalizedCredentialItem[] = rawItems
    .filter((x) => x && x.key !== undefined && x.value !== undefined)
    .map((x) => ({
      key: String(x.key),
      value: typeof x.value === 'string' ? x.value : JSON.stringify(x.value),
      service: x.service !== undefined ? String(x.service) : undefined,
      label: x.label !== undefined ? String(x.label) : undefined,
    }));
  const isSaveRtdbEmail = o.isSaveRtdbEmail === undefined ? undefined : String(o.isSaveRtdbEmail) === 'true';
  return {
    email: o.email !== undefined ? String(o.email) : undefined,
    isSaveRtdbEmail,
    items,
  };
}
