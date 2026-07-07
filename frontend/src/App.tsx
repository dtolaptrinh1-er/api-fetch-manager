import React, { useState } from 'react';
import { AppProvider, useApp } from './lib/appStore';
import { UIProvider } from './components/ui';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { Field, Input } from './components/Field';
import { Icon } from './components/Icon';
import { InspectMode } from './features/inspect/InspectMode';
import { CredentialsPage } from './pages/CredentialsPage';
import { FetchBuilderPage } from './pages/FetchBuilderPage';
import { HistoryPage } from './pages/HistoryPage';
import { IssuesPage } from './pages/IssuesPage';
import { ExtractionsPage } from './pages/ExtractionsPage';
import { VariablesPage } from './pages/VariablesPage';
import { api, getAdminToken } from './api/api';
import { useUI } from './components/ui';

type Page = 'credentials' | 'builder' | 'history' | 'issues' | 'extractions' | 'variables';

const NAV: { id: Page; label: string; icon: React.ReactNode; tip: string }[] = [
  { id: 'credentials', label: 'Credentials', icon: Icon.key({}), tip: 'Quản lý key theo owner' },
  { id: 'builder', label: 'Fetch Builder', icon: Icon.zap({}), tip: 'Tạo & chạy flow API' },
  { id: 'history', label: 'History & Logs', icon: Icon.history({}), tip: 'Lịch sử gọi & log' },
  { id: 'extractions', label: 'Extracted Data', icon: Icon.db({}), tip: 'Dữ liệu trích xuất từ các lần fetch' },
  { id: 'variables', label: 'Variables', icon: Icon.vars({}), tip: 'Kho biến tái sử dụng' },
  { id: 'issues', label: 'Issues', icon: Icon.bug({}), tip: 'Quản lý bug/issue' },
];

function Shell() {
  const { theme, toggleTheme, owners, ownerId, setOwnerId, inspect, setInspect } = useApp();
  const ui = useUI();
  const [page, setPage] = useState<Page>('credentials');
  const [drawer, setDrawer] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(() => getAdminToken() ?? '');
  const hasToken = Boolean(getAdminToken());

  const saveToken = () => {
    const trimmed = tokenDraft.trim();
    if (!trimmed) {
      api.clearAdminToken();
      setTokenDraft('');
      ui.notify({ kind: 'warning', title: 'Đã xoá token', message: 'Frontend sẽ không gửi Authorization header cho các API cần bảo vệ.' });
    } else {
      api.setAdminToken(trimmed);
      setTokenDraft(trimmed);
      ui.notify({ kind: 'success', title: 'Đã lưu token', message: 'Các request API tiếp theo sẽ gửi Authorization: Bearer <token>.' });
    }
    setTokenOpen(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn btn--ghost btn--icon menu-toggle" data-tooltip="Mở/đóng menu điều hướng" onClick={() => setDrawer((d) => !d)}>{Icon.menu({})}</button>
        <span className="topbar__logo">🍌 <span>API Fetch Manager</span></span>
        <div className="topbar__spacer" />
        <select
          className="select"
          style={{ width: 200 }}
          value={ownerId ?? ''}
          onChange={(e) => setOwnerId(e.target.value)}
          data-tooltip="Chọn emailOwner đang thao tác (áp dụng cho credential, execute, history...)"
        >
          {owners.length === 0 && <option value="">(chưa có owner)</option>}
          {owners.map((o) => <option key={o.id} value={o.id}>{o.email}</option>)}
        </select>
        <Button
          iconOnly
          variant={hasToken ? 'primary' : 'ghost'}
          icon={Icon.key({})}
          tooltip={hasToken ? 'Admin token đã được cấu hình cho API request' : 'Nhập admin token để UI gửi Authorization header'}
          onClick={() => { setTokenDraft(getAdminToken() ?? ''); setTokenOpen(true); }}
        />
        <Button
          iconOnly
          variant={inspect ? 'primary' : 'ghost'}
          icon={Icon.target({})}
          tooltip="Bật/tắt chế độ tạo bug/issue từ giao diện (chọn element → tạo issue)"
          onClick={() => setInspect(!inspect)}
        />
        <Button
          iconOnly
          variant="ghost"
          icon={theme === 'light' ? Icon.moon({}) : Icon.sun({})}
          tooltip={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
          onClick={toggleTheme}
        />
      </header>

      <div className="body">
        <nav className={`sidebar ${drawer ? 'open' : ''}`}>
          <div className="sidebar__group-title">Điều hướng</div>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              data-tooltip={n.tip}
              onClick={() => { setPage(n.id); setDrawer(false); }}
            >
              {n.icon}<span>{n.label}</span>
            </button>
          ))}
        </nav>

        <main className="content">
          <div className="content__inner">
            {page === 'credentials' && <CredentialsPage />}
            {page === 'builder' && <FetchBuilderPage />}
            {page === 'history' && <HistoryPage />}
            {page === 'issues' && <IssuesPage />}
            {page === 'extractions' && <ExtractionsPage />}
            {page === 'variables' && <VariablesPage />}
          </div>
        </main>
      </div>


      {tokenOpen && (
        <Modal
          title="Admin API token"
          onClose={() => setTokenOpen(false)}
          variant="info"
          footer={
            <>
              <Button variant="ghost" icon={Icon.trash({})} tooltip="Xoá token khỏi trình duyệt này" onClick={() => { setTokenDraft(''); api.clearAdminToken(); setTokenOpen(false); }}>Xoá</Button>
              <Button variant="primary" icon={Icon.save({})} tooltip="Lưu token và tự động gửi Authorization header cho API" onClick={saveToken}>Lưu token</Button>
            </>
          }
        >
          <p className="muted">Nhập giá trị <code>API_FETCH_MANAGER_ADMIN_TOKEN</code>. Token chỉ lưu trong localStorage của trình duyệt này; có thể cấu hình sẵn bằng <code>VITE_API_FETCH_MANAGER_ADMIN_TOKEN</code> khi build.</p>
          <Field label="Admin token">
            <Input
              type="password"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="Bearer token..."
              autoComplete="off"
            />
          </Field>
        </Modal>
      )}

      <InspectMode />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </AppProvider>
  );
}
