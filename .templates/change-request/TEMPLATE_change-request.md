# [`<LOẠI>`] `<Tiêu đề ngắn, verb-first>`

## 1. Phân loại
- Loại thay đổi: `feature-new` | `fix` | `refactor` | `add-external-service`
- Module: `backend/engine` | `backend/routes` | `backend/db` | `frontend/pages` | `frontend/components` | `docs`
- Mức ưu tiên: P0 | P1 | P2

## 2. Mong muốn hoàn thành (Definition of Done)
- [ ] Mô tả kết quả kỳ vọng (hành vi quan sát được)
- [ ] Tiêu chí nghiệm thu cụ thể, tick được
- [ ] Không phá quy tắc bất biến trong `AGENTS.md` mục 2

## 3. File/khu vực repo ảnh hưởng (điền trước khi làm)
- [ ] `<path>` — `<lý do đụng>`
- (tham chiếu ma trận `AGENTS.md` mục 3)

## 4. SPEC liên quan (link file thật)
- [REQ] `docs/SPEC-PLAN/00.YEUCAU.md` — §…
- [SYS] `docs/SPEC-PLAN/01.SPEC.md` — §…
- [UI]  `docs/SPEC-PLAN/02.SPEC_UI.md` — §…
- [PLAN] `docs/SPEC-PLAN/03.PLAN.md` — bước…

## 5. Test bắt buộc
- [ ] Unit/integration thêm/sửa (path `backend/test/*`)
- [ ] `npm test` xanh · `npm run build` xanh

## 6. Bảo mật
- [ ] Không lộ credential/plaintext · log redact · env đúng prefix

## 7. CẬP NHẬT NGƯỢC khi xong (bắt buộc)
- [ ] Docs/SPEC đã cập nhật: …
- [ ] `.env.example` / `docs/OPERATIONS.md` nếu đổi env
- [ ] Bổ sung file ảnh hưởng MỚI vào template loại này
- [ ] Ghi nhật ký vào `docs/SPEC-PLAN/04.PROMPT.md`

## 8. Nhật ký thực hiện
- `<ngày>` — `<việc>` — `<lưu ý/cạm bẫy>`
