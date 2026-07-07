# [FIX] Fetch Builder / Flow / Engine — <mô tả lỗi>

## Khoanh vùng (điền sẵn)

- FE: `src/pages/FetchBuilderPage.tsx` · `features/execute/ExecuteModal.tsx`
- BE: `engine/executor.ts` · `engine/placeholder.ts` · `engine/extract.ts` · `engine/transforms.ts` · `engine/sandbox.ts` · `modules/parse-curl.ts`

## Chú ý đặc thù

- Flow nhiều step + shared context `{{ctx.*}}`; input source runtime/store/context
- Extract JSONPath (nested/mảng/wildcard) + pinToVar
- Placeholder resolve order; transform pipe; sandbox cấm network/fs + timeout
- HTTP policy: timeout/retry/size-limit

## Test hồi quy bắt buộc

- [ ] executor.test (flow 2 step + stopOnError + redact) · extract.test · placeholder.test · sandbox.test xanh
