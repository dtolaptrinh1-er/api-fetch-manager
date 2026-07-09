import React from 'react';

/**
 * markdown.tsx — Renderer Markdown tối giản (không dependency nặng, theo AGENTS.md §6).
 * Hỗ trợ: heading, đoạn văn, list, code block (```), inline code, bold, link, bảng đơn giản.
 * Code block render kèm nút "Dùng làm mẫu" nếu là lệnh curl (onUseCurl).
 */

function inline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const push = (n: React.ReactNode) => nodes.push(<React.Fragment key={key++}>{n}</React.Fragment>);
  // Xử lý tuần tự: `code`, **bold**, [text](url)
  const re = /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    if (m.index > 0) push(rest.slice(0, m.index));
    if (m[1]) push(<code>{m[2]}</code>);
    else if (m[3]) push(<strong>{m[4]}</strong>);
    else if (m[5]) push(<a href={m[7]} target="_blank" rel="noreferrer">{m[6]}</a>);
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) push(rest);
  return nodes;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export interface MarkdownHeading {
  level: number;
  text: string;
  id: string;
}

/** Trích danh sách heading (cho mục lục). */
export function extractHeadings(md: string): MarkdownHeading[] {
  const out: MarkdownHeading[] = [];
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), id: slugify(m[2].trim()) });
  }
  return out;
}

export function Markdown({
  source,
  onUseCode,
}: {
  source: string;
  onUseCode?: (code: string, lang: string) => void;
}) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++; }
      i++; // bỏ dòng đóng fence
      const codeStr = code.join('\n');
      blocks.push(
        <pre key={key++}>
          {onUseCode && (
            <button
              className="btn btn--ghost use-curl"
              data-tooltip="Dùng đoạn này làm mẫu trong Fetch Builder"
              onClick={() => onUseCode(codeStr, lang)}
            >
              Dùng mẫu
            </button>
          )}
          <code>{codeStr}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const text = h[2].trim();
      const id = slugify(text);
      const Tag = (`h${lvl}` as unknown) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={key++} id={id}>{inline(text)}</Tag>);
      i++;
      continue;
    }

    // Bảng (| a | b |)
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <table key={key++}>
          <thead><tr>{header.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }

    // List
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(<ul key={key++}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }

    // Dòng trống
    if (line.trim() === '') { i++; continue; }

    // Đoạn văn (gộp các dòng liền nhau)
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|```|\s*[-*]\s|\|)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{inline(para.join(' '))}</p>);
  }

  return <div className="docs-md">{blocks}</div>;
}
