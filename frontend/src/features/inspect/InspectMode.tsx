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

function cssPath(el: HTMLElement): string {
 if (el.id) return `#${el.id}`;
 const parts: string[] = [];
 let cur: HTMLElement | null = el;
 let depth = 0;
 while (cur && cur.nodeType === 1 && depth < 4) {
 let sel = cur.tagName.toLowerCase();
 if (cur.className && typeof cur.className === 'string') {
 const cls = cur.className.split(/\s+/).filter((c) => c && !c.startsWith('inspect-') && c !== 'afm-tooltip').slice(0, 2);
 if (cls.length) sel += '.' + cls.join('.');
 }
 parts.unshift(sel);
 cur = cur.parentElement;
 depth++;
 }
 return parts.join(' > ');
}

function elText(el: HTMLElement): string {
 return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * Inspect Element Mode ([UI] 6 + SPEC_UI addendum v1.2 §5).
 * - Bật qua hotkey toàn cục (Ctrl+Shift+J) hoặc nút Topbar.
 * - Toolbar: Tạo issue (n) · Tạm ngưng · Thoát. ESC = thoát.
 * - Tạm ngưng / mở form issue -> nhả con trỏ (class inspect-paused), không bắt sự kiện.
 * - Chạy được cả trên modal (chỉ loại trừ thanh công cụ inspect).
 * - Mỗi element lưu thêm text; panel hiển thị #, selector, text theo row.
 */
export function InspectMode({ onCreated }: { onCreated?: () => void }) {
 const { inspect, setInspect, inspectPaused, setInspectPaused } = useApp();
 const ui = useUI();
 const [selected, setSelected] = useState<SelEl[]>([]);
 const [formOpen, setFormOpen] = useState(false);
 const hoverRef = useRef<HTMLElement | null>(null);
 const selectedRef = useRef<SelEl[]>([]);
 selectedRef.current = selected;

 const capturing = inspect && !inspectPaused && !formOpen;

 const exit = () => {
 setInspect(false);
 setInspectPaused(false);
 setFormOpen(false);
 };

 // Dọn class + reset khi tắt inspect
 useEffect(() => {
 if (!inspect) {
 document.body.classList.remove('inspecting', 'inspect-paused');
 document.querySelectorAll('.inspect-hover,.inspect-selected').forEach((n) =>
 n.classList.remove('inspect-hover', 'inspect-selected'),
 );
 setSelected([]);
 setFormOpen(false);
 setInspectPaused(false);
 return;
 }
 document.body.classList.add('inspecting');
 }, [inspect, setInspectPaused]);

 // Nhả con trỏ khi tạm ngưng hoặc mở form
 useEffect(() => {
 if (!inspect) return;
 document.body.classList.toggle('inspect-paused', inspectPaused || formOpen);
 if (hoverRef.current) {
 hoverRef.current.classList.remove('inspect-hover');
 hoverRef.current = null;
 }
 }, [inspect, inspectPaused, formOpen]);

 // ESC = thoát (khi không mở form)
 useEffect(() => {
 if (!inspect) return;
 const onKey = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && !formOpen) {
 e.preventDefault();
 exit();
 }
 };
 window.addEventListener('keydown', onKey, true);
 return () => window.removeEventListener('keydown', onKey, true);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [inspect, formOpen]);

 // Bắt hover/click khi đang capturing
 useEffect(() => {
 if (!capturing) return;
 const isTool = (t: HTMLElement) => t.closest('.inspect-toolbar');

 const onOver = (e: MouseEvent) => {
 const t = e.target as HTMLElement;
 if (isTool(t)) return;
 if (hoverRef.current) hoverRef.current.classList.remove('inspect-hover');
 hoverRef.current = t;
 if (!t.classList.contains('inspect-selected')) t.classList.add('inspect-hover');
 };
 const onClick = (e: MouseEvent) => {
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
 { el: t, selector: cssPath(t), outerHTML: t.outerHTML.slice(0, 500), text: elText(t), rect: t.getBoundingClientRect() },
 ]);
 }
 };
 document.addEventListener('mouseover', onOver, true);
 document.addEventListener('click', onClick, true);
 return () => {
 document.removeEventListener('mouseover', onOver, true);
 document.removeEventListener('click', onClick, true);
 };
 }, [capturing]);

 if (!inspect) return null;

 return (
 <>
 <div className="inspect-toolbar">
 <Button
 icon={Icon.bug({})}
 tooltip="Mở form tạo issue từ các element đã chọn (con trỏ sẽ nhả ra)"
 variant="primary"
 disabled={selected.length === 0}
 onClick={() => setFormOpen(true)}
 >
 Tạo issue ({selected.length})
 </Button>
 <Button
 icon={inspectPaused ? Icon.play({}) : Icon.history({})}
 tooltip={inspectPaused ? 'Tiếp tục bắt element' : 'Tạm ngưng để thao tác form khác, giữ nguyên element đã chọn'}
 onClick={() => setInspectPaused(!inspectPaused)}
 >
 {inspectPaused ? 'Tiếp tục' : 'Tạm ngưng'}
 </Button>
 <Button icon={Icon.x({})} tooltip="Thoát chế độ inspect (ESC)" variant="ghost" onClick={exit}>
 Thoát
 </Button>
 </div>
 {formOpen && (
 <IssueForm
 elements={selected}
 onClose={() => setFormOpen(false)}
 onSaved={() => {
 setFormOpen(false);
 onCreated?.();
 }}
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
 <Button variant="ghost" tooltip="Hủy, không tạo issue" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu issue vào hệ thống" loading={saving} onClick={save}>Lưu issue</Button>
 </>
 }
 >
 <Field label="Tiêu đề"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Button lưu không phản hồi" /></Field>
 <Field label="Mô tả / các bước gây lỗi"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
 <Field label="Kết quả mong muốn"><Textarea rows={2} value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} /></Field>
 <label className="field-label">Element đã chọn ({elements.length})</label>
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
