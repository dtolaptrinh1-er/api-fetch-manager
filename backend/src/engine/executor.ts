/**
 * executor.ts — Fetch Executor (PLAN Bước 1.5, [SYS] 10.1, 10.2, 4.2)
 *
 * Chạy flow gồm nhiều step tuần tự:
 *  1. Khởi tạo context từ inputs (runtime → truyền vào; store → lấy từ rtdb-variables;
 *     context → từ step trước).
 *  2. Mỗi step: resolve placeholder (credential/var/ctx/input + transform) → gọi HTTP
 *     → extract output vào ctx[stepId].
 *  3. Field có pinToVar → ghi vào rtdb-variables + lưu extraction record.
 *  4. stopOnError=true → dừng + ghi log chi tiết khi step lỗi.
 *  5. Lưu history mỗi step (kèm flowId, stepId).
 *
 * Bảo mật: không log plaintext credential; body/summary trong log được che token.
 */

import type { AppContext } from '../context.js';
import type { FetchTemplate, HistoryEntry } from '../lib/types.js';
import { resolveTemplate, resolveDeep, type ResolveScope } from './placeholder.js';
import { runExtract } from './extract.js';
import { now } from '../lib/ids.js';
import * as store from '../modules/stores.js';


export interface ExecuteResult {
  ok: boolean;
  ctx: Record<string, unknown>;
  steps: {
    stepId: string;
    status: number;
    success: boolean;
    durationMs: number;
    extracted?: Record<string, unknown>;
    error?: string;
  }[];
  error?: string;
}

/** Che các token dạng Bearer/token trong string trước khi ghi log. */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 2_000);
}

