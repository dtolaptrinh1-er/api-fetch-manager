import React, { useEffect, useState } from 'react';
import { api } from '../api/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Input, Textarea } from './Field';
import { Icon } from './Icon';
import { useUI } from './ui';

interface CredKey {
 key: string;
 service: string;
 label?: string;
}

/**
 * KeyPicker ([UI] addendum v1.2 §4): chọn credential key của owner → chèn `{{key}}`.
 * Kèm advanced JS (sandbox) áp lên trước khi chèn, và xem giá trị resolved.
 */
export function KeyPicker({
 ownerId,
 onInsert,
}: {
 ownerId: string | null;
 onInsert: (placeholder: string) => void;
}) {
 const ui = useUI();
 const [open, setOpen] = useState(false);
 const [keys, setKeys] = useState<CredKey[]>([]);
 const [selected, setSelected] = useState<string>('');
 const [jsCode, setJsCode] = useState('');
 const [resolved, setResolved] = useState<string | null>(null);

 useEffect(() => {
 if (!open || !ownerId) return;
 api.get<CredKey[]>(`/owners/${ownerId}/credential-keys`).then(setKeys).catch(() => setKeys([]));
 }, [open, ownerId]);

 const placeholder = () => {
 if (!selected) return '';
 return jsCode.trim() ? `{{= ${jsCode.trim()} }}` : `{{${selected}}}`;
 };

 const preview = async () => {
 if (!selected) return;
 try {
 // xem resolved: dùng engine/resolve với scope credentials giả lập tên key
 const r = await api.post<{ result: string }>('/engine/resolve', {
 template: `{{${selected}}}`,
 scope: {},
 });
 setResolved(r.result || '(chưa có giá trị / cần owner có credential)');
 } catch (e: any) {
 ui.notify({ title: 'Lỗi xem giá trị', message: e.message, kind: 'error' });
 }
 };

 const insert = () => {
 const ph = placeholder();
 if (!ph) return ui.notify({ title: 'Chưa chọn key', message: 'Chọn 1 credential key trước.', kind: 'warning' });
 onInsert(ph);
 setOpen(false);
 setJsCode('');
 setResolved(null);
 };

 return (
 <>
 <Button
 iconOnly
 icon={Icon.key({})}
 tooltip="Chèn credential key thành placeholder vào ô đang chọn"
 onClick={() => setOpen(true)}
 disabled={!ownerId}
 />
 {open && (
 <Modal
 title="Chèn credential key"
 onClose={() => setOpen(false)}
 footer={
 <>
 <Button variant="ghost" tooltip="Xem giá trị resolved của placeholder" onClick={preview}>Xem giá trị</Button>
 <Button variant="primary" icon={Icon.pin({})} tooltip="Chèn placeholder vào input" onClick={insert}>Chèn</Button>
 </>
 }
 >
 <Field label="Chọn key">
 <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
 <option value="">— chọn key —</option>
 {keys.map((k) => (
 <option key={k.key} value={k.key}>{k.key} ({k.service})</option>
 ))}
 </select>
 </Field>
 <Field label="Advanced JS (tuỳ chọn, chạy sandbox trước khi chèn)">
 <div className="sandbox-badge">Chạy trong sandbox: cấm network/fs, timeout 200ms</div>
 <Textarea rows={3} value={jsCode} onChange={(e) => setJsCode(e.target.value)} placeholder={'vd: (vars["' + (selected || 'key') + '"] || "").toUpperCase()'} />
 </Field>
 <Field label="Placeholder sẽ chèn">
 <Input className="input mono" value={placeholder()} readOnly />
 </Field>
 {resolved !== null && (
 <div className="kv-row"><span className="k">Resolved</span><span className="v mono">{resolved}</span></div>
 )}
 </Modal>
 )}
 </>
 );
}
