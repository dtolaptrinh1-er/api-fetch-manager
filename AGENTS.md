# AGENTS.md — Luật chơi khi nhiều agent cùng sửa

> Mọi agent (Codex/Claude/…) PHẢI đọc file này trước khi sửa bất cứ thứ gì.
> Mục tiêu: chống "dễ vỡ" khi nhiều agent chỉnh sửa/thêm tính năng. Agent làm đúng luật + tự verify bằng `npm test` / `npm run build` local trước khi commit (dự án chạy máy cá nhân, KHÔNG dùng CI).

## Bảng ký hiệu tài liệu → file
| Ký hiệu | File |
|---|---|
| [REQ] | `docs/SPEC-PLAN/00.YEUCAU.md` |
| [SYS] | `docs/SPEC-PLAN/01.SPEC.md` |
| [UI] | `docs/SPEC-PLAN/02.SPEC_UI.md` |
| [PLAN] | `docs/SPEC-PLAN/03.PLAN.md` |
| [PROMPT] | `docs/SPEC-PLAN/04.PROMPT.md` |

---

## 1. Kiến trúc 1 phút (đọc để không phá nhầm)

```
app (monolith Docker)
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

---

## 2. Quy tắc BẤT BIẾN (vi phạm = reject)

### Backend
- Mọi env **prefix `API_FETCH_MANAGER_`**, khai báo + validate trong `env.ts`.
- Credential **luôn mã hoá at-rest** (AES-256-GCM). API **không bao giờ** trả plaintext trừ endpoint `/reveal` (đã có audit log).
- Log **không chứa token** (dùng `redact()`), advanced JS **chỉ chạy trong sandbox**.
- Thêm/sửa storage phải **giữ nguyên interface `Db`** để 3 adapter đồng nhất.
- Response API luôn `{ ok, data?, error? }`.
- Gọi HTTP ngoài phải qua **policy timeout + retry** (đã có ở executor & FirebaseDb).

### Frontend
- **KHÔNG dùng `alert/confirm/prompt`** của browser. Mọi thông báo qua `ui.notify` / `ui.confirm`.
- Modal: có nút ✕, **click ngoài KHÔNG đóng**, tự scrollbar. Dùng component `Modal` sẵn có.
- Mọi button có **icon + tooltip**. Chức năng quan trọng có confirm.
- Mọi màu/spacing qua **CSS variables** trong `tokens.css`. Font mảnh (300–400), spacing 4px.
- Gọi API qua client `api.ts` (đã tự gắn `Authorization` header).

---

## 3. Ma trận "đụng file X → phải cập nhật Y" (chống vỡ)

| Khi bạn đổi… | Bắt buộc cập nhật kèm |
|---|---|
| `routes.ts` (thêm/sửa endpoint) | `frontend/src/api/api.ts` (client + types) · `backend/test/api.test.ts` · [SYS] `docs/SPEC-PLAN/01.SPEC.md` §4 |
| `lib/types.ts` | mọi nơi dùng type + `api.ts` types tương ứng |
| `db/rtdb.ts` (interface Db / schema) | `docker/database.rules.json` (.indexOn) · test adapter · [SYS] `docs/SPEC-PLAN/01.SPEC.md` §3, §10.4 |
| `engine/*` | test trong `backend/test/*` · [SYS] `docs/SPEC-PLAN/01.SPEC.md` §5, §10 |
| `env.ts` (thêm biến) | `.env.example` (đủ 5 mục chú giải) · `docs/OPERATIONS.md` |
| Thêm page/feature FE | `App.tsx` nav · `tokens.css` nếu cần token mới · [UI] `docs/SPEC-PLAN/02.SPEC_UI.md` |
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

## 5. Không được làm
- Không commit secret/khoá thật. Secret trong tài liệu gốc coi như đã lộ → phải rotate.
- Không đổi interface `Db`, response shape, hay modal rules mà không cập nhật toàn bộ nơi liên quan.
- Không thêm dependency nặng nếu chuẩn `node:*` giải quyết được (tiền lệ: dùng REST+JWT thay firebase-admin).
