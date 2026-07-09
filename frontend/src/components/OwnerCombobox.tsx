import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Owner } from '../api/api';
import { Icon } from './Icon';

/**
 * OwnerCombobox — chọn owner ở Topbar có TÌM KIẾM (addendum v1.4 §2).
 * Thay thế <select> thô: gõ để lọc theo email, mũi tên/enter để chọn.
 */
export function OwnerCombobox({
  owners,
  ownerId,
  onSelect,
}: {
  owners: Owner[];
  ownerId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = owners.find((o) => o.id === ownerId) ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return owners;
    return owners.filter((o) => o.email.toLowerCase().includes(ql));
  }, [owners, q]);

  const choose = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQ('');
  };

  return (
    <div className="owner-combobox" ref={ref}>
      <button
        type="button"
        className="btn"
        style={{ width: '100%', justifyContent: 'space-between' }}
        data-tooltip="Chọn owner đang thao tác (áp dụng cho credential, execute, history…). Bấm để tìm theo email."
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span className="email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.email : '(chưa có owner)'}
        </span>
        {Icon.list({ size: 14 })}
      </button>
      {open && (
        <div className="owner-combobox__list">
          <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              className="input"
              placeholder="Tìm owner theo email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                else if (e.key === 'Enter' && filtered[hi]) { e.preventDefault(); choose(filtered[hi].id); }
                else if (e.key === 'Escape') { setOpen(false); setQ(''); }
              }}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="owner-combobox__opt" style={{ color: 'var(--text-muted)' }}>Không tìm thấy owner.</div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={o.id}
                className={`owner-combobox__opt${i === hi ? ' active' : ''}${o.id === ownerId ? ' active' : ''}`}
                onMouseEnter={() => setHi(i)}
                onMouseDown={() => choose(o.id)}
              >
                <span className="email">{o.email}</span>
                {o.id === ownerId && <span>{Icon.check({ size: 14 })}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
