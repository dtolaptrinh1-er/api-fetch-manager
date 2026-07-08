import React, { useEffect, useState } from 'react';
import { api, type FetchTemplate, type FlowStep, type FlowInput } from '../api/api';
import { useApp } from '../lib/appStore';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Field, Input, Textarea, Select } from '../components/Field';
import { Icon } from '../components/Icon';
import { Combobox } from '../components/Combobox';
import { ExecuteModal } from '../features/execute/ExecuteModal';

function newStep(): FlowStep {
 return { id: 'step_' + Math.random().toString(36).slice(2, 8), method: 'GET', urlTemplate: '', headers: {}, bodyTemplate: '', extract: [] };
}
function blank(): FetchTemplate {
 return { id: '', name: '', service: '', business: '', stopOnError: true, inputs: [], credentialRefs: [], steps: [newStep()], createdAt: 0, updatedAt: 0 };
}

export function FetchBuilderPage() {
 const { ownerId } = useApp();
 const ui = useUI();
 const [templates, setTemplates] = useState<FetchTemplate[]>([]);
 const [presets, setPresets] = useState<FetchTemplate[]>([]);
 const [editing, setEditing] = useState<FetchTemplate | null>(null);
 const [executing, setExecuting] = useState<FetchTemplate | null>(null);
 const [presetOpen, setPresetOpen] = useState(false);

 const load = async () => setTemplates(await api.get<FetchTemplate[]>('/templates'));
 const loadPresets = async () => setPresets(await api.get<FetchTemplate[]>('/flow-presets'));
 useEffect(() => {
 load().catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }));
 loadPresets().catch(() => {});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const del = async (t: FetchTemplate) => {
 const okc = await ui.confirm({ title: 'Xóa template', message: <>Xóa <b>{t.name}</b>? Không thể hoàn tác.</>, danger: true, confirmLabel: 'Xóa' });
 if (!okc) return;
 await api.del(`/templates/${t.id}`);
 ui.notify({ title: 'Đã xóa', message: t.name, kind: 'success' });
 load();
 };

 const execute = (t: FetchTemplate) => {
 if (!ownerId) return ui.notify({ title: 'Chưa chọn owner', message: 'Chọn emailOwner ở thanh trên trước khi execute.', kind: 'warning' });
 setExecuting(t);
 };

 const fromPreset = (p: FetchTemplate) => {
 setPresetOpen(false);
 setEditing({ ...structuredClone(p), id: '', isPreset: false, name: p.name + ' (copy)', createdAt: 0, updatedAt: 0 });
 };

 return (
 <div className="page">
 <div className="page-head">
 <h1 className="page-title">Fetch Builder</h1>
 <span className="page-desc">Tạo API tái sử dụng từ curl · flow nhiều step · trích xuất dữ liệu</span>
 </div>

 <div className="toolbar">
 <Button icon={Icon.plus({})} tooltip="Tạo flow mới từ đầu" variant="primary" onClick={() => setEditing(blank())}>Flow mới</Button>
 <Button icon={Icon.copy({})} tooltip="Tạo flow từ mẫu có sẵn (GitHub, Cloudflare...)" onClick={() => setPresetOpen(true)}>Tạo từ mẫu</Button>
 </div>

 {templates.length === 0 ? (
 <p className="empty">Chưa có template. Bấm "Flow mới" hoặc "Tạo từ mẫu".</p>
 ) : (
 <table className="table">
 <thead><tr><th>Tên</th><th>Service</th><th>Business</th><th>Steps</th><th></th></tr></thead>
 <tbody>
 {templates.map((t) => (
 <tr key={t.id}>
 <td>{t.name}</td>
 <td>{t.service}</td>
 <td>{t.business}</td>
 <td>{t.steps?.length ?? 0}</td>
 <td className="row-actions">
 <Button iconOnly icon={Icon.play({})} tooltip="Execute flow này" onClick={() => execute(t)} />
 <Button iconOnly icon={Icon.edit({})} tooltip="Sửa flow" onClick={() => setEditing(t)} />
 <Button iconOnly icon={Icon.trash({})} tooltip="Xóa flow" variant="danger" onClick={() => del(t)} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}

 {editing && <BuilderModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); loadPresets(); }} ui={ui} />}
 {executing && ownerId && <ExecuteModal template={executing} ownerId={ownerId} onClose={() => setExecuting(null)} ui={ui} />}
 {presetOpen && (
 <Modal title="Tạo từ mẫu" onClose={() => setPresetOpen(false)} footer={<Button variant="ghost" tooltip="Đóng" onClick={() => setPresetOpen(false)}>Đóng</Button>}>
 {presets.length === 0 ? <p className="empty">Chưa có mẫu nào trong database.</p> : (
 <div className="sel-list">
 {presets.map((p) => (
 <div className="kv-row" key={p.id}>
 <span className="k">{p.name} <span className="mono">({p.service})</span></span>
 <Button icon={Icon.copy({})} tooltip="Tạo flow mới từ mẫu này" onClick={() => fromPreset(p)}>Dùng mẫu</Button>
 </div>
 ))}
 </div>
 )}
 </Modal>
 )}
 </div>
 );
}

