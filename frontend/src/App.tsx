import React, { useState } from 'react';
import { AppProvider, useApp } from './lib/appStore';
import { UIProvider, useUI } from './components/ui';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { Input } from './components/Field';
import { Icon } from './components/Icon';
import { OwnerCombobox } from './components/OwnerCombobox';
import { StatusBar } from './components/StatusBar';
import { InspectMode } from './features/inspect/InspectMode';
import { DocsProvider, useDocs } from './features/docs/DocsPanel';
import { CredentialsPage } from './pages/CredentialsPage';
import { OwnersPage } from './pages/OwnersPage';
import { FetchBuilderPage } from './pages/FetchBuilderPage';
import { HistoryPage } from './pages/HistoryPage';
import { IssuesPage } from './pages/IssuesPage';
import { ExtractionsPage } from './pages/ExtractionsPage';
import { VariablesPage } from './pages/VariablesPage';
import { ServicesPage } from './pages/ServicesPage';
import { SelfTestPage } from './pages/SelfTestPage';
import { api, getAdminToken } from './api/api';

type Page = 'owners' | 'credentials' | 'builder' | 'services' | 'history' | 'issues' | 'extractions' | 'variables' | 'selftest';

const NAV: { id: Page; label: string; icon: React.ReactNode; tip: string; group: string }[] = [
  { id: 'owners', label: 'Owners', icon: Icon.users({}), tip: 'Quản lý System Owners & môi trường dịch vụ', group: 'Vận hành' },
  { id: 'credentials', label: 'Credentials', icon: Icon.key({}), tip: 'Quản lý key theo owner', group: 'Vận hành' },
  { id: 'builder', label: 'Fetch Builder', icon: Icon.zap({}), tip: 'Tạo & chạy flow API', group: 'Vận hành' },
  { id: 'services', label: 'Services & Resources', icon: Icon.db({}), tip: 'Tài nguyên theo dịch vụ & owner', group: 'Vận hành' },
  { id: 'history', label: 'History & Logs', icon: Icon.history({}), tip: 'Lịch sử gọi & log', group: 'Dữ liệu' },
  { id: 'extractions', label: 'Extracted Data', icon: Icon.list({}), tip: 'Dữ liệu trích xuất từ các lần fetch', group: 'Dữ liệu' },
  { id: 'variables', label: 'Variables', icon: Icon.vars({}), tip: 'Kho biến tái sử dụng', group: 'Dữ liệu' },
  { id: 'issues', label: 'Issues', icon: Icon.bug({}), tip: 'Quản lý bug/issue', group: 'Chất lượng' },
  { id: 'selftest', label: 'Self-Test', icon: Icon.check({}), tip: 'Tự kiểm tra tính năng cốt lõi', group: 'Chất lượng' },
];

