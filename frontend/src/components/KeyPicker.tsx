import React, { useEffect, useState } from 'react';
import { api } from '../api/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Input, Textarea } from './Field';
import { Icon } from './Icon';
import { useUI } from './ui';

/**
 * KeyPicker ([UI] addendum v1.2 §4): chọn credential key của owner → chèn {{key}} vào input.
 * Có ô advanced JS (sandbox) áp lên trước khi chèn, và nút xem giá trị resolved.
 */
export function KeyPicker({
 ownerId,
 onInsert,
}: {
 ownerId: string | null;
 onInsert: (snippet: string) => void;
}) {
 const ui = useUI();
 const [open, setOpen] = useState(false);
 const [keys, setKeys] = useState<string[]>([]);
 const [selected, setSelected] = useState('');
 const [js, setJs] = useState('');
 const [resolved, setResolved] = useState('');

 useEffect(() => {
 if (!open || !ownerId) return;
 api
 .get<string[]>(`/owners/${ownerId}/credential-keys`)
 .then(setKeys)
 .catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }));
 }, [open, ownerId]);

 const snippet = () => (js.trim() ? `{{= ${js.trim()} }}` : selected ? `{{${selected}}}` : '');

 const preview = async () => {
 try {
 const scope = selected ? { credentials: { [selected]: `<${selected}>` } } : {};
 const r = await api.post<{ result: string }>('/engine/resolve', { template: snippet(), scope });
 setResolved(r.result);
 } catch (e: any) {
 ui.notify({ title: 'Lỗi resolve', message: e.message, kind: 'error' });
 }
 };

 const insert = () => {
 const s = snippet();
 if (!s) return ui.notify({ title: 'Chưa chọn', message: 'Chọn key hoặc nhập JS trước.', kind: 'warning' });
 onInsert(s);
 setOpen(false);
 setSelected('');
 setJs('');
 setResolved('');
 };

 return (
 <>
 <Button
 iconOnly
 icon={Icon.key({})}
 tooltip="Chọn credential key để chèn thành placeholder {{key}} vào ô đang soạn"
 onClick={() => setOpen(true)}
 disabled={!ownerId}
 />
 {open && (
 <Modal
 title="Chèn credential key"
 onClose={() => setOpen(false)}
 footer={
 <>
 <Button variant="ghost" tooltip="Đóng" onClick={() => setOpen(false)}>Đóng</Button>
 <Button variant="primary" icon={Icon.plus({})} tooltip="Chèn placeholder vào ô đang soạn" onClick={insert}>Chèn</Button>
 </>
 }
 >
 <Field label="Chọn key credential">
 <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
 <option value="">-- chọn key --</option>
 {keys.map((k) => (
 <option key={k} value={k}>{k}</option>
 ))}
 </select>
 </Field>
 <div className="sandbox-badge">Advanced JS (tuỳ chọn): chạy sandbox, cấm network/fs, timeout 200ms</div>
 <Field label="JS transform (để trống nếu chèn thẳng key)">
 <Textarea rows={3} value={js} onChange={(e) => setJs(e.target.value)} placeholder={"return (vars['github.token']||'').slice(0,8);"} />
 </Field>
 <div className="row">
 <Button icon={Icon.eye({})} tooltip="Xem giá trị resolved (dùng giá trị mẫu) để kiểm tra cấu hình" onClick={preview}>Xem resolved</Button>
 </div>
 {resolved !== '' && (
 <p className="mono" style={{ marginTop: 'var(--sp-2)' }}>Kết quả: {resolved}</p>
 )}
 </Modal>
 )}
 </>
 );
}