function BuilderModal({ initial, onClose, onSaved, ui }: { initial: FetchTemplate; onClose: () => void; onSaved: () => void; ui: ReturnType<typeof useUI> }) {
 const { ownerId } = useApp();
 const [tpl, setTpl] = useState<FetchTemplate>(structuredClone(initial));
 const [activeStep, setActiveStep] = useState(0);
 const [curlOpen, setCurlOpen] = useState(false);
 const [jsOpen, setJsOpen] = useState(false);
 const [saving, setSaving] = useState(false);

 const patch = (p: Partial<FetchTemplate>) => setTpl((t) => ({ ...t, ...p }));
 const patchStep = (i: number, p: Partial<FlowStep>) => setTpl((t) => { const s = [...t.steps]; s[i] = { ...s[i], ...p }; return { ...t, steps: s }; });
 const addStep = () => { setTpl((t) => ({ ...t, steps: [...t.steps, newStep()] })); setActiveStep(tpl.steps.length); };
 const delStep = (i: number) => setTpl((t) => ({ ...t, steps: t.steps.filter((_, x) => x !== i) }));
 const step = tpl.steps[activeStep];

 const save = async (asPreset = false) => {
 if (!tpl.name.trim() || tpl.steps.length === 0) return ui.notify({ title: 'Thiếu dữ liệu', message: 'Cần tên flow và ít nhất 1 step.', kind: 'warning' });
 setSaving(true);
 try {
 const payload = { name: tpl.name, service: tpl.service, business: tpl.business, stopOnError: tpl.stopOnError, inputs: tpl.inputs, credentialRefs: tpl.credentialRefs, steps: tpl.steps };
 if (asPreset) {
 await api.post('/flow-presets', payload);
 ui.notify({ title: 'Đã lưu thành mẫu', message: tpl.name, kind: 'success' });
 } else if (tpl.id) {
 await api.put(`/templates/${tpl.id}`, payload);
 ui.notify({ title: 'Đã lưu flow', message: tpl.name, kind: 'success' });
 } else {
 await api.post('/templates', payload);
 ui.notify({ title: 'Đã lưu flow', message: tpl.name, kind: 'success' });
 }
 onSaved();
 } catch (e: any) {
 ui.notify({ title: 'Lỗi lưu', message: e.message, kind: 'error' });
 } finally { setSaving(false); }
 };

 return (
 <Modal
 title={tpl.id ? 'Sửa flow' : 'Flow mới'}
 onClose={onClose}
 wide
 footer={
 <>
 <Button variant="ghost" icon={Icon.download({})} tooltip="Nhập nhanh 1 step từ lệnh curl" onClick={() => setCurlOpen(true)}>Từ curl</Button>
 <div className="toolbar__spacer" />
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button icon={Icon.save({})} tooltip="Lưu flow này thành mẫu dùng chung cho owner khác" loading={saving} onClick={() => save(true)}>Lưu thành mẫu</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu flow" loading={saving} onClick={() => save(false)}>Lưu flow</Button>
 </>
 }
 >
 <div className="form-scroll">
 <div className="row">
 <Field label="Tên flow"><Combobox field="flow-name" value={tpl.name} onChange={(v) => patch({ name: v })} placeholder="GitHub - Tạo repo" /></Field>
 <Field label="Service"><Combobox field="service" value={tpl.service} onChange={(v) => patch({ service: v })} placeholder="github.com" /></Field>
 <Field label="Business"><Combobox field="business" value={tpl.business} onChange={(v) => patch({ business: v })} placeholder="create-repo" /></Field>
 </div>

 <InputsEditor inputs={tpl.inputs ?? []} onChange={(inputs) => patch({ inputs })} />

 <div className="row" style={{ alignItems: 'stretch' }}>
 <div style={{ flex: '0 0 200px' }}>
 <label className="field-label">Steps</label>
 {tpl.steps.map((s, i) => (
 <div key={s.id} className={'step-item' + (i === activeStep ? ' running' : '')} onClick={() => setActiveStep(i)} style={{ cursor: 'pointer' }}>
 <span className="badge">{s.method}</span>
 <span style={{ flex: 1 }}>{i + 1}. {s.id}</span>
 <span data-tooltip="Xóa step này" onClick={(e) => { e.stopPropagation(); delStep(i); }} style={{ cursor: 'pointer' }}>{Icon.trash({})}</span>
 </div>
 ))}
 <Button icon={Icon.plus({})} tooltip="Thêm step vào flow" onClick={addStep}>Thêm step</Button>
 </div>
 <div style={{ flex: 1 }}>
 {step ? (
 <StepEditor step={step} ownerId={ownerId} onChange={(p) => patchStep(activeStep, p)} onOpenJs={() => setJsOpen(true)} ui={ui} />
 ) : <p className="empty">Chọn hoặc thêm step.</p>}
 </div>
 </div>
 </div>

 {curlOpen && <CurlModal onClose={() => setCurlOpen(false)} onParsed={(s, refs) => {
 setTpl((t) => ({ ...t, steps: [...t.steps, s], credentialRefs: [...(t.credentialRefs ?? []), ...refs] }));
 setCurlOpen(false);
 }} ui={ui} />}
 {jsOpen && <SandboxModal onClose={() => setJsOpen(false)} ui={ui} />}
 </Modal>
 );
}