async function fetchStepWithPolicy(
  httpFetch: typeof fetch,
  url: string,
  init: RequestInit,
  policy: { timeoutMs: number; retries: number; maxResponseBytes: number },
): Promise<{ status: number; ok: boolean; text: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
    try {
      const resp = await httpFetch(url, { ...init, signal: controller.signal });
      const len = resp.headers?.get?.('content-length');
      if (len && Number(len) > policy.maxResponseBytes) {
        throw new Error(`Response vượt quá giới hạn ${policy.maxResponseBytes} bytes`);
      }
      const text = await resp.text();
      if (Buffer.byteLength(text, 'utf8') > policy.maxResponseBytes) {
        throw new Error(`Response vượt quá giới hạn ${policy.maxResponseBytes} bytes`);
      }
      if ((resp.status === 429 || resp.status >= 500) && attempt < policy.retries) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      return { status: resp.status, ok: resp.ok, text };
    } catch (e: any) {
      lastError = e?.name === 'AbortError' ? new Error(`HTTP timeout sau ${policy.timeoutMs}ms`) : e;
      if (attempt < policy.retries) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function redact(s: string): string {
  if (!s) return s;
  return s
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***')
    .replace(/(token\s+)[A-Za-z0-9._-]+/gi, '$1***')
    .replace(/(gh[pousr]_)[A-Za-z0-9]+/g, '$1***')
    .replace(/(sbp_)[A-Za-z0-9_]+/g, '$1***');
}

export async function executeFlow(
  ctx: AppContext,
  opts: { ownerId: string; template: FetchTemplate; runtimeInputs?: Record<string, unknown> },
  httpFetch: typeof fetch = fetch,
): Promise<ExecuteResult> {
  const { ownerId, template } = opts;
  const runtimeInputs = opts.runtimeInputs ?? {};
  const httpPolicy = {
    timeoutMs: ctx.config.httpTimeoutMs,
    retries: ctx.config.httpRetries,
    maxResponseBytes: ctx.config.httpMaxResponseBytes,
  };

  // 1. Khởi tạo inputs từ nguồn.
  const inputs: Record<string, unknown> = {};
  const vars = await store.resolveVars(ctx, ownerId);
  for (const inp of template.inputs ?? []) {
    if (inp.source === 'runtime') inputs[inp.name] = runtimeInputs[inp.name];
    else if (inp.source === 'store' && inp.varKey) inputs[inp.name] = vars[inp.varKey];
    // 'context' resolve sau, trong lúc chạy step (ctx đã có).
    if (inp.required && (inputs[inp.name] === undefined || inputs[inp.name] === '')) {
      // context sẽ được điền sau, nên chỉ chặn runtime/store bắt buộc.
      if (inp.source !== 'context') {
        return { ok: false, ctx: {}, steps: [], error: `Thiếu input bắt buộc: ${inp.name}` };
      }
    }
  }

  // credential map: gom key từ credentialRefs.
  const credKeys = (template.credentialRefs ?? []).map((r) => r.key);
  const credentials = await store.resolveCredentialsByKey(ctx, ownerId, credKeys);

  const flowCtx: Record<string, unknown> = {};
  const result: ExecuteResult = { ok: true, ctx: flowCtx, steps: [] };

  for (const step of template.steps) {
    const scope: ResolveScope = { credentials, vars, ctx: flowCtx, inputs };
    const startedAt = now();
    const url = resolveTemplate(step.urlTemplate, scope);
    const headers = resolveDeep(step.headers ?? {}, scope) as Record<string, string>;
    const body = step.bodyTemplate ? resolveTemplate(step.bodyTemplate, scope) : undefined;

    let status = 0;
    let success = false;
    let responseText = '';
    let parsed: unknown = null;
    let errMsg: string | undefined;

    try {
      const resp = await fetchStepWithPolicy(httpFetch, url, {
        method: step.method,
        headers,
        body: ['GET', 'HEAD'].includes(step.method.toUpperCase()) ? undefined : body,
      }, httpPolicy);
      status = resp.status;
      responseText = resp.text;
      success = resp.ok;
      try {
        parsed = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsed = responseText;
      }
      if (!resp.ok) errMsg = `HTTP ${status}`;
    } catch (e: any) {
      errMsg = e?.message ?? String(e);
      success = false;
    }

    const durationMs = now() - startedAt;

    // 2. Extract vào ctx[stepId].
    let extracted: Record<string, unknown> | undefined;
    if (success && step.extract && step.extract.length > 0) {
      const ex = runExtract(parsed, step.extract);
      extracted = ex.values;
      flowCtx[step.id] = ex.values;
      // 3. Pin vào biến + lưu extraction record.
      for (const pin of ex.pins) {
        await store.setVariable(ctx, ownerId, pin.varKey, pin.value, 'extracted');
      }
      for (const rule of step.extract) {
        await store.addExtraction(ctx, {
          ownerId,
          service: template.service,
          templateId: template.id,
          templateName: template.name,
          field: rule.field,
          value: ex.values[rule.field],
          jsonPath: rule.jsonPath,
          createdAt: now(),
        });
      }
    } else if (success) {
      flowCtx[step.id] = parsed;
    }

    // 5. Lưu history.
    const historyEntry: HistoryEntry = {
      service: template.service,
      endpointId: template.id,
      flowId: template.id,
      stepId: step.id,
      method: step.method,
      url,
      requestSummary: {
        headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, redact(String(v))])),
        bodyPreview: redact((body ?? '').slice(0, 500)),
      },
      responseStatus: status,
      responseSummary: redact(responseText.slice(0, 500)),
      durationMs,
      success,
      calledAt: now(),
    };
    const historyId = await store.addHistory(ctx, ownerId, historyEntry);

    result.steps.push({ stepId: step.id, status, success, durationMs, extracted, error: errMsg });

    // 4. Log chi tiết khi lỗi.
    if (!success) {
      await store.addLog(ctx, {
        level: 'error',
        scope: 'fetch-executor',
        service: template.service,
        business: template.business,
        message: errMsg ?? `Step ${step.id} thất bại`,
        detail: {
          stepId: step.id,
          request: { url, method: step.method, headers: historyEntry.requestSummary.headers },
          response: historyEntry.responseSummary,
        },
        historyRef: historyId,
        createdAt: now(),
      });
      if (template.stopOnError !== false) {
        result.ok = false;
        result.error = `Flow dừng tại step "${step.id}": ${errMsg}`;
        return result;
      }
    }
  }

  return result;
}
