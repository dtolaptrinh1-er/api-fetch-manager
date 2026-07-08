/**
 * markdown.ts — Sinh Markdown cho issue (PLAN Bước 1.7, [SYS] 6)
 */
import type { Issue } from '../lib/types.js';

export function issueToMarkdown(issue: Issue): string {
 const typeLabel = issue.type.toUpperCase();
 const date = new Date(issue.createdAt).toISOString().slice(0, 10);
 const lines: string[] = [];
 lines.push(`## [${typeLabel}] ${issue.title}`);
 lines.push(`**Status:** ${issue.status} · **Created:** ${date}`);
 if (issue.description) lines.push(`**Description:** ${issue.description}`);
 if (issue.expectedResult) lines.push(`**Expected:** ${issue.expectedResult}`);
 if (issue.elements && issue.elements.length > 0) {
 lines.push(`**Elements:**`);
 issue.elements.forEach((el, i) => {
 const html = (el.outerHTML ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
 const text = (el.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
 const textPart = text ? ` — text: \"${text}\"` : '';
 lines.push(`${i + 1}. \`${el.selector}\`${textPart} — ${html}`);
 });
 }
 return lines.join('\n');
}