function InputsEditor({ inputs, onChange }: { inputs: FlowInput[]; onChange: (v: FlowInput[]) => void }) {
 const add = () => onChange([...inputs, { name: '', source: 'runtime', required: false }]);
 const patch = (i: number, p: Partial<FlowInput>) => { const c = [...inputs]; c[i] = { ...c[i], ...p }; onChange(c); };
 return (
 <div>
 <label className="field-label">Inputs</label>
 {inputs.map((inp, i) => (
 <div className="row" key={i}>
 <input className="input" placeholder="tên input" value={inp.name} onChange={(e) => patch(i, { name: e.target.value })} />
 <select className="select" value={inp.source} onChange={(e) => patch(i, { source: e.target.value as any })} data-tooltip="runtime=hỏi khi chạy; store=lấy từ kho biến; context=từ step trước">
 <option value="runtime">runtime</option>
 <option value="store">store</option>
 <option value="context">context</option>
 </select>
 {inp.source === 'store' && <input className="input" placeholder="varKey" value={inp.varKey ?? ''} onChange={(e) => patch(i, { varKey: e.target.value })} />}
 {inp.source === 'context' && <input className="input" placeholder="stepId.field" value={inp.ref ?? ''} onChange={(e) => patch(i, { ref: e.target.value })} />}
 <button type="button" className="btn btn--icon" data-tooltip="Xóa input" onClick={() => onChange(inputs.filter((_, x) => x !== i))}>{Icon.trash({})}</button>
 </div>
 ))}
 <Button icon={Icon.plus({})} tooltip="Thêm input cho flow" onClick={add}>Thêm input</Button>
 </div>
 );
}

const HEADER_PRESETS: Record<string, string> = {
 'Authorization': 'Bearer {{github.token}}',
 'Content-Type': 'application/json',
 'Accept': 'application/vnd.github+json',
};

