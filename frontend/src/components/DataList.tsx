import React, { useMemo, useState } from 'react';
import { Button } from './Button';
import { Input, Select } from './Field';
import { Icon } from './Icon';

/**
 * DataList — Danh sách chuẩn hoá dùng chung ([UI+] addendum v1.4 §1, RULE bắt buộc).
 *
 * MỌI danh sách (table/card) trong hệ thống PHẢI dùng component này để có đủ:
 *   - Filter: full-text (mọi cột) + filter theo từng cột.
 *   - Sort: click header đổi asc/desc (đa cột qua nhiều lần click các cột khác nhau).
 *   - Export data: JSON + CSV (chỉ xuất phần đang lọc/sort).
 *   - Export PDF: giữ theme, có tiêu đề + thời điểm + owner context (dùng window.print,
 *     KHÔNG thêm dependency nặng — theo AGENTS.md §6).
 *
 * Mỗi nút có icon + tooltip. Không tự chế list mỗi trang một kiểu.
 */

export interface DataListColumn<T> {
  /** Khóa duy nhất của cột. */
  key: string;
  /** Nhãn hiển thị ở header. */
  header: string;
  /** Lấy giá trị thô để sort/filter/export (string|number|boolean). */
  value: (row: T) => string | number | boolean | null | undefined;
  /** Render tuỳ biến (mặc định = value). */
  render?: (row: T) => React.ReactNode;
  /** Cho phép sort cột này (mặc định true). */
  sortable?: boolean;
  /** Style cho <td>/<th>. */
  width?: number | string;
  /** Căn phải (cho cột action). */
  align?: 'left' | 'right' | 'center';
  /** Loại trừ khỏi export (VD cột action). */
  noExport?: boolean;
}

interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

function toCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(headers: string[], rows: string[][]): string {
  const esc = (s: string) => {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(r.map(esc).join(','));
  // BOM để Excel nhận UTF-8 đúng tiếng Việt.
  return '\uFEFF' + lines.join('\r\n');
}

export function DataList<T>({
  title,
  columns,
  rows,
  rowKey,
  emptyText = 'Không có dữ liệu.',
  ownerContext,
  toolbarExtra,
  initialSort,
  compact,
}: {
  title: string;
  columns: DataListColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyText?: string;
  /** Owner/email đang active — in vào PDF export. */
  ownerContext?: string;
  /** Nút/điều khiển thêm ở toolbar (VD toggle tab). */
  toolbarExtra?: React.ReactNode;
  initialSort?: SortState;
  compact?: boolean;
}) {
  const [q, setQ] = useState('');
  const [colFilterKey, setColFilterKey] = useState('');
  const [colFilterVal, setColFilterVal] = useState('');
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);

  const exportCols = columns.filter((c) => !c.noExport);

  const processed = useMemo(() => {
    let list = rows.slice();

    // Full-text filter (mọi cột export).
    const ql = q.trim().toLowerCase();
    if (ql) {
      list = list.filter((row) =>
        exportCols.some((c) => toCell(c.value(row)).toLowerCase().includes(ql)),
      );
    }

    // Column filter.
    if (colFilterKey && colFilterVal.trim()) {
      const col = columns.find((c) => c.key === colFilterKey);
      if (col) {
        const fv = colFilterVal.trim().toLowerCase();
        list = list.filter((row) => toCell(col.value(row)).toLowerCase().includes(fv));
      }
    }

    // Sort.
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        list.sort((a, b) => {
          const va = col.value(a);
          const vb = col.value(b);
          let cmp: number;
          if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
          else cmp = toCell(va).localeCompare(toCell(vb), undefined, { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return list;
  }, [rows, q, colFilterKey, colFilterVal, sort, columns, exportCols]);

  const clickSort = (col: DataListColumn<T>) => {
    if (col.sortable === false) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null; // click lần 3 → bỏ sort
    });
  };

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const exportJson = () => {
    const data = processed.map((row) => {
      const o: Record<string, unknown> = {};
      for (const c of exportCols) o[c.key] = c.value(row);
      return o;
    });
    download(`${title}-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const exportCsv = () => {
    const headers = exportCols.map((c) => c.header);
    const body = processed.map((row) => exportCols.map((c) => toCell(c.value(row))));
    download(`${title}-${stamp()}.csv`, toCsv(headers, body), 'text/csv;charset=utf-8');
  };

  const exportPdf = () => {
    // In client-side giữ theme: clone dữ liệu ra 1 cửa sổ in mới với CSS theme hiện tại.
    const theme = document.documentElement.getAttribute('data-theme') ?? 'light';
    const headers = exportCols.map((c) => c.header);
    const body = processed.map((row) => exportCols.map((c) => toCell(c.value(row))));
    const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] as string));

    const styleVars = getComputedStyle(document.documentElement);
    const pick = (v: string) => styleVars.getPropertyValue(v).trim();
    const css = `
      :root{color-scheme:${theme === 'dark' ? 'dark' : 'light'}}
      body{font-family:${pick('--font-family') || 'Inter, sans-serif'};background:${pick('--bg') || '#fff'};color:${pick('--text') || '#000'};padding:24px;font-size:12px}
      h1{font-size:18px;font-weight:500;margin:0 0 4px}
      .meta{color:${pick('--text-muted') || '#666'};font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{text-align:left;padding:6px 10px;border-bottom:1px solid ${pick('--border') || '#ddd'};word-break:break-word;vertical-align:top}
      th{text-transform:uppercase;letter-spacing:.03em;color:${pick('--text-muted') || '#666'};font-size:10px}
      @media print{@page{margin:16mm}}
    `;
    const html = `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head>
      <body>
        <h1>${esc(title)}</h1>
        <div class="meta">Xuất lúc: ${esc(new Date().toLocaleString())}${ownerContext ? ' · Owner: ' + esc(ownerContext) : ''} · ${processed.length} dòng</div>
        <table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
      </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="datalist" data-datalist>
      <div className="toolbar datalist__toolbar">
        {toolbarExtra}
        <div className="toolbar__spacer" />
        <Input
          placeholder="Tìm toàn văn…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 180 }}
          aria-label="Tìm toàn văn trong danh sách"
        />
        <Select
          value={colFilterKey}
          onChange={(e) => setColFilterKey(e.target.value)}
          style={{ width: 130 }}
          aria-label="Chọn cột để lọc"
        >
          <option value="">(lọc theo cột)</option>
          {exportCols.map((c) => (
            <option key={c.key} value={c.key}>{c.header}</option>
          ))}
        </Select>
        {colFilterKey && (
          <Input
            placeholder="giá trị cột…"
            value={colFilterVal}
            onChange={(e) => setColFilterVal(e.target.value)}
            style={{ width: 130 }}
            aria-label="Giá trị lọc theo cột"
          />
        )}
        <Button iconOnly icon={Icon.download({})} variant="ghost" tooltip="Export JSON (phần đang lọc/sort)" onClick={exportJson} />
        <Button iconOnly icon={Icon.list({})} variant="ghost" tooltip="Export CSV (mở được bằng Excel)" onClick={exportCsv} />
        <Button iconOnly icon={Icon.save({})} variant="ghost" tooltip="Export PDF (giữ theme, có tiêu đề + thời điểm + owner)" onClick={exportPdf} />
      </div>

      {processed.length === 0 ? (
        <div className="empty">{emptyText}</div>
      ) : (
        <table className={compact ? 'table table--compact' : 'table'}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const sortable = c.sortable !== false && !c.noExport;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width, textAlign: c.align ?? 'left', cursor: sortable ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={sortable ? () => clickSort(c) : undefined}
                    data-tooltip={sortable ? 'Bấm để sort (asc → desc → tắt)' : undefined}
                  >
                    {c.header}
                    {active && <span className="datalist__sort">{sort!.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processed.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((c) => (
                  <td key={c.key} style={{ width: c.width, textAlign: c.align ?? 'left' }}>
                    {c.render ? c.render(row) : toCell(c.value(row))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
