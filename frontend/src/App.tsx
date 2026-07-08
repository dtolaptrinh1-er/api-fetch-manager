import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './lib/appStore';
import { UIProvider, useUI } from './components/ui';
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

type Page = 'credentials' | 'builder' | 'history' | 'issues' | 'extractions' | 'variables';

const NAV: { id: Page; label: string; icon: React.ReactNode; tip: string }[] = [
 { id: 'credentials', label: 'Credentials', icon: Icon.key({}), tip: 'Quản lý key theo owner' },
 { id: 'builder', label: 'Fetch Builder', icon: Icon.zap({}), tip: 'Tạo & chạy flow API' },
 { id: 'history', label: 'History & Logs', icon: Icon.history({}), tip: 'Lịch sử gọi & log' },
 { id: 'extractions', label: 'Extracted Data', icon: Icon.db({}), tip: 'Dữ liệu trích xuất từ các lần fetch' },
 { id: 'variables', label: 'Variables', icon: Icon.vars({}), tip: 'Kho biến tái sử dụng' },
 { id: 'issues', label: 'Issues', icon: Icon.bug({}), tip: 'Quản lý bug/issue' },
];

/** Parse hotkey dạng 'Ctrl+Shift+J' → matcher. Mặc định Ctrl+Shift+J. */
function makeHotkeyMatcher(spec: string) {
 const parts = spec.toLowerCase().split('+').map((s) => s.trim());
 const need = {
 ctrl: parts.includes('ctrl'),
 shift: parts.includes('shift'),
 alt: parts.includes('alt'),
 meta: parts.includes('meta') || parts.includes('cmd'),
 key: parts.filter((p) => !['ctrl', 'shift', 'alt', 'meta', 'cmd'].includes(p))[0] ?? 'j',
 };
 return (e: KeyboardEvent) =>
 e.ctrlKey === need.ctrl &&
 e.shiftKey === need.shift &&
 e.altKey === need.alt &&
 e.metaKey === need.meta &&
 e.key.toLowerCase() === need.key;
}

function Shell() {
 const { theme, toggleTheme, owners, ownerId, setOwnerId, inspect, setInspect } = useApp();
 const ui = useUI();
 const [page, setPage] = useState<Page>('credentials');
 const [drawer, setDrawer] = useState(false);
 const [tokenOpen, setTokenOpen] = useState(false);
 const [tokenDraft, setTokenDraft] = useState(() => getAdminToken() ?? '');

 // Hotkey toàn cục bật Inspect ([UI] addendum v1.2 §5). Mặc định Ctrl+Shift+J, override env.
 useEffect(() => {
 const spec = (import.meta.env.VITE_API_FETCH_MANAGER_INSPECT_HOTKEY as string) || 'Ctrl+Shift+J';
 const match = makeHotkeyMatcher(spec);
 const onKey = (e: KeyboardEvent) => {
 if (match(e)) {
 e.preventDefault();
 setInspect(true);
 }
 };
 window.addEventListener('keydown', onKey, true);
 return () => window.removeEventListener('keydown', onKey, true);
 }, [setInspect]);

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

 return (
 <div className="app">
 <header className="topbar">
 <button className="btn btn--ghost btn--icon menu-toggle" data-tooltip="Mở menu điều hướng" onClick={() => setDrawer((d) => !d)}>{Icon.menu({})}</button>
 <div className="topbar__logo">🍌 API Fetch Manager</div>
 <div className="topbar__spacer" />
 <select
 className="select"
 style={{ width: 'auto', maxWidth: 220 }}
 value={ownerId ?? ''}
 onChange={(e) => setOwnerId(e.target.value)}
 data-tooltip="Chọn emailOwner đang thao tác (áp dụng cho credential, execute, history...)"
 >
 {owners.length === 0 && <option value="">(chưa có owner)</option>}
 {owners.map((o) => <option key={o.id} value={o.id}>{o.email}</option>)}
 </select>
 <Button iconOnly icon={Icon.key({})} tooltip="Cấu hình Admin API token (lưu trong trình duyệt này)" onClick={() => { setTokenDraft(getAdminToken() ?? ''); setTokenOpen(true); }} />
 <Button iconOnly icon={theme === 'dark' ? Icon.sun({}) : Icon.moon({})} tooltip="Đổi giao diện sáng/tối" onClick={toggleTheme} />
 <Button iconOnly icon={Icon.target({})} tooltip="Bật chế độ Inspect tạo issue (phím tắt Ctrl+Shift+J)" variant={inspect ? 'primary' : 'default'} onClick={() => setInspect(!inspect)} />
 </header>

 <div className="body">
 <nav className={`sidebar ${drawer ? 'open' : ''}`}>
 <div className="sidebar__group-title">Điều hướng</div>
 {NAV.map((n) => (
 <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} data-tooltip={n.tip} onClick={() => { setPage(n.id); setDrawer(false); }}>
 {n.icon} <span>{n.label}</span>
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
 <Button variant="ghost" tooltip="Xoá token khỏi trình duyệt" onClick={() => { setTokenDraft(''); api.clearAdminToken(); setTokenOpen(false); }}>Xoá</Button>
 <Button variant="primary" icon={Icon.save({})} tooltip="Lưu token vào trình duyệt này" onClick={saveToken}>Lưu token</Button>
 </>
 }
 >
 <p className="muted" style={{ textAlign: 'center' }}>Nhập giá trị <code>API_FETCH_MANAGER_ADMIN_TOKEN</code>. Token chỉ lưu trong localStorage của trình duyệt này; có thể cấu hình sẵn bằng <code>VITE_API_FETCH_MANAGER_ADMIN_TOKEN</code> khi build.</p>
 <div className="field field--center">
 <label>Token</label>
 <input className="input" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="Bearer token..." autoComplete="off" />
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
 <Shell />
 </AppProvider>
 </UIProvider>
 );
}