function Shell() {
  const { theme, toggleTheme, owners, ownerId, setOwnerId, inspect, setInspect } = useApp();
  const ui = useUI();
  const docs = useDocs();
  const [page, setPage] = useState<Page>('owners');
  const [drawer, setDrawer] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(() => getAdminToken() ?? '');

  const saveToken = () => {
    const trimmed = tokenDraft.trim();
    if (!trimmed) {
      api.clearAdminToken();
      setTokenDraft('');
      ui.notify({ kind: 'warning', title: 'Đã xoá token', message: 'Frontend sẽ không gửi Authorization header cho các API cần bảo vệ.' });
    } else {
      api.setAdminToken(trimmed);
      setTokenDraft(trimmed);
      ui.notify({ kind: 'success', title: 'Đã lưu token', message: 'Các request API tiếp theo sẽ gửi Authorization: Bearer.' });
    }
    setTokenOpen(false);
  };

  const groups = [...new Set(NAV.map((n) => n.group))];
  const activeOwner = owners.find((o) => o.id === ownerId);

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn btn--ghost btn--icon menu-toggle" data-tooltip="Mở menu điều hướng" onClick={() => setDrawer((d) => !d)}>{Icon.menu({})}</button>
        <div className="topbar__logo">🍌 API Fetch Manager</div>
        <div className="topbar__spacer" />
        {activeOwner && (
          <span
            data-tooltip="Owner đang thao tác (context toàn cục)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '2px 10px', borderRadius: 999,
              border: '1px solid var(--border)', background: 'var(--bg-subtle)',
              fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', maxWidth: 220,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flex: '0 0 6px' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeOwner.email}</span>
          </span>
        )}
        <OwnerCombobox owners={owners} ownerId={ownerId} onSelect={setOwnerId} />
        <Button iconOnly icon={Icon.info({})} tooltip="Mở tài liệu dịch vụ (side-panel)" onClick={() => docs.open('github')} />
        <Button iconOnly icon={Icon.key({})} tooltip="Cấu hình Admin API token (bắt buộc khi backend bật auth)" onClick={() => { setTokenDraft(getAdminToken() ?? ''); setTokenOpen(true); }} />
        <Button iconOnly icon={Icon.target({})} tooltip={`Bật chế độ Inspect tạo issue (phím tắt ${(import.meta.env.VITE_API_FETCH_MANAGER_INSPECT_HOTKEY as string) || 'Ctrl+Shift+J'})`} variant={inspect ? 'primary' : 'default'} onClick={() => setInspect(!inspect)} />
        <Button iconOnly icon={theme === 'light' ? Icon.moon({}) : Icon.sun({})} tooltip="Đổi giao diện sáng/tối" onClick={toggleTheme} />
      </header>

      <div className="body">
        <nav className={drawer ? 'sidebar open' : 'sidebar'} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="sidebar__brand" style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--sp-2)' }}>
            <div style={{ color: 'var(--primary)', fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-lg)' }}>API Fetch Manager</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 'var(--fw-medium)' }}>v2 · stitch</div>
          </div>
          {groups.map((g) => (
            <div key={g}>
              <div className="sidebar__group-title">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <button
                  key={n.id}
                  className={n.id === page ? 'nav-item active' : 'nav-item'}
                  data-tooltip={n.tip}
                  onClick={() => { setPage(n.id); setDrawer(false); }}
                >
                  {n.icon} {n.label}
                </button>
              ))}
            </div>
          ))}
          <div
            className="sidebar__health"
            style={{
              marginTop: 'auto', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '10px', fontWeight: 'var(--fw-medium)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>SYSTEM HEALTHY</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
            </div>
            <div className="mono" style={{ color: 'var(--primary)' }}>{activeOwner ? activeOwner.email : 'chưa chọn owner'}</div>
          </div>
        </nav>

        <main className="content">
          <div className="content__inner">
            {page === 'owners' && (
              <OwnersPage
                onGoCredentials={() => setPage('credentials')}
                onGoBuilder={() => setPage('builder')}
                onGoService={() => setPage('services')}
              />
            )}
            {page === 'credentials' && <CredentialsPage />}
            {page === 'builder' && <FetchBuilderPage />}
            {page === 'services' && <ServicesPage onCreateFetchFromItem={() => setPage('builder')} />}
            {page === 'history' && <HistoryPage />}
            {page === 'issues' && <IssuesPage />}
            {page === 'extractions' && <ExtractionsPage />}
            {page === 'variables' && <VariablesPage />}
            {page === 'selftest' && <SelfTestPage />}
          </div>
        </main>
      </div>

      <StatusBar />

      {tokenOpen && (
        <Modal
          title="Admin API token"
          onClose={() => setTokenOpen(false)}
          variant="info"
          footer={
            <>
              <Button variant="ghost" tooltip="Xoá token đã lưu" onClick={() => { setTokenDraft(''); api.clearAdminToken(); setTokenOpen(false); }}>Xoá</Button>
              <Button variant="primary" icon={Icon.save({})} tooltip="Lưu token vào trình duyệt này" onClick={saveToken}>Lưu token</Button>
            </>
          }
        >
          <p className="muted" style={{ textAlign: 'center' }}>Nhập giá trị API_FETCH_MANAGER_ADMIN_TOKEN. Token chỉ lưu trong localStorage của trình duyệt này; có thể cấu hình sẵn bằng VITE_API_FETCH_MANAGER_ADMIN_TOKEN khi build.</p>
          <div className="field field--center">
            <label>Token</label>
            <Input value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="Bearer token..." autoComplete="off" />
          </div>
        </Modal>
      )}

      <InspectMode />
    </div>
  );
}

export default function App() {
  return (
    <UIProvider>
      <AppProvider>
        <DocsProvider>
          <Shell />
        </DocsProvider>
      </AppProvider>
    </UIProvider>
  );
}
