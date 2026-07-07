# [FIX] Fetch Builder / Flow / Engine — `<mô tả lỗi>`

> Kế thừa `.templates/change-request/TEMPLATE_change-request.md`.
> SPEC: [SYS] `docs/SPEC-PLAN/01.SPEC.md` §5, §10 · [UI] `docs/SPEC-PLAN/02.SPEC_UI.md` §10

## Khoanh vùng (điền sẵn)
- FE: `src/pages/FetchBuilderPage.tsx` · `src/features/execute/ExecuteModal.tsx`
- BE: `src/engine/executor.ts` · `placeholder.ts` · `extract.ts` · `transforms.ts` · `sandbox.ts` · `src/modules/parse-curl.ts`

## Chú ý đặc thù
- Flow nhiều step + shared context `{{ctx.*}}`; input source runtime/store/context
- Extract JSONPath (nested/mảng/wildcard) + pinToVar
- Placeholder resolve order; transform pipe; sandbox cấm network/fs + timeout
- HTTP policy: timeout/retry/size-limit

## Test hồi quy bắt buộc
- [ ] `executor.test.ts` (flow 2 step + stopOnError + redact) · `extract.test.ts` · `placeholder.test.ts` · `sandbox.test.ts` xanh
