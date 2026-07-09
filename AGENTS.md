# AGENTS.md — Luật chơi khi nhiều agent cùng sửa

> Mọi agent (Codex/Claude/…) PHẢI đọc file này trước khi sửa bất cứ thứ gì.
> Mục tiêu: chống "dễ vỡ" khi nhiều agent chỉnh sửa/thêm tính năng. Agent làm đúng luật + tự verify bằng `npm test` / `npm run build` local trước khi commit (dự án chạy máy cá nhân, KHÔNG dùng CI).

## Bảng ký hiệu tài liệu → file

| Ký hiệu | File |
| -------- | ------------------------------ |
| [SYS] | `docs/SPEC-PLAN/01.SPEC.md` — đặc tả hệ thống (canonical) |
| [UI] | `docs/SPEC-PLAN/02.SPEC_UI.md` — SPEC_UI hợp nhất v1.2→v1.6 (canonical) |
| [DESIGN] | `stitch_prompt_execution_system/*/code.html` — thiết kế visual chuẩn (dark emerald) |
| [SERVICES] | `docs/services/*.md` — tài liệu API từng dịch vụ |
| [OPS] | `docs/OPERATIONS.md` — vận hành + deploy + smoke + test case |

> **Canonical gọn:** chỉ còn `01.SPEC` (hệ thống) + `02.SPEC_UI` (giao diện) + `docs/services` + `OPERATIONS`. Các tài liệu lịch sử (yêu cầu gốc, plan, prompt master/fix, nhật ký, design spec supabase) nằm trong `docs/_archive/` — tham khảo khi cần, KHÔNG phải luồng chính. Addendum v1.2→v1.6 đã gộp vào `02.SPEC_UI.md` (xem git history nếu cần bản cũ).
> Khi mâu thuẫn: [UI] thắng phần giao diện · [SYS] thắng phần kỹ thuật/dữ liệu.

---

## 1. Kiến trúc 1 phút (đọc để không phá nhầm)

```
repo root (monolith Docker)
├── backend  (Node + TS + Fastify)
│   ├── src/config/env.ts     ← MỌI env prefix API_FETCH_MANAGER_, fail-fast
│   ├── src/db/rtdb.ts        ← storage adapter: Memory | File | Firebase(REST+OAuth). Interface Db bất biến
│   ├── src/lib/crypto.ts     ← AES-256-GCM. KHÔNG tự chế crypto
│   ├── src/engine/           ← placeholder · transforms · sandbox · extract · executor
│   ├── src/modules/          ← stores (RTDB logic) · parse-curl · selftest · docs
│   └── src/routes/routes.ts  ← REST /api, response chuẩn { ok, data?, error? }
└── frontend (React + TS + Vite)
    ├── src/styles/tokens.css ← design tokens. KHÔNG hardcode màu
    ├── src/components/        ← Button/Modal/Field/Icon/DataList/Combobox/KeyPicker/OwnerCombobox/StatusBar
    ├── src/features/          ← execute · inspect · docs
    └── src/pages/             ← Owners/Credentials/FetchBuilder/Services/History/Issues/Extractions/Variables/SelfTest
```

**6 RTDB tách biệt:** keys · history · logs · issues · variables · **resources** (`.indexOn` ở `docker/database.rules.json`).

---

## 2. Quy tắc BẤT BIẾN (vi phạm = reject)

### Backend
- Mọi env **prefix `API_FETCH_MANAGER_`**, khai báo + validate trong `env.ts`.
- Credential **luôn mã hoá at-rest** (AES-256-GCM). API **không bao giờ** trả plaintext trừ `/reveal` (đã có audit log).
- Log **không chứa token** (dùng `redact()`), advanced JS **chỉ chạy trong sandbox**.
- Thêm/sửa storage phải **giữ nguyên interface `Db`**.
- Response API luôn `{ ok, data?, error? }`.
- Gọi HTTP ngoài qua **policy timeout + retry**.
- **credId:** mỗi credential tự sinh `credId`; placeholder map theo credId; key nhiều giá trị → buộc chọn credId; fallback theo key chỉ khi duy nhất 1 giá trị.

### Frontend
- **KHÔNG dùng `alert/confirm/prompt`** browser. Mọi thông báo qua `ui.notify` / `ui.confirm`.
- Modal: nút ✕, **click ngoài KHÔNG đóng**, tự scrollbar.
- Mọi button có **icon + tooltip**. Chức năng quan trọng có confirm.
- Mọi màu/spacing qua **CSS variables** trong `tokens.css`. Font mảnh 300–400, spacing 4px.
- **Mọi danh sách dùng `DataList`** (filter/sort/export JSON/CSV/PDF).
- **Docs dịch vụ KHÔNG che UI** (side-panel).
- Gọi API qua client `api.ts`.

---

## 3. Ma trận "đụng file X → phải cập nhật Y" (chống vỡ)

| Khi bạn đổi… | Bắt buộc cập nhật kèm |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `routes.ts` (thêm/sửa endpoint) | `frontend/src/api/api.ts` (client + types) · `backend/test/api.test.ts` · [SYS] `01.SPEC.md` §4 |
| `lib/types.ts` | mọi nơi dùng type + `api.ts` types |
| `db/rtdb.ts` (interface Db / schema) | `docker/database.rules.json` (.indexOn) · test adapter · [SYS] `01.SPEC.md` §3, §10.4 |
| `engine/*` | test trong `backend/test/*` · [SYS] `01.SPEC.md` §5, §10 |
| `env.ts` (thêm biến) | `.env.example` · `docs/OPERATIONS.md` |
| Thêm page/feature FE | `App.tsx` nav · `tokens.css` nếu cần token mới · [UI] `02.SPEC_UI.md` |
| Thêm danh sách mới (list/table) | Dùng `DataList` (filter/sort/export) · [UI] §12 |
| Thêm/sửa dịch vụ API ngoài | `docs/services/<tên>.md` (curl + tác dụng + response mẫu + link) · docs viewer [UI] §14 |
| BẤT KỲ thay đổi nào | Điền Change Request trong `.templates/change-request/` |

---

## 4. Quy trình bắt buộc mỗi thay đổi

1. Tạo task theo template trong `.templates/change-request/`.
2. Đọc mục SPEC liên quan.
3. Code + test. Chạy `npm test` + `npm run build` local → phải xanh.
4. Cập nhật ma trận mục 3.
5. Ghi ngược vào template nếu phát hiện file ảnh hưởng mới.
6. PR nhỏ, 1 mục đích. Không trộn refactor lớn với feature.

---

## 5. Session Completion
Khi user yêu cầu **Session Completion**: tóm tắt thay đổi chưa commit; ghi commit summary vào `.git/.git-o-commit-template`; KHÔNG commit (user tự review); cuối commit message có mục **Applying Code Changes**.

---

## 6. Không được làm
- Không commit secret/khoá thật. Secret trong tài liệu gốc coi như đã lộ → phải rotate.
- Không đổi interface `Db`, response shape, hay modal rules mà không cập nhật toàn bộ nơi liên quan.
- Không thêm dependency nặng nếu chuẩn `node:*` giải quyết được.
