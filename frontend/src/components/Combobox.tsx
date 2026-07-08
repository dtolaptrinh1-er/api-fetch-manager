import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/api';

/**
 * Combobox ([UI] addendum v1.2 §3): nhập tự do HOẶC chọn từ danh mục dùng chung.
 * - Gõ tay để lọc / nhập giá trị mới.
 * - Chọn từ dropdown danh mục (lấy từ /api/catalogs?field=).
 * - Nút "Lưu vào danh mục" (POST /api/catalogs) để owner khác tái dùng.
 */
export function Combobox({
 field,
 value,
 onChange,
 placeholder,
}: {
 field: string;
 value: string;
 onChange: (v: string) => void;
 placeholder?: string;
}) {
 const [open, setOpen] = useState(false);
 const [options, setOptions] = useState<string[]>([]);
 const boxRef = useRef<HTMLDivElement | null>(null);

 const load = async () => {
 try {
 setOptions(await api.get<string[]>(`/catalogs?field=${encodeURIComponent(field)}`));
 } catch {
 setOptions([]);
 }
 };
 useEffect(() => {
 load();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [field]);

 useEffect(() => {
 const onDoc = (e: MouseEvent) => {
 if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
 };
 document.addEventListener('mousedown', onDoc);
 return () => document.removeEventListener('mousedown', onDoc);
 }, []);

 const saveToCatalog = async () => {
 const v = value.trim();
 if (!v) return;
 try {
 const next = await api.post<string[]>('/catalogs', { field, value: v });
 setOptions(next);
 } catch {
 /* ignore */
 }
 };

 const filtered = options.filter((o) => o.toLowerCase().includes(value.toLowerCase()));

 return (
 <div className="combobox" ref={boxRef}>
 <div className="row">
 <input
 className="input"
 value={value}
 placeholder={placeholder}
 onChange={(e) => onChange(e.target.value)}
 onFocus={() => setOpen(true)}
 />
 <button
 type="button"
 className="btn btn--icon"
 data-tooltip="Lưu giá trị này vào danh mục dùng chung để owner khác tái dùng"
 onClick={saveToCatalog}
 style={{ flex: '0 0 30px' }}
 >
 +
 </button>
 </div>
 {open && filtered.length > 0 && (
 <div className="combobox__list">
 {filtered.map((o) => (
 <div
 key={o}
 className="combobox__opt"
 onClick={() => {
 onChange(o);
 setOpen(false);
 }}
 >
 {o}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
