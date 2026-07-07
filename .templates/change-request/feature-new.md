# [FEATURE] <tên tính năng>

> Kế thừa TEMPLATE_change-request.md. Phần bổ sung cho tính năng mới:

## File thường ảnh hưởng (điền sẵn theo kiến trúc)

- backend: `src/lib/types.ts` (type mới) · `src/modules/stores.ts` (RTDB logic) · `src/routes/routes.ts` (endpoint) · test
- frontend: `src/api/api.ts` (client+type) · `src/pages/<New>Page.tsx` · `App.tsx` (nav) · `tokens.css` (nếu cần)
- storage: nếu thêm DB/nhánh → `db/rtdb.ts` + `docker/database.rules.json`
- docs: SPEC tổng thể + SPEC_UI + (nếu có dịch vụ ngoài) `docs/services/*`

## Câu hỏi thiết kế phải trả lời trước

- Thuộc RTDB nào? cần index gì?
- Endpoint mới? shape request/response?
- UI: page mới hay mở rộng page cũ? tuân thủ modal/tooltip/theme?
- Có đụng Fetch Builder / placeholder engine không?
