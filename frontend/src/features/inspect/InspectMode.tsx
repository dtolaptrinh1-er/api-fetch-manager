import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../lib/appStore';
import { useUI } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Field, Input, Textarea } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { api } from '../../api/api';

interface SelEl {
 el: HTMLElement;
 selector: string;
 outerHTML: string;
 text: string;
 rect: DOMRect;
}

const HOTKEY = ((import.meta.env.VITE_API_FETCH_MANAGER_INSPECT_HOTKEY as string) || 'Ctrl+Shift+J');

function matchHotkey(e: KeyboardEvent, spec: string): boolean {
 const parts = spec.toLowerCase().split('+').map((s) => s.trim());
 const key = parts[parts.length - 1];
 return (
 e.ctrlKey === parts.includes('ctrl') &&
 e.shiftKey === parts.includes('shift') &&
 e.altKey === parts.includes('alt') &&
 e.metaKey === (parts.includes('meta') || parts.includes('cmd')) &&
 e.key.toLowerCase() === key
 );
}

function cssPath(el: HTMLElement): string {
 if (el.id) return `#${el.id}`;
 const parts: string[] = [];
 let cur: HTMLElement | null = el;
 let depth = 0;
 while (cur && cur.nodeType === 1 && depth < 4) {
 let sel = cur.tagName.toLowerCase();
 if (cur.className && typeof cur.className === 'string') {
 const cls = cur.className.split(/\s+/).filter((c) => c && !c.startsWith('inspect-')).slice(0, 2);
 if (cls.length) sel += '.' + cls.join('.');
 }
 parts.unshift(sel);
 cur = cur.parentElement;
 depth++;
 }
 return parts.join(' > ');
}

/**
 * Inspect Element Mode ([UI] 6 + addendum v1.2 §5).
 * - Hotkey toàn cục (mặc định Ctrl+Shift+J) bật ở mọi form/modal.
 * - Toolbar: Tạo issue (n) · Tạm ngưng · Thoát. ESC = thoát.
 * - Tạm ngưng / mở form → nhả con trỏ (không bắt sự kiện) để thao tác form khác.
 * - Chạy được trên modal (chỉ loại trừ chính toolbar inspect).
 * - Mỗi element lưu thêm text; panel dạng row có STT + Selector + Text.
 */
export function InspectMode() {
 const { inspect, setInspect } = useApp();
 const ui = useUI();
 const [selected, setSelected] = useState<SelEl[]>([]);
 const [paused, setPaused] = useState(false);
 const [formOpen, setFormOpen] = useState(false);
 const hoverRef = useRef<HTMLElement | null>(null);
 const selectedRef = useRef<SelEl[]>([]);
 selectedRef.current = selected;

 // Hotkey toàn cục (luôn lắng nghe, kể cả khi chưa inspect).
 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if (matchHotkey(e, HOTKEY)) {
 e.preventDefault();
 setInspect(true);
 } else if (e.key === 'Escape' && inspect) {
 setInspect(false);
 }
 };
 document.addEventListener('keydown', onKey, true);
 return () => document.removeEventListener('keydown', onKey, true);
 }, [inspect, setInspect]);

 // Nhả/bắt con trỏ theo trạng thái paused hoặc form mở.
 useEffect(() => {
 const idle = paused || formOpen;
 document.body.classList.toggle('inspect-paused', inspect && idle);
 }, [paused, formOpen, inspect]);

 useEffect(() => {
 if (!inspect) {
 document.body.classList.remove('inspecting', 'inspect-paused');
 document.querySelectorAll('.inspect-hover,.inspect-selected').forEach((n) => n.classList.remove('inspect-hover', 'inspect-selected'));
 setSelected([]);
 setPaused(false);
 setFormOpen(false);
 return;
 }
 document.body.classList.add('inspecting');

 const isTool = (t: HTMLElement) => t.closest('.inspect-toolbar, .afm-tooltip');
 const active = () => inspect && !paused && !formOpen;

 const onOver = (e: MouseEvent) => {
 if (!active()) return;
 const t = e.target as HTMLElement;
 if (isTool(t)) return;
 if (hoverRef.current) hoverRef.current.classList.remove('inspect-hover');
 hoverRef.current = t;
 if (!t.classList.contains('inspect-selected')) t.classList.add('inspect-hover');
 };
 const onClick = (e: MouseEvent) => {
 if (!active()) return;
 const t = e.target as HTMLElement;
 if (isTool(t)) return;
 e.preventDefault();
 e.stopPropagation();
 t.classList.remove('inspect-hover');
 const exists = selectedRef.current.find((s) => s.el === t);
 if (exists) {
 t.classList.remove('inspect-selected');
 setSelected((s) => s.filter((x) => x.el !== t));
 } else {
 t.classList.add('inspect-selected');
 setSelected((s) => [
 ...s,
 {
 el: t,
 selector: cssPath(t),
 outerHTML: t.outerHTML.slice(0, 500),
 text: (t.innerText || t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
 rect: t.getBoundingClientRect(),
 },
 ]);
 }
 };

 document.addEventListener('mouseover', onOver, true);
 document.addEventListener('click', onClick, true);
 return () => {
 document.removeEventListener('mouseover', onOver, true);
 document.removeEventListener('click', onClick, true);
 };
 }, [inspect, paused, formOpen]);

 if (!inspect) return null;

 return (
 <>
 <div className="inspect-toolbar">
 <Button
 variant="primary"
 icon={Icon.bug({})}
 tooltip="Mở form tạo issue từ các element đã chọn"
 disabled={selected.length === 0}
 onClick={() => setFormOpen(true)}
 >
 Tạo issue ({selected.length})
 </Button>
 <Button
 icon={Icon.target({})}
 tooltip={paused ? 'Tiếp tục bắt element' : 'Tạm ngưng bắt element để thao tác form khác (giữ nguyên đã chọn)'}
 onClick={() => setPaused((p) => !p)}
 >
 {paused ? 'Tiếp tục' : 'Tạm ngưng'}
 </Button>
 <Button
 variant="ghost"
 icon={Icon.x({})}
 tooltip="Thoát chế độ inspect (ESC)"
 onClick={() => setInspect(false)}
 >
 Thoát
 </Button>
 </div>
 {formOpen && (
 <IssueForm
 elements={selected}
 onClose={() => setFormOpen(false)}
 onSaved={() => { setFormOpen(false); setInspect(false); }}
 ui={ui}
 />
 )}
 </>
 );
}

