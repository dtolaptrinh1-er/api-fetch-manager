import React, { useEffect, useMemo, useState } from 'react';
import { api, type HistoryEntry, type LogEntry } from '../api/api';
import { useApp } from '../lib/appStore';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Field';
import { Icon } from '../components/Icon';
import { DataList, type DataListColumn } from '../components/DataList';

export function HistoryPage() {
  const { ownerId, owners } = useApp();
  const ui = useUI();
  const [tab, setTab] = useState<'history' | 'logs'>('history');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [service, setService] = useState('');
  const [business, setBusiness] = useState('');
  const [level, setLevel] = useState('');
  const [success, setSuccess] = useState('');

  const ownerEmail = owners.find((o) => o.id === ownerId)?.email;

  const loadHistory = async () => {
    if (!ownerId) return setHistory([]);
    const q = new URLSearchParams({ ownerId });
    if (service) q.set('service', service);
    if (success) q.set('success', success);
    setHistory(await api.get<HistoryEntry[]>(`/history?${q}`));
  };
  const loadLogs = async () => {
    const q = new URLSearchParams();
    if (service) q.set('service', service);
    if (business) q.set('business', business);
    if (level) q.set('level', level);
    setLogs(await api.get<LogEntry[]>(`/logs?${q}`));
  };
  const load = () => (tab === 'history' ? loadHistory() : loadLogs()).catch((e) => ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' }));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, ownerId]);

  const historyCols: DataListColumn<HistoryEntry>[] = useMemo(() => [
    { key: 'calledAt', header: 'Thời điểm', value: (h) => h.calledAt, render: (h) => new Date(h.calledAt).toLocaleString(), width: 170 },
    { key: 'method', header: 'Method', value: (h) => h.method, render: (h) => <span className="badge badge--primary">{h.method}</span>, width: 90 },
    { key: 'service', header: 'Service', value: (h) => h.service, width: 130 },
    { key: 'url', header: 'URL', value: (h) => h.url, render: (h) => <span className="mono" style={{ display: 'inline-block', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{h.url}</span> },
    { key: 'responseStatus', header: 'Status', value: (h) => h.responseStatus, render: (h) => <span className={`badge ${h.success ? 'badge--success' : 'badge--danger'}`}>{h.responseStatus}</span>, width: 90 },
    { key: 'durationMs', header: 'ms', value: (h) => h.durationMs, align: 'right', width: 70 },
  ], []);

  const logCols: DataListColumn<LogEntry>[] = useMemo(() => [
    { key: 'createdAt', header: 'Thời điểm', value: (l) => l.createdAt, render: (l) => new Date(l.createdAt).toLocaleString(), width: 170 },
    { key: 'level', header: 'Level', value: (l) => l.level, render: (l) => <span className={`badge ${l.level === 'error' ? 'badge--danger' : l.level === 'warn' ? 'badge--warning' : 'badge--primary'}`}>{l.level}</span>, width: 90 },
    { key: 'service', header: 'Service', value: (l) => l.service, width: 120 },
    { key: 'business', header: 'Business', value: (l) => l.business, width: 130 },
    { key: 'message', header: 'Message', value: (l) => l.message },
  ], []);

  const filters = (
    <>
      <Button variant={tab === 'history' ? 'primary' : 'default'} icon={Icon.history({})} tooltip="Xem lịch sử request/response theo owner" onClick={() => setTab('history')}>Lịch sử</Button>
      <Button variant={tab === 'logs' ? 'primary' : 'default'} icon={Icon.list({})} tooltip="Xem log chi tiết (lọc theo service/business/level)" onClick={() => setTab('logs')}>Logs</Button>
      <Input placeholder="service (server)" value={service} onChange={(e) => setService(e.target.value)} style={{ width: 120 }} />
      {tab === 'history' ? (
        <Select value={success} onChange={(e) => setSuccess(e.target.value)} style={{ width: 110 }}>
          <option value="">tất cả</option><option value="true">thành công</option><option value="false">lỗi</option>
        </Select>
      ) : (
        <>
          <Input placeholder="business" value={business} onChange={(e) => setBusiness(e.target.value)} style={{ width: 110 }} />
          <Select value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 100 }}>
            <option value="">mọi level</option><option value="error">error</option><option value="warn">warn</option><option value="info">info</option>
          </Select>
        </>
      )}
      <Button icon={Icon.zap({})} tooltip="Áp dụng bộ lọc phía server và tải lại" onClick={load}>Lọc server</Button>
    </>
  );

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">History &amp; Logs</h1>
        <span className="page-desc">Lịch sử gọi API &amp; log chi tiết · lọc / sort / export ngay trên bảng</span>
      </div>

      {tab === 'history' ? (
        <DataList
          title="history"
          columns={historyCols}
          rows={history}
          rowKey={(h) => h.id}
          ownerContext={ownerEmail}
          toolbarExtra={filters}
          initialSort={{ key: 'calledAt', dir: 'desc' }}
          emptyText={ownerId ? 'Chưa có lịch sử. Execute 1 flow để tạo.' : 'Chọn owner để xem lịch sử.'}
        />
      ) : (
        <DataList
          title="logs"
          columns={logCols}
          rows={logs}
          rowKey={(l) => l.id}
          ownerContext={ownerEmail}
          toolbarExtra={filters}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          emptyText="Chưa có log."
        />
      )}
    </div>
  );
}
