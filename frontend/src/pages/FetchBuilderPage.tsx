import React, { useEffect, useState } from 'react';
import { api, type FetchTemplate, type FlowStep, type FlowInput } from '../api/api';
import { useApp } from '../lib/appStore';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Field, Input, Textarea, Select } from '../components/Field';
import { Icon } from '../components/Icon';
import { Combobox } from '../components/Combobox';
import { KeyPicker } from '../components/KeyPicker';
import { ExecuteModal } from '../features/execute/ExecuteModal';

type UI = ReturnType<typeof useUI>;

function newStep(): FlowStep {
 return { id: 'step_' + Math.random().toString(36).slice(2, 8), method: 'GET', urlTemplate: '', headers: {}, bodyTemplate: '', extract: [] };
}
function blankTemplate(): FetchTemplate {
 return { id: '', name: '', service: '', business: '', stopOnError: true, inputs: [], credentialRefs: [], steps: [newStep()], createdAt: 0, updatedAt: 0 };
}

export function FetchBuilderPage() {
 const { ownerId } = useApp();
 const ui = useUI();
 const [templates, setTemplates] = useState<FetchTemplate[]>([]);
 const [editing, setEditing] = useState<FetchTemplate | null>(null);
 const [executing, setExecuting] = useState<FetchTemplate | null>(null);
 const [presetOpen, setPresetOpen] = useState(false);

 const load = async () => setTemplates(await api.get<FetchTemplate[]>('/templates'));
 useEffect(() => { load().catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' })); }, []);

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

 return (
 <div>
 <div className="page-head">
 <h1 className="page-title">Fetch Builder</h1>
 <span className="page-desc">Tạo API tái sử dụng từ curl · flow nhiều step · trích xuất dữ liệu · mẫu dùng chung</span>
 </div>

 <div className="toolbar">
 <Button icon={Icon.plus({})} variant="primary" tooltip="Tạo flow mới từ đầu (nhiều step tuần tự)" onClick={() => setEditing(blankTemplate())}>Flow mới</Button>
 <Button icon={Icon.copy({})} tooltip="Tạo flow từ mẫu có sẵn (GitHub, Cloudflare...) — dùng chung nhiều owner" onClick={() => setPresetOpen(true)}>Tạo từ mẫu</Button>
 </div>

 {templates.length === 0 ? (
 <div className="empty">Chưa có template. Bấm "Flow mới" hoặc "Tạo từ mẫu".</div>
 ) : (
 <table className="table">
 <thead><tr><th>Tên</th><th>Service</th><th>Business</th><th>Steps</th><th style={{ width: 130 }}></th></tr></thead>
 <tbody>
 {templates.map((t) => (
 <tr key={t.id}>
 <td>{t.name}</td>
 <td>{t.service}</td>
 <td>{t.business}</td>
 <td>{t.steps?.length ?? 0}</td>
 <td>
 <div className="row" style={{ justifyContent: 'flex-end' }}>
 <Button iconOnly icon={Icon.play({})} variant="ghost" tooltip="Execute flow này (gọi API thật, có thể có side-effect)" onClick={() => execute(t)} />
 <Button iconOnly icon={Icon.edit({})} variant="ghost" tooltip="Sửa flow" onClick={() => setEditing(t)} />
 <Button iconOnly icon={Icon.trash({})} variant="ghost" tooltip="Xóa flow (cần xác nhận)" onClick={() => del(t)} />
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}

 {editing && <BuilderModal initial={editing} ownerId={ownerId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} ui={ui} />}
 {executing && ownerId && <ExecuteModal template={executing} ownerId={ownerId} onClose={() => setExecuting(null)} ui={ui} />}
 {presetOpen && <PresetPickerModal onClose={() => setPresetOpen(false)} onPick={(p) => { setPresetOpen(false); setEditing({ ...blankTemplate(), ...structuredClone(p), id: '', name: p.name + ' (copy)', createdAt: 0, updatedAt: 0 }); }} ui={ui} />}
 </div>
 );
}

/* -------------------- Preset picker (tạo từ mẫu) -------------------- */
function PresetPickerModal({ onClose, onPick, ui }: { onClose: () => void; onPick: (p: FetchTemplate) => void; ui: UI }) {
 const [presets, setPresets] = useState<FetchTemplate[]>([]);
 useEffect(() => {
 api.get<FetchTemplate[]>('/flow-presets').then(setPresets).catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }));
 }, []);
 return (
 <Modal title="Tạo từ mẫu" onClose={onClose} footer={<Button variant="ghost" tooltip="Đóng" onClick={onClose}>Đóng</Button>}>
 {presets.length === 0 ? (
 <div className="empty">Chưa có mẫu nào trong database.</div>
 ) : (
 <div className="sel-list">
 {presets.map((p) => (
 <div className="kv-row" key={p.id}>
 <span className="v">{p.name} <span className="mono">({p.service})</span></span>
 <Button icon={Icon.copy({})} tooltip="Dùng mẫu này để tạo flow mới" onClick={() => onPick(p)}>Dùng mẫu</Button>
 </div>
 ))}
 </div>
 )}
 </Modal>
 );
}

/* -------------------- Builder Modal (2 pane) -------------------- */
function BuilderModal({ initial, ownerId, onClose, onSaved, ui }: { initial: FetchTemplate; ownerId: string | null; onClose: () => void; onSaved: () => void; ui: UI }) {
 const [tpl, setTpl] = useState<FetchTemplate>(structuredClone(initial));
 const [activeStep, setActiveStep] = useState(0);
 const [curlOpen, setCurlOpen] = useState(false);
 const [jsOpen, setJsOpen] = useState(false);
 const [saving, setSaving] = useState(false);

 // Danh mục dùng chung cho 3 field
 const [cat, setCat] = useState<{ flowName: string[]; service: string[]; business: string[] }>({ flowName: [], service: [], business: [] });
 useEffect(() => {
 (async () => {
 const [flowName, service, business] = await Promise.all([
 api.get<string[]>('/catalogs?field=flowName').catch(() => []),
 api.get<string[]>('/catalogs?field=service').catch(() => []),
 api.get<string[]>('/catalogs?field=business').catch(() => []),
 ]);
 setCat({ flowName, service, business });
 })();
 }, []);
 const saveCat = async (field: 'flowName' | 'service' | 'business', value: string) => {
 try {
 const next = await api.post<string[]>('/catalogs', { field, value });
 setCat((c) => ({ ...c, [field]: next }));
 } catch { /* im lặng, không chặn UX */ }
 };

 const patch = (p: Partial<FetchTemplate>) => setTpl((t) => ({ ...t, ...p }));
 const patchStep = (i: number, p: Partial<FlowStep>) => setTpl((t) => { const s = [...t.steps]; s[i] = { ...s[i], ...p }; return { ...t, steps: s }; });
 const addStep = () => { setTpl((t) => ({ ...t, steps: [...t.steps, newStep()] })); setActiveStep(tpl.steps.length); };
 const delStep = (i: number) => setTpl((t) => ({ ...t, steps: t.steps.filter((_, x) => x !== i) }));
 const step = tpl.steps[activeStep];

 const persist = async (asPreset: boolean) => {
 if (!tpl.name.trim() || tpl.steps.length === 0) return ui.notify({ title: 'Thiếu dữ liệu', message: 'Cần tên flow và ít nhất 1 step.', kind: 'warning' });
 setSaving(true);
 try {
 const payload = { name: tpl.name, service: tpl.service, business: tpl.business, stopOnError: tpl.stopOnError, inputs: tpl.inputs, credentialRefs: tpl.credentialRefs, steps: tpl.steps };
 if (asPreset) {
 await api.post('/flow-presets', payload);
 ui.notify({ title: 'Đã lưu thành mẫu', message: tpl.name, kind: 'success' });
 } else {
 if (tpl.id) await api.put(`/templates/${tpl.id}`, payload);
 else await api.post('/templates', payload);
 if (tpl.name) saveCat('flowName', tpl.name);
 if (tpl.service) saveCat('service', tpl.service);
 if (tpl.business) saveCat('business', tpl.business);
 ui.notify({ title: 'Đã lưu flow', message: tpl.name, kind: 'success' });
 onSaved();
 }
 } catch (e: any) {
 ui.notify({ title: 'Lỗi lưu', message: e.message, kind: 'error' });
 } finally { setSaving(false); }
 };

 return (
 <Modal title={tpl.id ? 'Sửa flow' : 'Fetch Flow Builder'} onClose={onClose} wide footer={
 <>
 <Button variant="ghost" icon={Icon.download({})} tooltip="Dán curl để tự sinh 1 step (method/url/header/body)" onClick={() => setCurlOpen(true)}>Từ curl</Button>
 <div style={{ flex: 1 }} />
 <Button variant="ghost" icon={Icon.x({})} tooltip="Đóng, không lưu" onClick={onClose}>Hủy</Button>
 <Button icon={Icon.copy({})} tooltip="Lưu flow này thành mẫu dùng chung cho owner khác" loading={saving} onClick={() => persist(true)}>Lưu thành mẫu</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu toàn bộ flow" loading={saving} onClick={() => persist(false)}>Lưu flow</Button>
 </>
 }>
 <div className="form-scroll">
 <div className="row">
 <Field label="Tên flow"><Combobox value={tpl.name} onChange={(v) => patch({ name: v })} options={cat.flowName} placeholder="GitHub - Tạo repo" onSaveOption={(v) => saveCat('flowName', v)} /></Field>
 <Field label="Service"><Combobox value={tpl.service} onChange={(v) => patch({ service: v })} options={cat.service} placeholder="github.com" onSaveOption={(v) => saveCat('service', v)} /></Field>
 <Field label="Business"><Combobox value={tpl.business} onChange={(v) => patch({ business: v })} options={cat.business} placeholder="create-repo" onSaveOption={(v) => saveCat('business', v)} /></Field>
 </div>

 <InputsEditor inputs={tpl.inputs ?? []} onChange={(inputs) => patch({ inputs })} />

 <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
 {/* Pane trái: steps */}
 <div style={{ width: 180, flex: '0 0 180px' }}>
 <div className="sidebar__group-title">Steps</div>
 {tpl.steps.map((s, i) => (
 <div key={s.id} className={`nav-item ${i === activeStep ? 'active' : ''}`} onClick={() => setActiveStep(i)}>
 <span className="badge badge--primary">{s.method}</span>
 <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{i + 1}. {s.id}</span>
 <span onClick={(e) => { e.stopPropagation(); delStep(i); }} data-tooltip="Xóa step này" style={{ cursor: 'pointer' }}>{Icon.trash({})}</span>
 </div>
 ))}
 <Button icon={Icon.plus({})} variant="ghost" tooltip="Thêm 1 step vào flow" onClick={addStep}>Thêm step</Button>
 </div>

 {/* Pane phải: step editor */}
 <div style={{ flex: 1, minWidth: 0 }}>
 {step ? (
 <StepEditor step={step} ownerId={ownerId} onChange={(p) => patchStep(activeStep, p)} onOpenJs={() => setJsOpen(true)} />
 ) : <div className="empty">Chọn hoặc thêm step.</div>}
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
 <div className="sidebar__group-title">Inputs</div>
 {inputs.map((inp, i) => (
 <div className="row" key={i} style={{ marginBottom: 6 }}>
 <Input placeholder="tên input" value={inp.name} onChange={(e) => patch(i, { name: e.target.value })} />
 <Select value={inp.source} onChange={(e) => patch(i, { source: e.target.value as any })} data-tooltip="runtime=hỏi khi chạy; store=lấy từ kho biến; context=từ step trước">
 <option value="runtime">runtime</option>
 <option value="store">store</option>
 <option value="context">context</option>
 </Select>
 {inp.source === 'store' && <Input placeholder="varKey" value={inp.varKey ?? ''} onChange={(e) => patch(i, { varKey: e.target.value })} />}
 {inp.source === 'context' && <Input placeholder="stepId.field" value={inp.ref ?? ''} onChange={(e) => patch(i, { ref: e.target.value })} />}
 <Button iconOnly icon={Icon.trash({})} variant="ghost" tooltip="Xóa input" onClick={() => onChange(inputs.filter((_, x) => x !== i))} />
 </div>
 ))}
 <Button icon={Icon.plus({})} variant="ghost" tooltip="Thêm input cho flow (runtime/store/context)" onClick={add}>Thêm input</Button>
 </div>
 );
}

const HEADER_PRESETS: { label: string; key: string; value: string }[] = [
 { label: 'Authorization: Bearer', key: 'Authorization', value: 'Bearer {{github.token}}' },
 { label: 'Content-Type: JSON', key: 'Content-Type', value: 'application/json' },
 { label: 'Accept: GitHub', key: 'Accept', value: 'application/vnd.github+json' },
];

function StepEditor({ step, ownerId, onChange, onOpenJs }: { step: FlowStep; ownerId: string | null; onChange: (p: Partial<FlowStep>) => void; onOpenJs: () => void }) {
 const headers = step.headers ?? {};
 const hEntries = Object.entries(headers);
 const extract = step.extract ?? [];
 const [bodyFormat, setBodyFormat] = useState<'json' | 'raw'>('json');

 const setHeader = (idx: number, k: string, v: string) => {
 const e = hEntries.map((x) => [...x] as [string, string]);
 e[idx] = [k, v];
 onChange({ headers: Object.fromEntries(e.filter(([kk]) => kk)) });
 };
 const addHeader = () => onChange({ headers: { ...headers, '': '' } });
 const addPresetHeader = (p: { key: string; value: string }) => onChange({ headers: { ...headers, [p.key]: p.value } });
 const appendUrl = (snippet: string) => onChange({ urlTemplate: (step.urlTemplate ?? '') + snippet });
 const appendBody = (snippet: string) => onChange({ bodyTemplate: (step.bodyTemplate ?? '') + snippet });
 const appendHeaderVal = (idx: number, snippet: string) => { const [k, v] = hEntries[idx]; setHeader(idx, k, (v ?? '') + snippet); };

 const beautify = () => {
 try {
 onChange({ bodyTemplate: JSON.stringify(JSON.parse(step.bodyTemplate || '{}'), null, 2) });
 } catch {
 /* body có placeholder → không parse được, bỏ qua im lặng */
 }
 };

 return (
 <div>
 <div className="row">
 <Field label="Method">
 <Select value={step.method} onChange={(e) => onChange({ method: e.target.value })}>
 {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
 </Select>
 </Field>
 <div style={{ flex: 3 }}>
 <Field label="URL template (hỗ trợ {{...}})">
 <div className="row">
 <Input className="input mono" value={step.urlTemplate} onChange={(e) => onChange({ urlTemplate: e.target.value })} placeholder="https://api.github.com/user/repos" />
 <KeyPicker ownerId={ownerId} onInsert={appendUrl} />
 </div>
 </Field>
 </div>
 </div>

 <div className="sidebar__group-title">Headers</div>
 <div className="toolbar">
 {HEADER_PRESETS.map((p) => (
 <Button key={p.label} tooltip={`Thêm header ${p.label}`} icon={Icon.plus({})} variant="ghost" onClick={() => addPresetHeader(p)}>{p.label}</Button>
 ))}
 </div>
 {hEntries.map(([k, v], i) => (
 <div className="row" key={i}>
 <Input value={k} onChange={(e) => setHeader(i, e.target.value, v)} placeholder="Header" />
 <Input value={v} onChange={(e) => setHeader(i, k, e.target.value)} placeholder="Giá trị (hỗ trợ {{key}})" />
 <KeyPicker ownerId={ownerId} onInsert={(s) => appendHeaderVal(i, s)} />
 </div>
 ))}
 <Button icon={Icon.plus({})} variant="ghost" tooltip="Thêm dòng header" onClick={addHeader}>Thêm header</Button>

 <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
 <Field label="Định dạng body">
 <Select value={bodyFormat} onChange={(e) => setBodyFormat(e.target.value as 'json' | 'raw')}>
 <option value="json">JSON</option>
 <option value="raw">Raw</option>
 </Select>
 </Field>
 <div style={{ flex: 1, display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-end' }}>
 {bodyFormat === 'json' && <Button icon={Icon.zap({})} variant="ghost" tooltip="Beautify: format JSON cho dễ đọc (bỏ qua nếu có placeholder không parse được)" onClick={beautify}>Beautify</Button>}
 <KeyPicker ownerId={ownerId} onInsert={appendBody} />
 <Button icon={Icon.play({})} variant="ghost" tooltip="Test JS sandbox (transform placeholder)" onClick={onOpenJs}>Test JS</Button>
 </div>
 </div>
 <Field label="Body template">
 <Textarea rows={6} value={step.bodyTemplate} onChange={(e) => onChange({ bodyTemplate: e.target.value })} placeholder={'{ "name": "{{repoName | lower}}" }'} />
 </Field>
 <p className="page-desc">Placeholder: <span className="ph-hint">{'{{credential}}'}</span> <span className="ph-hint">{'{{var.x}}'}</span> <span className="ph-hint">{'{{ctx.step.field}}'}</span> <span className="ph-hint">{'{{input.x | upper}}'}</span></p>

 <div className="sidebar__group-title">Extract (JSONPath)</div>
 {extract.map((ex, i) => (
 <div className="row" key={i}>
 <Input value={ex.field} onChange={(e) => { const c = [...extract]; c[i] = { ...c[i], field: e.target.value }; onChange({ extract: c }); }} placeholder="field" />
 <Input value={ex.jsonPath} onChange={(e) => { const c = [...extract]; c[i] = { ...c[i], jsonPath: e.target.value }; onChange({ extract: c }); }} placeholder="$.html_url" />
 <Input value={ex.pinToVar ?? ''} onChange={(e) => { const c = [...extract]; c[i] = { ...c[i], pinToVar: e.target.value || undefined }; onChange({ extract: c }); }} placeholder="pin → var (tuỳ chọn)" />
 <Button iconOnly icon={Icon.trash({})} variant="ghost" tooltip="Xóa dòng extract" onClick={() => onChange({ extract: extract.filter((_, x) => x !== i) })} />
 </div>
 ))}
 <Button icon={Icon.plus({})} variant="ghost" tooltip="Thêm dòng trích xuất JSONPath" onClick={() => onChange({ extract: [...extract, { field: '', jsonPath: '' }] })}>Thêm extract</Button>
 </div>
 );
}

function CurlModal({ onClose, onParsed, ui }: { onClose: () => void; onParsed: (s: FlowStep, refs: { placeholder: string; key: string }[]) => void; ui: UI }) {
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
 <Modal title="Tạo step từ curl" onClose={onClose} wide footer={
 <>
 <Button variant="ghost" tooltip="Hủy" onClick={onClose}>Hủy</Button>
 <Button variant="primary" icon={Icon.download({})} tooltip="Parse curl thành step" loading={busy} onClick={parse}>Parse</Button>
 </>
 }>
 <Textarea rows={6} value={curl} onChange={(e) => setCurl(e.target.value)} placeholder={`curl -X POST https://api.github.com/user/repos -H "Authorization: Bearer TOKEN" -d '{"name":"demo"}'`} />
 </Modal>
 );
}

function SandboxModal({ onClose, ui }: { onClose: () => void; ui: UI }) {
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
 <Modal title="Test JS sandbox" onClose={onClose} footer={
 <>
 <Button variant="ghost" tooltip="Đóng" onClick={onClose}>Đóng</Button>
 <Button variant="primary" icon={Icon.play({})} tooltip="Chạy thử với inputs mẫu" onClick={test}>Test</Button>
 </>
 }>
 <div className="sandbox-badge">Chạy trong sandbox: cấm network/fs, timeout 200ms</div>
 <Textarea rows={4} value={code} onChange={(e) => setCode(e.target.value)} />
 {result !== '' && <p className="mono" style={{ marginTop: 'var(--sp-2)' }}>Kết quả: {result}</p>}
 </Modal>
 );
}
