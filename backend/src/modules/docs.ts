/**
 * docs.ts — Đọc tài liệu dịch vụ từ docs/services/*.md (addendum v1.6 §1).
 *
 * Tài liệu được đóng gói cạnh backend khi build Docker (docs/ copy vào image),
 * hoặc đọc trực tiếp khi chạy dev. Chỉ đọc file .md trong đúng thư mục docs/services
 * (chống path traversal). Trả nội dung thô để FE tự render markdown.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Các vị trí docs/services có thể có (dev vs image). */
function candidateDirs(): string[] {
  return [
    process.env.API_FETCH_MANAGER_DOCS_DIR ?? '',
    join(process.cwd(), 'docs', 'services'),
    join(process.cwd(), 'backend', 'docs', 'services'),
    // Trong image: docs được copy vào /app/backend/docs/services (Dockerfile).
    join(__dirname, '..', '..', 'docs', 'services'), // dist/modules → backend/docs? no: dist → ..
    join(__dirname, '..', '..', '..', 'docs', 'services'),
    join(__dirname, '..', 'docs', 'services'),
  ].filter(Boolean);
}

function docsDir(): string | null {
  for (const d of candidateDirs()) {
    if (existsSync(d)) return d;
  }
  return null;
}

/** Chuẩn hóa slug: bỏ ký tự nguy hiểm, chỉ giữ tên file an toàn. */
function safeSlug(slug: string): string {
  return basename(slug).replace(/[^a-zA-Z0-9._-]/g, '');
}

/** Ánh xạ host dịch vụ → slug file (github.com → github). */
export function hostToSlug(host: string): string {
  return host.replace(/\.(com|org|net|io|dev|app)$/i, '');
}

export interface DocMeta {
  slug: string;
  title: string;
}

/** Liệt kê tài liệu dịch vụ hiện có (bỏ file _TEMPLATE). */
export function listDocs(): DocMeta[] {
  const dir = docsDir();
  if (!dir) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      let title = slug;
      try {
        const first = readFileSync(join(dir, f), 'utf8').split(/\r?\n/).find((l) => l.startsWith('# '));
        if (first) title = first.replace(/^#\s*/, '').trim();
      } catch { /* ignore */ }
      return { slug, title };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Đọc nội dung 1 doc theo slug. Trả null nếu không tồn tại. */
export function readDoc(slug: string): string | null {
  const dir = docsDir();
  if (!dir) return null;
  const safe = safeSlug(slug);
  const file = resolve(dir, `${safe}.md`);
  // Chống path traversal: file phải nằm trong dir.
  if (!file.startsWith(resolve(dir))) return null;
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8');
}
