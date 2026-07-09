import React, { useEffect, useMemo, useState } from 'react';
import { api, type ExtractionRecord } from '../api/api';
import { useApp } from '../lib/appStore';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Input } from '../components/Field';
import { Icon } from '../components/Icon';
import { DataList, type DataListColumn } from '../components/DataList';

export function ExtractionsPage() {
  const { ownerId, owners } = useApp();
  const ui = useUI();
  const [rows, setRows] = useState<ExtractionRecord[]>([]);
  const [service, setService] = useState('');

  const ownerEmail = owners.find((o) => o.id === ownerId)?.email;

  const load = async () => {
    const q = new URLSearchParams();
    if (ownerId) q.set('ownerId', ownerId);
    if (service) q.set('service', service);
    setRows(await api.get<ExtractionRecord[]>(`/extractions?${q}`));
  };
  useEffect(() => { load().catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' })); /* eslint-disable-next-line */ }, [ownerId]);

  const pin = async (r: ExtractionRecord) => {
    const okc = await ui.confirm({ title: 'Pin thành biến?', message: <>Ghi <b>{r.field}</b> vào kho biến (owner scope) để tái sử dụng?</>, confirmLabel: 'Pin' });
    if (!okc) return;
    await api.post('/variables', { scope: ownerId, key: r.field, value: r.value, source: 'extracted' });
    ui.notify({ title: 'Đã pin', message: `${r.field} → {{var.${r.field}}}`, kind: 'success' });
  };

  const columns: DataListColumn<ExtractionRecord>[] = useMemo(() => [
    { key: 'field', header: 'Field', value: (r) => r.field, render: (r) => <span className="mono">{r.field}</span>, width: 150 },
    { key: 'value', header: 'Value', value: (r) => JSON.stringify(r.value), render: (r) => <span className="mono" style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{JSON.stringify(r.value)}</span> },
    { key: 'templateName', header: 'Template', value: (r) => r.templateName },
    { key: 'service', header: 'Service', value: (r) => r.service, width: 130 },
    { key: 'jsonPath', header: 'JSONPath', value: (r) => r.jsonPath, render: (r) => <span className="mono">{r.jsonPath}</span> },
    { key: 'createdAt', header: 'Thời điểm', value: (r) => r.createdAt, render: (r) => new Date(r.createdAt).toLocaleString(), width: 170 },
    {
      key: 'actions', header: '', value: () => '', noExport: true, sortable: false, align: 'right', width: 50,
      render: (r) => <Button iconOnly icon={Icon.pin({})} variant="ghost" tooltip="Pin giá trị này thành biến tái sử dụng (cần xác nhận)" onClick={() => pin(r)} />,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ownerId]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Extracted Data</h1>
        <span className="page-desc">Giá trị trích xuất từ các lần fetch · kèm template nguồn &amp; thời điểm</span>
      </div>
      <DataList
        title="extracted-data"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        ownerContext={ownerEmail}
        initialSort={{ key: 'createdAt', dir: 'desc' }}
        emptyText="Chưa có dữ liệu trích xuất. Execute 1 flow có extract để tạo."
        toolbarExtra={
          <>
            <Input placeholder="lọc service (server)" value={service} onChange={(e) => setService(e.target.value)} style={{ width: 150 }} />
            <Button icon={Icon.zap({})} tooltip="Áp dụng lọc phía server" onClick={() => load().catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }))}>Lọc</Button>
          </>
        }
      />
    </div>
  );
}
