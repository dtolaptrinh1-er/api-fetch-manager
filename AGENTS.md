# AGENTS.md — Luật chơi khi nhiều agent cùng sửa

> Mọi agent (Codex/Claude/…) PHẢI đọc file này trước khi sửa bất cứ thứ gì.
> Mục tiêu: chống "dễ vỡ" khi nhiều agent chỉnh sửa/thêm tính năng. Agent làm đúng luật + tự verify bằng `npm test` / `npm run build` local trước khi commit (dự án chạy máy cá nhân, KHÔNG dùng CI).

## Bảng ký hiệu tài liệu → file

| Ký hiệu | File |
| -------- | ------------------------------ |
| [REQ] | `docs/SPEC-PLAN/00.YEUCAU.md` |
| [SYS] | `docs/SPEC-PLAN/01.SPEC.md` |
| [UI] | `docs/SPEC-PLAN/02.SPEC_UI.md` |
| [UI+] | `docs/SPEC-PLAN/02.SPEC_UI-addendum-v1.2.md` |
| [UI+] | `docs/SPEC-PLAN/02.SPEC_UI-addendum-v1.3.md` (lưu đồ owner-centric + UI Test suite) |
| [UI+] | `docs/SPEC-PLAN/02.SPEC_UI-addendum-v1.4.md` (owner search · status bar · DataList bắt buộc · service tabs) |
| [UI+] | `docs/SPEC-PLAN/02.SPEC_UI-addendum-v1.5.md` (UI Self-Test Mode) |
| [DESIGN] | `docs/SPEC-PLAN/02.SPEC_DESIGN-supabase.md` (palette/tokens áp cho theme) |
| [PLAN] | `docs/SPEC-PLAN/03.PLAN.md` |
| [PROMPT] | `docs/SPEC-PLAN/04.PROMPT.md` |

> **Nguồn chân lý triển khai nâng cấp v2:** page **`01.PROMPT_MASTER`** trên ClickUp (gộp 6 nhóm việc). Các addendum [UI+] v1.3–v1.5 là bản trong-repo tương ứng của page đó. Khi mâu thuẫn: [UI]/[UI+] thắng phần giao diện · [SYS] thắng phần kỹ thuật/dữ liệu · [PLAN] quyết thứ tự & DoD · addendum mới hơn ưu tiên cho mục nó đề cập.

---

## 1. Kiến trúc 1 phút (đọc để không phá nhầm)

```
repo root (monolith Docker)
├── backend  (Node + TS + Fastify)
│   ├── src/config/env.ts     ← MỌI env prefix API_FETCH_MANAGER_, fail-fast
│   ├── src/db/rtdb.ts        ← storage adapter: Memory | File | Firebase(REST+OAuth). Interface Db bất biến
│   ├── src/lib/crypto.ts     ← AES-256-GCM. KHÔNG tự chế crypto
│   ├── src/engine/           ← placeholder · transforms · sandbox · extract · executor
│   ├── src/modules/          ← stores (RTDB logic) · parse-curl
│   └── src/routes/routes.ts  ← REST /api, response chuẩn { ok, data?, error? }
└── frontend (React + TS + Vite)
    ├── src/styles/tokens.css ← design tokens. KHÔNG hardcode màu
    ├── src/components/        ← Button/Modal/Field/Icon/ui (nền tảng UI)
    ├── src/features/          ← execute · inspect
    └── src/pages/             ← Credentials/FetchBuilder/History/Issues/Extractions/Variables
```

**5 RTDB tách biệt:** keys · history · logs · issues · variables (`.indexOn` ở `docker/database.rules.json`).
> **Nâng cấp v2 (theo `01.PROMPT_MASTER`):** thêm **RTDB #6 `rtdb-resources`** cho service/resource động — giữ nguyên bất biến 5 DB cũ + interface `Db`.

---

## 2. Quy tắc BẤT BIẾN (vi phạm = reject)

### Backend

- Mọi env **prefix `API_FETCH_MANAGER_`**, khai báo + validate trong `env.ts`.
- Credential **luôn mã hoá at-rest** (AES-256-GCM). API **không bao giờ** trả plaintext trừ endpoint `/reveal` (đã có audit log).
- Log **không chứa token** (dùng `redact()`), advanced JS **chỉ chạy trong sandbox**.
- Thêm/sửa storage phải **giữ nguyên interface `Db`** để các adapter đồng nhất.
- Response API luôn `{ ok, data?, error? }`.
- Gọi HTTP ngoài phải qua **policy timeout + retry** (đã có ở executor & FirebaseDb).

