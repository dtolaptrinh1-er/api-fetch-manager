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
 /** true nếu là mẫu dùng chung (flow-presets), không gắn owner. */
 isPreset?: boolean;
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
 /** Text (innerText) của element đã chọn — để user biết chức năng nào được chọn. */
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