function StepEditor({ step, ownerId, onChange, onOpenJs, ui }: { step: FlowStep; ownerId: string | null; onChange: (p: Partial<FlowStep>) => void; onOpenJs: () => void; ui: ReturnType<typeof useUI> }) {
 const headers = step.headers ?? {};
 const hEntries = Object.entries(headers);
 const [bodyFmt, setBodyFmt] = useState<'json' | 'raw'>('json');
 const [keyPickerOpen, setKeyPickerOpen] = useState(false);

 const setHeader = (idx: number, k: string, v: string) => {
 const e = hEntries.map((x) => [...x] as [string, string]);
 e[idx] = [k, v];
 onChange({ headers: Object.fromEntries(e.filter(([kk]) => kk)) });
 };
 const addHeader = (k = '', v = '') => onChange({ headers: { ...headers, [k]: v } });
 const extract = step.extract ?? [];

 const beautify = () => {
 try {
 onChange({ bodyTemplate: JSON.stringify(JSON.parse(step.bodyTemplate || '{}'), null, 2) });
 } catch {
 ui.notify({ title: 'Không beautify được', message: 'Body không phải JSON hợp lệ.', kind: 'warning' });
 }
 };

 const resolvePreview = async () => {
 try {
 const r = await api.post<{ result: string }>('/engine/resolve', { template: step.urlTemplate, scope: {} });
 ui.notify({ title: 'Giá trị resolved (URL)', message: <code>{r.result}</code>, kind: 'info' });
 } catch (e: any) {
 ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' });
 }
 };

 return (
 <div>
 <div className="row">
 <Field label="Method">
 <select className="select" value={step.method} onChange={(e) => onChange({ method: e.target.value })}>
 {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
 </select>
 </Field>
 <Field label="URL template"><Input value={step.urlTemplate} onChange={(e) => onChange({ urlTemplate: e.target.value })} placeholder="https://api.github.com/user/repos" /></Field>
 </div>

 <label className="field-label">Headers</label>
 {hEntries.map(([k, v], i) => (
 <div className="row" key={i}>
 <input className="input" placeholder="header" value={k} onChange={(e) => setHeader(i, e.target.value, v)} />
 <input className="input" placeholder="value" value={v} onChange={(e) => setHeader(i, k, e.target.value)} />
 </div>
 ))}
 <div className="toolbar">
 <Button icon={Icon.plus({})} tooltip="Thêm header trống" onClick={() => addHeader()}>Thêm header</Button>
 <select className="select" style={{ maxWidth: 200 }} data-tooltip="Chèn header preset thường dùng" onChange={(e) => { if (e.target.value) { addHeader(e.target.value, HEADER_PRESETS[e.target.value]); e.target.value = ''; } }}>
 <option value="">+ Preset header…</option>
 {Object.keys(HEADER_PRESETS).map((h) => <option key={h} value={h}>{h}</option>)}
 </select>
 <Button icon={Icon.key({})} tooltip="Chọn credential key → chèn {{key}} placeholder" onClick={() => setKeyPickerOpen(true)}>Chọn key</Button>
 </div>

 <div className="row">
 <Field label="Định dạng body">
 <select className="select" value={bodyFmt} onChange={(e) => setBodyFmt(e.target.value as any)}>
 <option value="json">JSON</option>
 <option value="raw">Raw</option>
 </select>
 </Field>
 <div style={{ display: 'flex', alignItems: 'flex-end' }}>
 {bodyFmt === 'json' && <Button icon={Icon.zap({})} tooltip="Format lại JSON cho dễ đọc" onClick={beautify}>Beautify</Button>}
 </div>
 </div>
 <Field label="Body template"><Textarea rows={5} value={step.bodyTemplate ?? ''} onChange={(e) => onChange({ bodyTemplate: e.target.value })} placeholder={'{ "name": "{{repoName | lower}}" }'} /></Field>
 <p className="page-desc">
 Placeholder: <span className="ph-hint">{'{{credential}}'}</span> <span className="ph-hint">{'{{var.x}}'}</span> <span className="ph-hint">{'{{ctx.step.field}}'}</span> <span className="ph-hint">{'{{input.x | upper}}'}</span>
 {' · '}<a onClick={onOpenJs} style={{ cursor: 'pointer' }}>Test JS sandbox</a>
 {' · '}<a onClick={resolvePreview} style={{ cursor: 'pointer' }}>Xem giá trị resolved (URL)</a>
 </p>

 <label className="field-label">Extract (JSONPath)</label>
 {extract.map((ex, i) => (
 <div className="row" key={i}>
 <input className="input" placeholder="field" value={ex.field} onChange={(e) => { const c = [...extract]; c[i] = { ...c[i], field: e.target.value }; onChange({ extract: c }); }} />
 <input className="input" placeholder="$.path" value={ex.jsonPath} onChange={(e) => { const c = [...extract]; c[i] = { ...c[i], jsonPath: e.target.value }; onChange({ extract: c }); }} />
 <input className="input" placeholder="pinToVar (tùy chọn)" value={ex.pinToVar ?? ''} onChange={(e) => { const c = [...extract]; c[i] = { ...c[i], pinToVar: e.target.value || undefined }; onChange({ extract: c }); }} />
 <button type="button" className="btn btn--icon" data-tooltip="Xóa extract" onClick={() => onChange({ extract: extract.filter((_, x) => x !== i) })}>{Icon.trash({})}</button>
 </div>
 ))}
 <Button icon={Icon.plus({})} tooltip="Thêm rule trích xuất" onClick={() => onChange({ extract: [...extract, { field: '', jsonPath: '' }] })}>Thêm extract</Button>

 {keyPickerOpen && <KeyPickerModal ownerId={ownerId} onClose={() => setKeyPickerOpen(false)} onPick={(key) => {
 addHeader('Authorization', `Bearer {{${key}}}`);
 setKeyPickerOpen(false);
 ui.notify({ title: 'Đã chèn', message: `Đã thêm header Authorization dùng {{${key}}}`, kind: 'success' });
 }} ui={ui} />}
 </div>
 );
}

function KeyPickerModal({ ownerId, onClose, onPick, ui }: { ownerId: string | null; onClose: () => void; onPick: (key: string) => void; ui: ReturnType<typeof useUI> }) {
 const [keys, setKeys] = useState<{ key: string; service: string }[]>([]);
 useEffect(() => {
 if (!ownerId) return;
 api.get<{ key: string; service: string }[]>(`/owners/${ownerId}/credential-keys`).then(setKeys).catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ownerId]);
 return (
 <Modal title="Chọn credential key" onClose={onClose} footer={<Button variant="ghost" tooltip="Đóng" onClick={onClose}>Đóng</Button>}>
 {!ownerId ? <p className="empty">Chọn owner trước.</p> : keys.length === 0 ? <p className="empty">Owner này chưa có credential.</p> : (
 <div className="sel-list">
 {keys.map((k) => (
 <div className="kv-row" key={k.key}>
 <span className="k mono">{k.key} <span className="badge">{k.service}</span></span>
 <Button icon={Icon.plus({})} tooltip={`Chèn {{${k.key}}} vào header Authorization`} onClick={() => onPick(k.key)}>Chèn</Button>
 </div>
 ))}
 </div>
 )}
 </Modal>
 );
}

function CurlModal({ onClose, onParsed, ui }: { onClose: () => void; onParsed: (s: FlowStep, refs: { placeholder: string; key: string }[]) => void; ui: ReturnType<typeof useUI> }) {
 const [curl, setCurl] = useState('');
 const [busy, setBusy] = useState(false);
 const parse = async () => {
 setBusy(true);
 try {
 const r = await api.post<{ step: FlowStep; credentialRefs: { placeholder: string; key: string }[] }>('/templates/parse-curl', { curl });
 ui.notify({ title: 'Parse thành công', message: `${r.step.method} ${r.step.urlTemplate}`, kind: 'success' });
 onParsed(r.step, r.credentialRefs);
 } catch (e: any) { ui.notify({ title: 'Lỗi parse', message: e.message, kind: 'error' }); }
 finally { setBusy(false); }
 };
 return (
 <Modal title="Nhập từ curl" onClose={onClose} wide footer={<>
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.download({})} tooltip="Parse curl thành step" loading={busy} onClick={parse}>Parse</Button>
 </>}>
 <Textarea rows={6} value={curl} onChange={(e) => setCurl(e.target.value)} placeholder={`curl -X POST https://api.github.com/user/repos -H "Authorization: Bearer TOKEN" -d '{"name":"demo"}'`} />
 </Modal>
 );
}

