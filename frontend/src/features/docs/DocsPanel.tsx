import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../../api/api';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Markdown, extractHeadings, type MarkdownHeading } from '../../lib/markdown';

/**
 * DocsPanel — side-panel tài liệu dịch vụ (addendum v1.6 §1).
 * KHÔNG che toàn bộ UI (chỉ chiếm cột phải), có mục lục + nút "Dùng mẫu" cho code block.
 * Mở qua context useDocs().open('github.com'). Callback onUseCode phát ra ngoài qua context.
 */

interface DocsState {
  open: (slug: string) => void;
  close: () => void;
  /** Đăng ký handler khi người dùng bấm "Dùng mẫu" trong doc (VD Fetch Builder). */
  setUseCodeHandler: (fn: ((code: string, lang: string) => void) | null) => void;
}

const Ctx = createContext<DocsState | null>(null);
export const useDocs = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDocs phải nằm trong <DocsProvider>');
  return c;
};

export function DocsProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [headings, setHeadings] = useState<MarkdownHeading[]>([]);
  const [useCodeHandler, setUseCodeHandlerState] = useState<((c: string, l: string) => void) | null>(null);

  const open = useCallback((s: string) => setSlug(s), []);
  const close = useCallback(() => setSlug(null), []);
  const setUseCodeHandler = useCallback((fn: ((c: string, l: string) => void) | null) => setUseCodeHandlerState(() => fn), []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    api
      .get<{ slug: string; content: string }>(`/docs/${encodeURIComponent(slug)}`)
      .then((d) => {
        setContent(d.content);
        setHeadings(extractHeadings(d.content));
        const first = d.content.split(/\r?\n/).find((l) => l.startsWith('# '));
        setTitle(first ? first.replace(/^#\s*/, '') : slug);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const scrollTo = (id: string) => {
    bodyRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Ctx.Provider value={{ open, close, setUseCodeHandler }}>
      {children}
      {slug && (
        <aside className="docs-panel" role="complementary" aria-label="Tài liệu dịch vụ">
          <div className="docs-panel__head">
            {Icon.info({ size: 16 })}
            <span className="title" data-tooltip={title}>{title || 'Tài liệu'}</span>
            <Button iconOnly icon={Icon.x({})} variant="ghost" tooltip="Đóng bảng tài liệu" onClick={close} />
          </div>
          {headings.length > 0 && (
            <nav className="docs-panel__toc">
              {headings.map((h) => (
                <a key={h.id} className={`lvl-${h.level}`} onClick={() => scrollTo(h.id)} data-tooltip="Cuộn tới mục này">{h.text}</a>
              ))}
            </nav>
          )}
          <div className="docs-panel__body" ref={bodyRef}>
            {loading ? (
              <div className="empty">Đang tải tài liệu…</div>
            ) : error ? (
              <div className="empty">Không tải được tài liệu: {error}</div>
            ) : (
              <Markdown
                source={content}
                onUseCode={useCodeHandler ? (code, lang) => { useCodeHandler(code, lang); } : undefined}
              />
            )}
          </div>
        </aside>
      )}
    </Ctx.Provider>
  );
}
