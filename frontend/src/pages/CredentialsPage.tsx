import React, { useEffect, useState } from 'react';
import { api, type CredentialMasked } from '../api/api';
import { useApp } from '../lib/appStore';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Field, Input, Textarea } from '../components/Field';
import { Icon } from '../components/Icon';

export function CredentialsPage() {
 const { ownerId, owners, reloadOwners, setOwnerId } = useApp();
 const ui = useUI();
 const [creds, setCreds] = useState<CredentialMasked[]>([]);
 const [addOpen, setAddOpen] = useState(false);
 const [ownerOpen, setOwnerOpen] = useState(false);
 const [editing, setEditing] = useState<CredentialMasked | null>(null);
 const [bulkOpen, setBulkOpen] = useState(false);
 const [ioOpen, setIoOpen] = useState<false | 'import' | 'export'>(false);

 const load = async () => {
 if (!ownerId) return setCreds([]);
 setCreds(await api.get<CredentialMasked[]>(`/owners/${ownerId}/credentials`));
 };
 useEffect(() => {
 load().catch((e) => ui.notify({ title: 'Lỗi tải', message: e.message, kind: 'error' }));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ownerId]);

 const reveal = async (c: CredentialMasked) => {
 const okc = await ui.confirm({
 title: 'Hiện giá trị credential?',
 message: <>Bạn sắp xem giá trị thật của <b>{c.key}</b>. Giá trị nhạy cảm sẽ hiển thị. Tiếp tục?</>,
 confirmLabel: 'Hiện giá trị',
 danger: true,
 });
 if (!okc) return;
 try {
 const { value } = await api.post<{ value: string }>(`/owners/${ownerId}/credentials/${c.id}/reveal`);
 ui.notify({ title: `Giá trị: ${c.key}`, message: <code>{value}</code>, kind: 'info' });
 } catch (e: any) {
 ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' });
 }
 };

 const del = async (c: CredentialMasked) => {
 const okc = await ui.confirm({
 title: 'Xác nhận xóa',
 message: <>Xóa credential <b>{c.key}</b>? Không thể hoàn tác.</>,
 confirmLabel: 'Xóa',
 danger: true,
 });
 if (!okc) return;
 await api.del(`/owners/${ownerId}/credentials/${c.id}`);
 ui.notify({ title: 'Đã xóa', message: 'Credential đã bị xóa.', kind: 'success' });
 load();
 };

 return (
 <div className="page">
 <div className="page__head">
 <h1>Credentials</h1>
 <p className="muted">Quản lý key theo emailOwner · giá trị luôn được mã hoá &amp; masked</p>
 </div>

 <div className="toolbar">
 <Button icon={Icon.plus({})} tooltip="Tạo owner (email) mới" onClick={() => setOwnerOpen(true)}>Owner mới</Button>
 <Button icon={Icon.key({})} tooltip="Thêm 1 credential cho owner đang chọn" variant="primary" onClick={() => setAddOpen(true)} disabled={!ownerId}>Thêm key</Button>
 <Button icon={Icon.upload({})} tooltip="Nhập nhiều credential từ JSON thuần hoặc base64 (userExtras)" onClick={() => setBulkOpen(true)} disabled={!ownerId}>Nhập JSON/base64</Button>
 <Button icon={Icon.download({})} tooltip="Import dữ liệu owner + credential từ JSON export" onClick={() => setIoOpen('import')}>Import</Button>
 <Button icon={Icon.copy({})} tooltip="Export toàn bộ dữ liệu ra JSON để backup" onClick={() => setIoOpen('export')}>Export</Button>
 </div>

 {!ownerId ? (
 <p className="muted">Chưa có owner nào. Tạo owner mới để bắt đầu.</p>
 ) : creds.length === 0 ? (
 <p className="muted">Owner này chưa có credential. Bấm "Thêm key" hoặc "Nhập JSON/base64".</p>
 ) : (
 <>
 <table className="table cred-table">
 <thead>
 <tr><th>Key</th><th>Service</th><th>Label</th><th>Giá trị (masked)</th><th></th></tr>
 </thead>
 <tbody>
 {creds.map((c) => (
 <tr key={c.id}>
 <td className="mono">{c.key}</td>
 <td>{c.service}</td>
 <td>{c.label || '—'}</td>
 <td className="mono">{c.masked}</td>
 <td className="row-actions">
 <Button iconOnly icon={Icon.eye({})} tooltip="Hiện giá trị thật (cần xác nhận)" onClick={() => reveal(c)} />
 <Button iconOnly icon={Icon.edit({})} tooltip="Sửa key/value/service/label" onClick={() => setEditing(c)} />
 <Button iconOnly icon={Icon.trash({})} tooltip="Xóa credential này" variant="danger" onClick={() => del(c)} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>

 <div className="cards">
 {creds.map((c) => (
 <div className="card" key={c.id}>
 <div className="card__row"><span className="muted">Key</span><span className="mono">{c.key}</span></div>
 <div className="card__row"><span className="muted">Service</span><span>{c.service}</span></div>
 <div className="card__row"><span className="muted">Giá trị</span><span className="mono">{c.masked}</span></div>
 <div className="card__actions">
 <Button iconOnly icon={Icon.eye({})} tooltip="Hiện giá trị thật" onClick={() => reveal(c)} />
 <Button iconOnly icon={Icon.edit({})} tooltip="Sửa" onClick={() => setEditing(c)} />
 <Button iconOnly icon={Icon.trash({})} tooltip="Xóa" variant="danger" onClick={() => del(c)} />
 </div>
 </div>
 ))}
 </div>
 </>
 )}

 {ownerOpen && <OwnerModal onClose={() => setOwnerOpen(false)} onSaved={async (id) => { setOwnerOpen(false); await reloadOwners(); setOwnerId(id); }} ui={ui} />}
 {addOpen && ownerId && <AddCredModal ownerId={ownerId} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} ui={ui} />}
 {editing && ownerId && <EditCredModal ownerId={ownerId} cred={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} ui={ui} />}
 {bulkOpen && ownerId && <BulkImportModal ownerId={ownerId} onClose={() => setBulkOpen(false)} onDone={() => { setBulkOpen(false); load(); }} ui={ui} />}
 {ioOpen && <ImportExportModal mode={ioOpen} onClose={() => setIoOpen(false)} onDone={async () => { setIoOpen(false); await reloadOwners(); load(); }} ui={ui} />}
 </div>
 );
}

function OwnerModal({ onClose, onSaved, ui }: { onClose: () => void; onSaved: (id: string) => void; ui: ReturnType<typeof useUI> }) {
 const [email, setEmail] = useState('');
 const [saving, setSaving] = useState(false);
 const save = async () => {
 if (!email.trim()) return ui.notify({ title: 'Thiếu email', message: 'Nhập email owner.', kind: 'warning' });
 setSaving(true);
 try {
 const o = await api.post<{ id: string }>('/owners', { email });
 ui.notify({ title: 'Đã tạo owner', message: email, kind: 'success' });
 onSaved(o.id);
 } catch (e: any) {
 ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' });
 } finally {
 setSaving(false);
 }
 };
 return (
 <Modal title="Tạo owner mới" onClose={onClose} footer={<>
 <Button variant="ghost" tooltip="Hủy, không tạo" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu owner" loading={saving} onClick={save}>Lưu</Button>
 </>}>
 <Field label="Email owner"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" /></Field>
 </Modal>
 );
}

function AddCredModal({ ownerId, onClose, onSaved, ui }: { ownerId: string; onClose: () => void; onSaved: () => void; ui: ReturnType<typeof useUI> }) {
 const [key, setKey] = useState('');
 const [value, setValue] = useState('');
 const [service, setService] = useState('github.com');
 const [label, setLabel] = useState('');
 const [saving, setSaving] = useState(false);
 const save = async () => {
 if (!key.trim() || !value.trim()) return ui.notify({ title: 'Thiếu dữ liệu', message: 'Nhập key và value.', kind: 'warning' });
 setSaving(true);
 try {
 await api.post(`/owners/${ownerId}/credentials`, { key, value, service, label });
 ui.notify({ title: 'Đã thêm', message: `Đã lưu ${key} (đã mã hoá).`, kind: 'success' });
 onSaved();
 } catch (e: any) {
 ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' });
 } finally {
 setSaving(false);
 }
 };
 return (
 <Modal title="Thêm credential" onClose={onClose} footer={<>
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu credential (mã hoá)" loading={saving} onClick={save}>Lưu</Button>
 </>}>
 <Field label="Key"><Input value={key} onChange={(e) => setKey(e.target.value)} className="input mono" placeholder="github.token" /></Field>
 <Field label="Value"><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="giá trị bí mật" /></Field>
 <Field label="Service"><Input value={service} onChange={(e) => setService(e.target.value)} placeholder="github.com" /></Field>
 <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ghi chú (tuỳ chọn)" /></Field>
 </Modal>
 );
}

function EditCredModal({ ownerId, cred, onClose, onSaved, ui }: { ownerId: string; cred: CredentialMasked; onClose: () => void; onSaved: () => void; ui: ReturnType<typeof useUI> }) {
 const [key, setKey] = useState(cred.key);
 const [value, setValue] = useState('');
 const [service, setService] = useState(cred.service);
 const [label, setLabel] = useState(cred.label ?? '');
 const [saving, setSaving] = useState(false);
 const save = async () => {
 if (!key.trim()) return ui.notify({ title: 'Thiếu key', message: 'Key không được rỗng.', kind: 'warning' });
 setSaving(true);
 try {
 const patch: Record<string, string> = { key, service, label };
 if (value.trim()) patch.value = value; // để trống = giữ nguyên giá trị cũ
 await api.put(`/owners/${ownerId}/credentials/${cred.id}`, patch);
 ui.notify({ title: 'Đã lưu', message: `Cập nhật ${key}.`, kind: 'success' });
 onSaved();
 } catch (e: any) {
 ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' });
 } finally {
 setSaving(false);
 }
 };
 return (
 <Modal title={`Sửa credential: ${cred.key}`} onClose={onClose} footer={<>
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu thay đổi" loading={saving} onClick={save}>Lưu</Button>
 </>}>
 <Field label="Key"><Input value={key} onChange={(e) => setKey(e.target.value)} className="input mono" /></Field>
 <Field label="Value (để trống = giữ nguyên)"><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="nhập giá trị mới nếu muốn đổi" /></Field>
 <Field label="Service"><Input value={service} onChange={(e) => setService(e.target.value)} /></Field>
 <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
 </Modal>
 );
}

function BulkImportModal({ ownerId, onClose, onDone, ui }: { ownerId: string; onClose: () => void; onDone: () => void; ui: ReturnType<typeof useUI> }) {
 const [text, setText] = useState('');
 const [busy, setBusy] = useState(false);
 const run = async () => {
 if (!text.trim()) return ui.notify({ title: 'Thiếu dữ liệu', message: 'Dán JSON thuần hoặc base64 vào.', kind: 'warning' });
 const okc = await ui.confirm({ title: 'Nhập credential?', message: 'Sẽ chuẩn hoá payload và thêm credential (đã mã hoá) cho owner đang chọn. Tiếp tục?', confirmLabel: 'Nhập', danger: true });
 if (!okc) return;
 setBusy(true);
 try {
 const r = await api.post<{ ownerId: string; credsCreated: number }>('/credentials/import-json', { ownerId, payload: text });
 ui.notify({ title: 'Nhập xong', message: `Đã thêm ${r.credsCreated} credential.`, kind: 'success' });
 onDone();
 } catch (e: any) {
 ui.notify({ title: 'Lỗi nhập', message: e.message, kind: 'error' });
 } finally {
 setBusy(false);
 }
 };
 return (
 <Modal title="Nhập credential (JSON / base64)" onClose={onClose} wide footer={<>
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.upload({})} tooltip="Chuẩn hoá và lưu credential" loading={busy} onClick={run}>Nhập</Button>
 </>}>
 <p className="muted">Chấp nhận JSON thuần hoặc base64 của JSON. Cấu trúc: <code>{'{ email?, isSaveRtdbEmail?, userExtras: [{ key, value }] }'}</code>. Service tự suy từ prefix của key (vd <code>github.token</code> → <code>github</code>).</p>
 <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder='{"userExtras":[{"key":"github.token","value":"..."}]}' />
 </Modal>
 );
}

function ImportExportModal({ mode, onClose, onDone, ui }: { mode: 'import' | 'export'; onClose: () => void; onDone: () => void; ui: ReturnType<typeof useUI> }) {
 const [text, setText] = useState('');
 const [busy, setBusy] = useState(false);
 useEffect(() => {
 if (mode === 'export') {
 api.get('/export').then((d) => setText(JSON.stringify(d, null, 2))).catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }));
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [mode]);

 const doImport = async () => {
 const okc = await ui.confirm({ title: 'Import ghi đè?', message: 'Import sẽ thêm owner + credential từ JSON. Tiếp tục?', confirmLabel: 'Import', danger: true });
 if (!okc) return;
 setBusy(true);
 try {
 const parsed = JSON.parse(text);
 const r = await api.post<{ ownersCreated: number; credsCreated: number }>('/import', parsed);
 ui.notify({ title: 'Import xong', message: `${r.ownersCreated} owner, ${r.credsCreated} credential.`, kind: 'success' });
 onDone();
 } catch (e: any) {
 ui.notify({ title: 'Lỗi import', message: e.message, kind: 'error' });
 } finally {
 setBusy(false);
 }
 };

 const copy = () => { navigator.clipboard.writeText(text); ui.notify({ title: 'Đã copy', message: 'Dữ liệu export đã copy vào clipboard.', kind: 'success' }); };

 return (
 <Modal title={mode === 'import' ? 'Import dữ liệu' : 'Export dữ liệu'} onClose={onClose} wide footer={mode === 'import' ? (
 <>
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.download({})} tooltip="Import owner + credential từ JSON" loading={busy} onClick={doImport}>Import</Button>
 </>
 ) : (
 <>
 <Button variant="ghost" tooltip="Đóng" onClick={onClose}>Đóng</Button>
 <Button variant="primary" icon={Icon.copy({})} tooltip="Copy JSON export vào clipboard" onClick={copy}>Copy</Button>
 </>
 )}>
 <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'import' ? 'Dán JSON export vào đây...' : ''} readOnly={mode === 'export'} />
 </Modal>
 );
}
