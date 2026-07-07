# API Fetch Manager - AGENTS.md (luật chơi cho agent)

# [AGENTS.md](http://AGENTS.md) — Luật chơi khi nhiều agent cùng sửa

> **Commit vào repo tại path:** `/AGENTS.md` (root). Mọi agent (Codex/Claude/…) PHẢI đọc file này trước khi sửa bất cứ thứ gì. Bản ClickUp này là nguồn để đồng bộ; khi repo đổi, cập nhật cả hai.
> **Mục tiêu:** chống "dễ vỡ" khi nhiều agent khác nhau chỉnh sửa/thêm tính năng. Agent làm đúng luật + có lưới an toàn CI.

---

## 1\. Kiến trúc 1 phút (đọc để không phá nhầm)

```plain
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

## 2\. Quy tắc BẤT BIẾN (vi phạm = reject)

### Backend

- Mọi env **prefix** **`API_FETCH_MANAGER_`**, khai báo + validate trong `env.ts`.
- Credential **luôn mã hoá at-rest** (AES-256-GCM). API **không bao giờ** trả plaintext trừ endpoint `/reveal` (đã có audit log).
- Log **không chứa token** (dùng `redact()`), advanced JS **chỉ chạy trong sandbox**.
- Thêm/sửa storage phải **giữ nguyên interface** **`Db`** để 3 adapter đồng nhất.
- Response API luôn `{ ok, data?, error? }`.
- Gọi HTTP ngoài phải qua **policy timeout + retry** (đã có ở executor & FirebaseDb).

### Frontend

- **KHÔNG dùng** **`alert/confirm/prompt`** của browser. Mọi thông báo qua `ui.notify` / `ui.confirm`.
- Modal: có nút ✕, **click ngoài KHÔNG đóng**, tự scrollbar. Dùng component `Modal` sẵn có, không tự dựng.
- Mọi button có **icon + tooltip**. Chức năng quan trọng có confirm.
- Mọi màu/spacing qua **CSS variables** trong `tokens.css`. Font mảnh (300–400), spacing 4px.
- Gọi API qua client `api.ts` (đã tự gắn `Authorization` header).

---

## 3\. Ma trận "đụng file X → phải cập nhật Y" (chống vỡ)

| Khi bạn đổi…                         | Bắt buộc cập nhật kèm                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `routes.ts` (thêm/sửa endpoint)      | `frontend/src/api/api.ts` (client + types) · `backend/test/api.test.ts` · SPEC tổng thể mục 4 |
| `lib/types.ts`                       | mọi nơi dùng type + `api.ts` types tương ứng                                                  |
| `db/rtdb.ts` (interface Db / schema) | `docker/database.rules.json` (.indexOn) · test adapter · SPEC mục 3/10.4                      |
| `engine/*`                           | test tương ứng trong `backend/test/*` · SPEC mục 5/10                                         |
| `env.ts` (thêm biến)                 | `.env.example` (đủ 5 mục chú giải) · `docs/OPERATIONS.md`                                     |
| Thêm page/feature FE                 | `App.tsx` nav · `tokens.css` nếu cần token mới · SPEC_UI                                      |
| Thêm dịch vụ API ngoài               | `docs/services/<service>.md` (theo template)                                                  |
| BẤT KỲ thay đổi nào                  | Điền + cập nhật Change Request template tương ứng (mục 4)                                     |

---

## 4\. Quy trình bắt buộc mỗi thay đổi

1. Tạo task theo **Change Request template** đúng loại (xem page _Change Request Templates_).
2. Đọc mục SPEC + file liên quan được template chỉ ra.
3. Code + test. Chạy `npm test` + `npm run build` → phải xanh.
4. Cập nhật ma trận mục 3 (docs/spec/test/service bị ảnh hưởng).
5. **Ghi ngược vào template**: nếu phát hiện file ảnh hưởng mới, bổ sung vào template cho lần sau.
6. Ghi nhật ký vào page _PROMPT triển khai & Nhật ký_.
7. PR nhỏ, 1 mục đích. Không trộn refactor lớn với feature.

---

## 5\. Không được làm

- Không commit secret/khoá thật. Secret trong tài liệu gốc coi như đã lộ → phải rotate.
- Không đổi interface `Db`, response shape, hay modal rules mà không cập nhật toàn bộ nơi liên quan.
- Không thêm dependency nặng nếu chuẩn `node:*` giải quyết được (theo tiền lệ dùng REST+JWT thay firebase-admin).
