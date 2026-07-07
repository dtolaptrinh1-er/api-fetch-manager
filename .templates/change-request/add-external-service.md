# [SERVICE] Thêm hỗ trợ gọi API cho <service>

> Dùng khi thêm dịch vụ API ngoài (docs/curl/endpoint) để gọi.

## Bắt buộc

- [ ] Tạo `docs/services/<service>.md` theo SERVICE_TEMPLATE (page Service Docs)
- [ ] Nếu cần model/UI quản lý docs-api-curl: theo biến thể feature-new
- [ ] Bổ sung ví dụ curl → parse-curl → template flow chạy được
- [ ] Field trích (extract) mẫu + biến pin

## File thường ảnh hưởng

- `docs/services/<service>.md` (mới)
- (nếu thành feature) `stores.ts`/`routes.ts`/`api.ts`/page mới + rules.json

## Cập nhật ngược

- [ ] Thêm service vào bảng "dịch vụ đã hỗ trợ" trong page Service Docs
