import React, { useEffect, useMemo, useState } from 'react';
import { api, type Variable } from '../api/api';
import { useApp } from '../lib/appStore';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Field, Input } from '../components/Field';
import { Icon } from '../components/Icon';
import { DataList, type DataListColumn } from '../components/DataList';

interface VarRow { key: string; value: unknown; updatedAt: number; source: string; }

export function VariablesPage() {
  const { ownerId, owners } = useApp();
  const ui = useUI();
  const [tab, setTab] = useState<'global' | 'owner'>('global');
  const [vars, setVars] = useState<Record<string, Variable>>({});
  const [editOpen, setEditOpen] = useState(false);

  const scope = tab === 'global' ? 'global' : ownerId ?? 'global';
  const ownerEmail = owners.find((o) => o.id === ownerId)?.email;
  const load = async () => setVars(await api.get<Record<string, Variable>>(`/variables?scope=${scope}`));
  useEffect(() => { load().catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' })); /* eslint-disable-next-line */ }, [tab, ownerId]);

  const del = async (key: string) => {
    const okc = await ui.confirm({ title: 'Xóa biến', message: <>Xóa biến <b>{key}</b>?</>, danger: true, confirmLabel: 'Xóa' });
    if (!okc) return;
    await api.del(`/variables?scope=${scope}&key=${encodeURIComponent(key)}`);
    ui.notify({ title: 'Đã xóa', message: key, kind: 'success' });
    load();
  };
  const copyRef = (key: string) => {
    navigator.clipboard.writeText(`{{var.${key}}}`);
    ui.notify({ title: 'Đã copy', message: `{{var.${key}}} — dán vào fetch để dùng lại.`, kind: 'success' });
  };

  const rows: VarRow[] = useMemo(
    () => Object.entries(vars).map(([key, v]) => ({ key, value: v.value, updatedAt: v.updatedAt, source: v.source })),
    [vars],
  );

  const columns: DataListColumn<VarRow>[] = useMemo(() => [
    { key: 'key', header: 'Key', value: (r) => r.key, render: (r) => <span className="mono">{r.key}</span> },
    { key: 'value', header: 'Value', value: (r) => JSON.stringify(r.value), render: (r) => <span className="mono" style={{ display: 'inline-block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{JSON.stringify(r.value)}</span> },
    { key: 'source', header: 'Source', value: (r) => r.source, render: (r) => <span className="badge">{r.source}</span>, width: 110 },
    { key: 'updatedAt', header: 'Cập nhật', value: (r) => r.updatedAt, render: (r) => new Date(r.updatedAt).toLocaleString(), width: 170 },
    {
      key: 'actions', header: '', value: () => '', noExport: true, sortable: false, align: 'right', width: 90,
      render: (r) => (
        <div className="item-actions">
          <Button iconOnly icon={Icon.copy({})} variant="ghost" tooltip="Copy tham chiếu {{var.key}} để dán vào fetch" onClick={() => copyRef(r.key)} />
          <Button iconOnly icon={Icon.trash({})} variant="ghost" tooltip="Xóa biến (cần xác nhận)" onClick={() => del(r.key)} />
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [scope]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Variables</h1>
        <span className="page-desc">Kho biến tái sử dụng · tham chiếu bằng {'{{var.key}}'}</span>
      </div>

      <DataList
        title={`variables-${scope}`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        ownerContext={tab === 'owner' ? ownerEmail : 'global'}
        initialSort={{ key: 'updatedAt', dir: 'desc' }}
        emptyText="Chưa có biến trong scope này."
        toolbarExtra={
          <>
            <Button variant={tab === 'global' ? 'primary' : 'default'} icon={Icon.vars({})} tooltip="Biến dùng chung mọi owner" onClick={() => setTab('global')}>Global</Button>
            <Button variant={tab === 'owner' ? 'primary' : 'default'} icon={Icon.vars({})} tooltip="Biến riêng của owner đang chọn (ưu tiên hơn global)" onClick={() => setTab('owner')} disabled={!ownerId}>Theo owner</Button>
            <Button icon={Icon.plus({})} variant="primary" tooltip="Thêm biến mới vào scope hiện tại" onClick={() => setEditOpen(true)}>Biến mới</Button>
          </>
        }
      />

      {editOpen && <VarModal scope={scope} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} ui={ui} />}
    </div>
  );
}

function VarModal({ scope, onClose, onSaved, ui }: { scope: string; onClose: () => void; onSaved: () => void; ui: ReturnType<typeof useUI> }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!key.trim()) return ui.notify({ title: 'Thiếu key', message: 'Nhập key.', kind: 'warning' });
    setSaving(true);
    try {
      let parsed: unknown = value;
      try { parsed = JSON.parse(value); } catch { /* giữ string */ }
      await api.post('/variables', { scope, key, value: parsed, source: 'manual' });
      ui.notify({ title: 'Đã lưu', message: key, kind: 'success' });
      onSaved();
    } catch (e: any) { ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Thêm/sửa biến" onClose={onClose} footer={<>
      <Button variant="ghost" icon={Icon.x({})} tooltip="Đóng" onClick={onClose}>Hủy</Button>
      <Button variant="primary" icon={Icon.save({})} tooltip="Lưu biến vào scope hiện tại" loading={saving} onClick={save}>Lưu</Button>
    </>}>
      <Field label="Key"><Input className="input mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder="github.lastRepoUrl" /></Field>
      <Field label="Value (JSON hoặc chuỗi)"><Input value={value} onChange={(e) => setValue(e.target.value)} /></Field>
    </Modal>
  );
}
