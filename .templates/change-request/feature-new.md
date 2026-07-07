# [FEATURE] `<tên tính năng>`

> Kế thừa `.templates/change-request/TEMPLATE_change-request.md`.
> SPEC: [SYS] `docs/SPEC-PLAN/01.SPEC.md` · [UI] `docs/SPEC-PLAN/02.SPEC_UI.md` · [PLAN] `docs/SPEC-PLAN/03.PLAN.md`

## File thường ảnh hưởng (điền sẵn theo kiến trúc)
- backend: `src/lib/types.ts` (type mới) · `src/modules/stores.ts` (RTDB logic) · `src/routes/routes.ts` (endpoint) · `backend/test/*`
- frontend: `src/api/api.ts` (client+type) · `src/pages/<Tên>Page.tsx` · `App.tsx` (nav) · `src/styles/tokens.css` (nếu cần)
- storage: nếu thêm DB/nhánh → `src/db/rtdb.ts` + `docker/database.rules.json`
- docs: [SYS] `docs/SPEC-PLAN/01.SPEC.md` + [UI] `docs/SPEC-PLAN/02.SPEC_UI.md` + (nếu có dịch vụ ngoài) `docs/services/*`

## Câu hỏi thiết kế phải trả lời trước
- Thuộc RTDB nào? cần index gì?
- Endpoint mới? shape request/response?
- UI: page mới hay mở rộng page cũ? tuân thủ modal/tooltip/theme?
- Có đụng Fetch Builder / placeholder engine không?
