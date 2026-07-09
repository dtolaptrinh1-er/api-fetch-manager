/**
 * types.ts — Kiểu dữ liệu dùng chung backend ([SYS] 3, 5, 10).
 */

export interface Owner {
 id: string;
 email: string;
 isSaveRtdbEmail: boolean;
 createdAt: number;
 updatedAt: number;
}

export interface Credential {
 id: string;
 key: string;
 valueEnc: string;
 iv: string;
 service: string;
 label?: string;
 createdAt: number;
}

/** Credential trả cho FE — LUÔN masked, không có plaintext. */
export interface CredentialMasked {
 id: string;
 key: string;
 service: string;
 label?: string;
 masked: string;
 createdAt: number;
}

export type InputSource = 'runtime' | 'store' | 'context';

export interface FlowInput {
 name: string;
 required?: boolean;
 source: InputSource;
 varKey?: string; // khi source=store
 ref?: string; // khi source=context (stepId.field)
}

export interface ExtractRuleDef {
 field: string;
 jsonPath: string;
 pinToVar?: string;
}

export interface FlowStep {
 id: string;
 method: string;
 urlTemplate: string;
 headers?: Record<string, string>;
 bodyTemplate?: string;
 extract?: ExtractRuleDef[];
}

export interface CredentialRef {
 placeholder: string;
 key: string;
}

export interface FetchTemplate {
 id: string;
 name: string;
 service: string;
 business: string;
 stopOnError?: boolean;
 inputs?: FlowInput[];
 credentialRefs?: CredentialRef[];
 steps: FlowStep[];
 createdAt: number;
 updatedAt: number;
}

/** Định nghĩa flow (không kèm id/timestamp) — dùng cho preset & tạo mới. */
export interface FlowDef {
 name: string;
 service: string;
 business: string;
 stopOnError?: boolean;
 inputs?: FlowInput[];
 credentialRefs?: CredentialRef[];
 steps: FlowStep[];
}

/** Flow preset lưu trong DB, lấy ra tạo flow cho owner khác ([UI] addendum v1.2 §8). */
export interface FlowPreset extends FlowDef {
 id: string;
 isPreset: true;
 createdAt: number;
 updatedAt: number;
}

export interface HistoryEntry {
 service: string;
 endpointId: string;
 flowId?: string;
 stepId?: string;
 method: string;
 url: string;
 requestSummary: { headers: Record<string, string>; bodyPreview: string };
 responseStatus: number;
 responseSummary: string;
 durationMs: number;
 success: boolean;
 calledAt: number;
}

export interface LogEntry {
 level: 'error' | 'warn' | 'info' | 'debug';
 scope: string;
 service: string;
 business: string;
 message: string;
 detail?: Record<string, unknown>;
 historyRef?: string;
 createdAt: number;
}

export interface IssueElement {
 selector: string;
 outerHTML: string;
 /** Text hiển thị của element (innerText cắt gọn) — để user biết đã chọn đúng chức năng. */
 text?: string;
 boundingRect?: Record<string, number>;
}

export interface Issue {
 id: string;
 type: 'bug' | 'feature' | 'task';
 title: string;
 description?: string;
 expectedResult?: string;
 elements?: IssueElement[];
 status: 'open' | 'in_progress' | 'resolved' | 'closed';
 createdAt: number;
 updatedAt: number;
}

export interface Variable {
 value: unknown;
 updatedAt: number;
 source: 'manual' | 'extracted';
}

export interface ExtractionRecord {
 id: string;
 ownerId: string;
 service: string;
 templateId: string;
 templateName: string;
 field: string;
 value: unknown;
 jsonPath: string;
 createdAt: number;
}

/* ---------------- Services & Resources (RTDB #6, addendum v1.4 §5) ---------------- */

/** Định nghĩa 1 dịch vụ trong catalog (tab trong Services & Resources). */
export interface ServiceDef {
 id: string;
 /** host chuẩn hóa, khớp docs/services/<host>.md (VD: github.com). */
 host: string;
 /** Nhãn hiển thị (VD: GitHub). */
 label: string;
 /** Key credential mặc định để gợi ý builder (VD: github.token). */
 credentialKeyHint?: string;
 createdAt: number;
 updatedAt: number;
}

/** 1 resource item thuộc 1 service + owner (VD: 1 repo GitHub, 1 job cron-job.org). */
export interface ResourceItem {
 id: string;
 ownerId: string;
 service: string;
 /** Loại resource (repo, job, zone, dns-record…). */
 resourceType: string;
 /** Nhãn ngắn hiển thị. */
 label: string;
 /** Payload thô của item (dùng để bơm context vào builder / lấy var). */
 data: Record<string, unknown>;
 createdAt: number;
 updatedAt: number;
}

/* ---------------- Self-Test Mode (addendum v1.5) ---------------- */

export interface SelfTestAssertion {
 name: string;
 pass: boolean;
 expected?: unknown;
 actual?: unknown;
}

export interface SelfTestScenarioResult {
 scenarioId: string;
 feature: string;
 title: string;
 /** Text/giá trị capture được từ các element trên form. */
 captured: Record<string, unknown>;
 /** curl sinh ra (cho nhóm fetch), credential đã masked. */
 builtCurl?: string;
 assertions: SelfTestAssertion[];
 result: 'pass' | 'fail';
 elementText?: string;
}

export interface SelfTestRun {
 runId: string;
 scope: string;
 startedAt: number;
 finishedAt: number;
 total: number;
 passed: number;
 failed: number;
 scenarios: SelfTestScenarioResult[];
}

/** Response chuẩn API: { ok, data?, error? } */
export interface ApiOk<T> {
 ok: true;
 data: T;
}
export interface ApiErr {
 ok: false;
 error: string;
}
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export function ok<T>(data: T): ApiOk<T> {
 return { ok: true, data };
}
export function err(message: string): ApiErr {
 return { ok: false, error: message };
}
