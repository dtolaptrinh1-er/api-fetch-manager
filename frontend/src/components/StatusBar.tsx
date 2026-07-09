import React, { useEffect, useState } from 'react';
import { api, type AppMeta } from '../api/api';
import { useApp } from '../lib/appStore';

/**
 * StatusBar — thanh trạng thái đáy màn hình (addendum v1.4 §4).
 * Hiển thị: commit (link), thời điểm build, môi trường, storage mode, owner đang active,
 * và trạng thái kết nối backend (dot). Không che nội dung (nằm trong flex column).
 */
function fmtBuildTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function StatusBar() {
  const { owners, ownerId } = useApp();
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<AppMeta>('/meta')
        .then((m) => { if (alive) { setMeta(m); setOnline(true); } })
        .catch(() => { if (alive) setOnline(false); });
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const owner = owners.find((o) => o.id === ownerId);
  const dotClass = online === null ? '' : online ? 'statusbar__dot--ok' : 'statusbar__dot--warn';

  return (
    <footer className="statusbar" role="contentinfo">
      <span className="statusbar__item" data-tooltip={online ? 'Đã kết nối backend' : 'Mất kết nối backend'}>
        <span className={`statusbar__dot ${dotClass}`} />
        {online === null ? 'Đang kiểm tra…' : online ? 'Online' : 'Offline'}
      </span>
      <span className="statusbar__sep">·</span>
      <span className="statusbar__item" data-tooltip="Commit đang chạy (bấm mở trên repo)">
        commit:{' '}
        {meta?.commitUrl ? (
          <a href={meta.commitUrl} target="_blank" rel="noreferrer">{meta.buildShaShort || 'dev'}</a>
        ) : (
          <span className="mono">dev</span>
        )}
      </span>
      <span className="statusbar__sep">·</span>
      <span className="statusbar__item" data-tooltip="Thời điểm build image">
        build: {meta ? fmtBuildTime(meta.buildTime) : '—'}
      </span>
      <span className="statusbar__sep">·</span>
      <span className="statusbar__item statusbar__env" data-tooltip="Môi trường triển khai">
        {meta?.env ?? 'dev'}
      </span>
      <span className="statusbar__sep">·</span>
      <span className="statusbar__item" data-tooltip="Chế độ lưu trữ dữ liệu">
        storage: {meta?.storage ?? '—'}
      </span>
      <span className="statusbar__spacer" />
      <span className="statusbar__item" data-tooltip="Owner đang thao tác">
        owner: {owner ? owner.email : '(chưa chọn)'}
      </span>
      {meta?.version && (
        <>
          <span className="statusbar__sep">·</span>
          <span className="statusbar__item">v{meta.version}</span>
        </>
      )}
    </footer>
  );
}
