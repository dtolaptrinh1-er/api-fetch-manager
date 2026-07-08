/**
 * tooltip.ts — Tooltip toàn cục tự định vị ([UI] 4.5, addendum v1.2 §1).
 *
 * Vấn đề cũ: tooltip pseudo `::after` luôn nằm trên + `nowrap` → bị cắt chữ ở mép browser.
 * Giải pháp: 1 listener toàn cục cho mọi [data-tooltip]. Render 1 div `position: fixed`,
 * tự **flip** (trên/dưới) khi chạm mép, **clamp** trong viewport, cho phép wrap.
 * Không phụ thuộc React — self-init khi import (main.tsx).
 */

const GAP = 6;
const MAXW = 280;

let el: HTMLDivElement | null = null;
let current: HTMLElement | null = null;

function ensureEl(): HTMLDivElement {
 if (el) return el;
 el = document.createElement('div');
 el.className = 'afm-tooltip';
 el.setAttribute('role', 'tooltip');
 el.style.position = 'fixed';
 el.style.display = 'none';
 document.body.appendChild(el);
 return el;
}

function show(target: HTMLElement) {
 const text = target.getAttribute('data-tooltip');
 if (!text) return;
 current = target;
 const t = ensureEl();
 t.textContent = text;
 t.style.display = 'block';
 t.style.maxWidth = MAXW + 'px';
 t.style.visibility = 'hidden';

 // đo sau khi có nội dung
 const r = target.getBoundingClientRect();
 const tw = t.offsetWidth;
 const th = t.offsetHeight;
 const vw = window.innerWidth;
 const vh = window.innerHeight;

 // flip dọc: ưu tiên trên, không đủ chỗ thì xuống dưới
 let top = r.top - th - GAP;
 if (top < 4) top = r.bottom + GAP;
 if (top + th > vh - 4) top = Math.max(4, vh - th - 4);

 // canh ngang giữa, clamp trong viewport
 let left = r.left + r.width / 2 - tw / 2;
 left = Math.max(4, Math.min(left, vw - tw - 4));

 t.style.top = Math.round(top) + 'px';
 t.style.left = Math.round(left) + 'px';
 t.style.visibility = 'visible';
}

function hide() {
 current = null;
 if (el) el.style.display = 'none';
}

function onOver(e: Event) {
 const target = (e.target as HTMLElement | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
 if (target && target !== current) show(target);
}
function onOut(e: Event) {
 const target = (e.target as HTMLElement | null)?.closest?.('[data-tooltip]');
 if (target && target === current) hide();
}

if (typeof window !== 'undefined') {
 document.addEventListener('mouseover', onOver, true);
 document.addEventListener('mouseout', onOut, true);
 document.addEventListener('focusin', onOver, true);
 document.addEventListener('focusout', onOut, true);
 // ẩn khi cuộn/resize để tránh tooltip “chết” sai vị trí
 window.addEventListener('scroll', hide, true);
 window.addEventListener('resize', hide, true);
 document.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') hide(); }, true);
}

export {};
