import React, { useEffect, useRef, useState } from 'react';

/**
 * Combobox ([UI] addendum v1.2 §3): nhập tự do HOẶC chọn từ danh mục.
 * Danh mục lưu chung workspace qua /api/catalogs?field=. Có nút lưu giá trị mới vào danh mục.
 */
export function Combobox({
 value,
 onChange,
 options,
 placeholder,
 onSaveOption,
}: {
 value: string;
 onChange: (v: string) => void;
 options: string[];
 placeholder?: string;
 onSaveOption?: (v: string) => void;
}) {
 const [open, setOpen] = useState(false);
 const ref = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const onDoc = (e: MouseEvent) => {
 if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
 };
 document.addEventListener('mousedown', onDoc);
 return () => document.removeEventListener('mousedown', onDoc);
 }, []);

 const filtered = options.filter((o) => o.toLowerCase().includes((value ?? '').toLowerCase()));
 const canSave = Boolean(value.trim()) && !options.includes(value.trim()) && onSaveOption;

 return (
 <div className="combobox" ref={ref}>
 <div className="row">
 <input
 className="input"
 value={value}
 placeholder={placeholder}
 onChange={(e) => { onChange(e.target.value); setOpen(true); }}
 onFocus={() => setOpen(true)}
 />
 {canSave && (
 <button
 type="button"
 className="btn btn--icon"
 data-tooltip="Lưu giá trị này vào danh mục dùng chung"
 onClick={() => { onSaveOption!(value.trim()); setOpen(false); }}
 style={{ flex: '0 0 30px' }}
 >
 +
 </button>
 )}
 </div>
 {open && filtered.length > 0 && (
 <div className="combobox__list">
 {filtered.map((o) => (
 <div key={o} className="combobox__opt" onMouseDown={() => { onChange(o); setOpen(false); }}>
 {o}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