### Frontend

- **KHÔNG dùng `alert/confirm/prompt`** của browser. Mọi thông báo qua `ui.notify` / `ui.confirm`.
- Modal: có nút ✕, **click ngoài KHÔNG đóng**, tự scrollbar. Dùng component `Modal` sẵn có.
- Mọi button có **icon + tooltip**. Chức năng quan trọng có confirm.
- Mọi màu/spacing qua **CSS variables** trong `tokens.css`. Font mảnh (300–400), spacing 4px.
- Gọi API qua client `api.ts` (đã tự gắn `Authorization` header).
- **[RULE v1.4] Mọi danh sách (table/card) BẮT BUỘC có filter · sort · export data (JSON/CSV) · export PDF** — dùng chung component `DataList`, không tự chế mỗi trang một kiểu.

---

## 3. Ma trận "đụng file X → phải cập nhật Y" (chống vỡ)

| Khi bạn đổi… | Bắt buộc cập nhật kèm |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `routes.ts` (thêm/sửa endpoint) | `frontend/src/api/api.ts` (client + types) · `backend/test/api.test.ts` · [SYS] `docs/SPEC-PLAN/01.SPEC.md` §4 |
| `lib/types.ts` | mọi nơi dùng type + `api.ts` types tương ứng |
| `db/rtdb.ts` (interface Db / schema) | `docker/database.rules.json` (.indexOn) · test adapter · [SYS] `docs/SPEC-PLAN/01.SPEC.md` §3, §10.4 |
| `engine/*` | test trong `backend/test/*` · [SYS] `docs/SPEC-PLAN/01.SPEC.md` §5, §10 |
| `env.ts` (thêm biến) | `.env.example` (đủ 5 mục chú giải) · `docs/OPERATIONS.md` |
| Thêm page/feature FE | `App.tsx` nav · `tokens.css` nếu cần token mới · [UI] `docs/SPEC-PLAN/02.SPEC_UI.md` + addendum liên quan |
| Thêm danh sách mới (list/table) | Dùng `DataList` (filter/sort/export) · [UI+] v1.4 |
| Thêm dịch vụ API ngoài | `docs/services/<tên-service>.md` (theo `docs/services/_TEMPLATE.md`) |
| BẤT KỲ thay đổi nào | Điền + cập nhật Change Request template tương ứng trong `.templates/change-request/` |

---

## 4. Quy trình bắt buộc mỗi thay đổi

1. Tạo task theo template đúng loại trong `.templates/change-request/`.
2. Đọc mục SPEC + file liên quan template chỉ ra.
3. Code + test. Chạy `npm test` + `npm run build` local → phải xanh.
4. Cập nhật ma trận mục 3 (docs/spec/test/service bị ảnh hưởng).
5. **Ghi ngược vào template**: phát hiện file ảnh hưởng mới → bổ sung vào template cho lần sau.
6. Ghi nhật ký vào `docs/SPEC-PLAN/04.PROMPT.md`.
7. PR nhỏ, 1 mục đích. Không trộn refactor lớn với feature.

---

## 5. Session Completion

Khi user yêu cầu **Session Completion**:

- Chỉ tóm tắt các thay đổi trong session hiện tại **chưa commit**. Không nhắc lại thay đổi đã nằm trong commit trước.
- Ghi commit summary trực tiếp vào `.git/.git-o-commit-template`.
- **Không commit**. Để user tự review và commit thủ công.
- Cuối commit message phải có mục **Applying Code Changes**: hướng dẫn ngắn gọn cách developer áp dụng/kiểm tra thay đổi (lệnh chạy, bước verify, lưu ý dữ liệu/env nếu có).

---

## 6. Không được làm

- Không commit secret/khoá thật. Secret trong tài liệu gốc coi như đã lộ → phải rotate.
- Không đổi interface `Db`, response shape, hay modal rules mà không cập nhật toàn bộ nơi liên quan.
- Không thêm dependency nặng nếu chuẩn `node:*` giải quyết được (tiền lệ: dùng REST+JWT thay firebase-admin).