function IssueForm({
 elements,
 onClose,
 onSaved,
 ui,
}: {
 elements: SelEl[];
 onClose: () => void;
 onSaved: () => void;
 ui: ReturnType<typeof useUI>;
}) {
 const [title, setTitle] = useState('');
 const [description, setDescription] = useState('');
 const [expectedResult, setExpectedResult] = useState('');
 const [saving, setSaving] = useState(false);

 const save = async () => {
 if (!title.trim()) {
 ui.notify({ title: 'Thiếu tiêu đề', message: 'Vui lòng nhập tiêu đề issue.', kind: 'warning' });
 return;
 }
 setSaving(true);
 try {
 await api.post('/issues', {
 type: 'bug',
 title,
 description,
 expectedResult,
 elements: elements.map((e) => ({
 selector: e.selector,
 outerHTML: e.outerHTML,
 text: e.text,
 boundingRect: { x: Math.round(e.rect.x), y: Math.round(e.rect.y), w: Math.round(e.rect.width), h: Math.round(e.rect.height) },
 })),
 });
 ui.notify({ title: 'Đã tạo issue', message: 'Issue đã được lưu vào hệ thống.', kind: 'success' });
 onSaved();
 } catch (e: any) {
 ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' });
 } finally {
 setSaving(false);
 }
 };

 return (
 <Modal
 title="Tạo issue từ element đã chọn"
 onClose={onClose}
 wide
 footer={
 <>
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu issue" loading={saving} onClick={save}>Lưu issue</Button>
 </>
 }
 >
 <Field label="Tiêu đề"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Button lưu không phản hồi" /></Field>
 <Field label="Mô tả (các bước gây lỗi / yêu cầu)"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
 <Field label="Kết quả mong muốn"><Textarea rows={2} value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} /></Field>
 <label className="field"><span>Element đã chọn ({elements.length})</span></label>
 <div className="sel-list">
 <div className="sel-item" style={{ fontWeight: 500 }}>
 <span className="idx">#</span>
 <span className="sel">Selector</span>
 <span className="txt">Text đã chọn</span>
 </div>
 {elements.map((e, i) => (
 <div className="sel-item" key={i}>
 <span className="idx">{i + 1}</span>
 <span className="sel">{e.selector}</span>
 <span className="txt">{e.text || '—'}</span>
 </div>
 ))}
 </div>
 </Modal>
 );
}