function SandboxModal({ onClose, ui }: { onClose: () => void; ui: ReturnType<typeof useUI> }) {
 const [code, setCode] = useState("return (inputs.repoName || 'repo').replace(/\\s+/g,'-').toLowerCase();");
 const [result, setResult] = useState('');
 const test = async () => {
 try {
 const r = await api.post<{ result?: string; error?: string }>('/engine/sandbox-test', { code, inputs: { repoName: 'My Repo' } });
 if (r.error) { setResult(''); ui.notify({ title: 'Sandbox lỗi', message: r.error, kind: 'error' }); }
 else setResult(r.result ?? '');
 } catch (e: any) { ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }); }
 };
 return (
 <Modal title="Test JS sandbox" onClose={onClose} wide footer={<>
 <Button variant="ghost" tooltip="Đóng" onClick={onClose}>Đóng</Button>
 <Button variant="primary" icon={Icon.play({})} tooltip="Chạy thử trong sandbox" onClick={test}>Test</Button>
 </>}>
 <span className="sandbox-badge">Chạy trong sandbox: cấm network/fs, timeout 200ms</span>
 <Textarea rows={5} value={code} onChange={(e) => setCode(e.target.value)} />
 {result !== '' && <p>Kết quả: <code>{result}</code></p>}
 </Modal>
 );
}
