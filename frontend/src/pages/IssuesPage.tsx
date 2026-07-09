import React, { useEffect, useMemo, useState } from 'react';
import { api, type Issue } from '../api/api';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Field, Input, Textarea, Select } from '../components/Field';
import { Icon } from '../components/Icon';
import { DataList, type DataListColumn } from '../components/DataList';

export function IssuesPage() {
  const ui = useUI();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Issue | null>(null);

  const load = async () => {
    const q = new URLSearchParams();
    if (type) q.set('type', type);
    if (status) q.set('status', status);
    setIssues(await api.get<Issue[]>(`/issues?${q}`));
  };
  useEffect(() => { load().catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' })); /* eslint-disable-next-line */ }, [type, status]);

  const del = async (i: Issue) => {
    const okc = await ui.confirm({ title: 'Xóa issue', message: <>Xóa <b>{i.title}</b>?</>, danger: true, confirmLabel: 'Xóa' });
    if (!okc) return;
    await api.del(`/issues/${i.id}`);
    ui.notify({ title: 'Đã xóa', message: i.title, kind: 'success' });
    load();
  };

  const markdown = async (i: Issue, copy: boolean) => {
    const { markdown } = await api.get<{ markdown: string }>(`/issues/${i.id}/markdown`);
    if (copy) {
      navigator.clipboard.writeText(markdown);
      ui.notify({ title: 'Đã copy Markdown', message: 'Nội dung issue (Markdown) đã copy để giao cho agent.', kind: 'success' });
    } else {
      ui.notify({ title: 'Markdown', message: <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{markdown}</pre>, kind: 'info' });
    }
  };

  const blank = (): Issue => ({ id: '', type: 'bug', title: '', description: '', expectedResult: '', status: 'open', elements: [], createdAt: 0, updatedAt: 0 });

  const columns: DataListColumn<Issue>[] = useMemo(() => [
    { key: 'type', header: 'Loại', value: (i) => i.type, render: (i) => <span className={`badge ${i.type === 'bug' ? 'badge--danger' : 'badge--primary'}`}>{i.type}</span>, width: 90 },
    { key: 'title', header: 'Tiêu đề', value: (i) => i.title },
    { key: 'status', header: 'Status', value: (i) => i.status, render: (i) => <span className="badge">{i.status}</span>, width: 120 },
    { key: 'elements', header: 'Elements', value: (i) => i.elements?.length ?? 0, align: 'right', width: 90 },
    { key: 'createdAt', header: 'Tạo lúc', value: (i) => i.createdAt, render: (i) => (i.createdAt ? new Date(i.createdAt).toLocaleString() : '—'), width: 170 },
    {
      key: 'actions', header: '', value: () => '', noExport: true, sortable: false, align: 'right', width: 160,
      render: (i) => (
        <div className="item-actions">
          <Button iconOnly icon={Icon.copy({})} variant="ghost" tooltip="Copy Markdown để giao cho agent thực hiện" onClick={() => markdown(i, true)} />
          <Button iconOnly icon={Icon.list({})} variant="ghost" tooltip="Xem Markdown export" onClick={() => markdown(i, false)} />
          <Button iconOnly icon={Icon.edit({})} variant="ghost" tooltip="Sửa issue" onClick={() => setEditing(i)} />
          <Button iconOnly icon={Icon.trash({})} variant="ghost" tooltip="Xóa issue (cần xác nhận)" onClick={() => del(i)} />
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Issues</h1>
        <span className="page-desc">Bug / feature / task · tạo từ Inspect Mode hoặc thủ công · export Markdown cho agent</span>
      </div>

      <DataList
        title="issues"
        columns={columns}
        rows={issues}
        rowKey={(i) => i.id}
        initialSort={{ key: 'createdAt', dir: 'desc' }}
        emptyText="Chưa có issue. Bật Inspect Mode (🎯 trên thanh trên) hoặc tạo thủ công."
        toolbarExtra={
          <>
            <Button icon={Icon.plus({})} variant="primary" tooltip="Tạo issue thủ công (bug/feature/task)" onClick={() => setEditing(blank())}>Issue mới</Button>
            <Select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 110 }}>
              <option value="">mọi loại</option><option value="bug">bug</option><option value="feature">feature</option><option value="task">task</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 120 }}>
              <option value="">mọi status</option><option value="open">open</option><option value="in_progress">in_progress</option><option value="resolved">resolved</option><option value="closed">closed</option>
            </Select>
          </>
        }
      />

      {editing && <IssueModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} ui={ui} />}
    </div>
  );
}

function IssueModal({ initial, onClose, onSaved, ui }: { initial: Issue; onClose: () => void; onSaved: () => void; ui: ReturnType<typeof useUI> }) {
  const [issue, setIssue] = useState<Issue>(structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const patch = (p: Partial<Issue>) => setIssue((i) => ({ ...i, ...p }));

  const save = async () => {
    if (!issue.title.trim()) return ui.notify({ title: 'Thiếu tiêu đề', message: 'Nhập tiêu đề.', kind: 'warning' });
    setSaving(true);
    try {
      const body = { type: issue.type, title: issue.title, description: issue.description, expectedResult: issue.expectedResult, status: issue.status, elements: issue.elements };
      if (issue.id) await api.put(`/issues/${issue.id}`, body);
      else await api.post('/issues', body);
      ui.notify({ title: 'Đã lưu', message: issue.title, kind: 'success' });
      onSaved();
    } catch (e: any) { ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={issue.id ? 'Sửa issue' : 'Tạo issue'} onClose={onClose} footer={<>
      <Button variant="ghost" icon={Icon.x({})} tooltip="Đóng, không lưu" onClick={onClose}>Hủy</Button>
      <Button variant="primary" icon={Icon.save({})} tooltip="Lưu issue" loading={saving} onClick={save}>Lưu</Button>
    </>}>
      <div className="form-scroll">
        <div className="row">
          <Field label="Loại">
            <Select value={issue.type} onChange={(e) => patch({ type: e.target.value as any })}>
              <option value="bug">bug</option><option value="feature">feature</option><option value="task">task</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={issue.status} onChange={(e) => patch({ status: e.target.value as any })}>
              <option value="open">open</option><option value="in_progress">in_progress</option><option value="resolved">resolved</option><option value="closed">closed</option>
            </Select>
          </Field>
        </div>
        <Field label="Tiêu đề *"><Input value={issue.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
        <Field label="Mô tả"><Textarea value={issue.description ?? ''} onChange={(e) => patch({ description: e.target.value })} /></Field>
        <Field label="Kết quả mong muốn"><Textarea value={issue.expectedResult ?? ''} onChange={(e) => patch({ expectedResult: e.target.value })} /></Field>
        {issue.elements && issue.elements.length > 0 && (
          <>
            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Element gắn kèm:</label>
            {issue.elements.map((el, i) => <div key={i} className="mono" style={{ color: 'var(--text-muted)' }}>{el.selector}</div>)}
          </>
        )}
      </div>
    </Modal>
  );
}
