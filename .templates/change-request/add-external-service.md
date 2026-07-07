# [SERVICE] Thêm hỗ trợ gọi API cho `<service>`

> Kế thừa `.templates/change-request/TEMPLATE_change-request.md`.
> Dùng khi thêm dịch vụ API ngoài (docs/curl/endpoint) để gọi.

## Bắt buộc
- [ ] Tạo `docs/services/<service>.md` theo `docs/services/_TEMPLATE.md`
- [ ] Nếu cần model/UI quản lý docs-api-curl: theo biến thể `feature-new.md`
- [ ] Bổ sung ví dụ curl → parse-curl → template flow chạy được
- [ ] Field trích (extract) mẫu + biến pin

## File thường ảnh hưởng
- `docs/services/<service>.md` (mới)
- (nếu thành feature) `src/modules/stores.ts` · `src/routes/routes.ts` · `src/api/api.ts` · page mới + `docker/database.rules.json`

## Cập nhật ngược
- [ ] Thêm service vào bảng "dịch vụ đã hỗ trợ" (README thư mục `docs/services/`)
