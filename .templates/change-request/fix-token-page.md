# [FIX] Trang quản lý token/credential — <mô tả lỗi>

## Khoanh vùng (điền sẵn)

- FE: `src/pages/CredentialsPage.tsx` · `components/Modal`,`Field` · `api.ts`
- BE: `routes.ts` (owners/credentials/reveal) · `modules/stores.ts` · `lib/crypto.ts`
- Bảo mật nhạy cảm: masked, reveal-confirm, không lộ plaintext, audit log

## Tái hiện & kỳ vọng

- Bước tái hiện: …
- Hành vi đúng kỳ vọng: …

## Test hồi quy bắt buộc

- [ ] api.test: ciphertext at-rest + masked + reveal round-trip vẫn xanh
