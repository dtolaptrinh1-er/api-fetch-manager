# API Fetch Manager

Hệ thống quản lý tập trung **API key của nhiều dịch vụ** (GitHub, Supabase, Cloudflare, Tailscale, dpdns...) theo `emailOwner`, cho phép **thực thi API call** bằng key đã lưu, mở rộng API kiểu **Fetch Builder** (curl → flow tái sử dụng), lưu **lịch sử + log chi tiết**, có **Inspect Mode** tạo bug/issue từ giao diện, và **kho biến** tái sử dụng với **Placeholder Engine** (transform + JS sandbox).

> Triển khai theo bộ SPEC trong `docs/SPEC-PLAN/` (Tổng hợp yêu cầu · SPEC tổng thể · SPEC_UI · PLAN · PROMPT+Nhật ký).

## Kiến trúc
```
┌───────────── Docker container ─────────────┐
│  Frontend (React + TS, Vite)  → tĩnh        │
│         │ HTTP /api                          │
│  Backend (Node + TS, Fastify) → proxy+logic │
│         │ interface Db                       │
└─────────┼───────────────────────────────────┘
          ▼
  Storage adapter: memory | file | firebase(RTDB×6)
  (keys · history · logs · issues · variables · resources)
```
- **FE**: React + TypeScript + Vite. Build tĩnh, phục vụ bởi BE (1 image).
- **BE**: Node + TypeScript + Fastify. Proxy giữa FE và storage, nơi thực thi fetch. FE không chạm storage trực tiếp.
- **Storage**: interface `Db` với 3 adapter. Production dùng Google RTDB (6 DB tách biệt, `.indexOn` ở `docker/database.rules.json`).
- **Crypto**: AES-256-GCM mã hoá credential at-rest.
- **Sandbox**: `node:vm` cô lập (cấm network/fs/process/require, timeout 200ms).

## Tính năng chính
- Quản lý credential theo owner (CRUD, 1 key nhiều giá trị, import/export). Giá trị **luôn mã hoá**, API trả **masked**.
- **Fetch Builder / Flow**: paste curl → sinh step; flow nhiều step tuần tự, chia sẻ `context`; trích response JSONPath (nested/mảng/wildcard); pin biến; sinh cURL (mask secret).
- **Placeholder Engine**: `{{source | transform}}` + advanced JS sandbox.
- **Kho biến** (global + theo owner), **Extracted Data** view.
- **Services & Resources**: tab động theo dịch vụ (RTDB #6), quản lý resource item theo owner, lấy biến / xóa theo item.
- **Docs viewer**: side-panel tài liệu API từng dịch vụ (`docs/services/*.md`), có mục lục + nút “Dùng mẫu” đẩy curl thẳng vào Fetch Builder.
- **History & Logs** (che token) để debug.
- **Inspect Mode**: chọn nhiều element trên UI → tạo issue → export/copy Markdown.
- **Issues** CRUD (bug/feature/task).
- **Self-Test Mode**: chạy loạt kịch bản kiểm tra tính năng cốt lõi (crypto, placeholder, extract, sandbox, curl, CRUD) và hiển thị assertion pass/fail.
- **DataList chuẩn hoá**: mọi danh sách có filter (toàn văn + theo cột) · sort · export JSON/CSV/PDF.
- **Status bar**: commit (link) · thời điểm build · môi trường · storage · owner đang active · trạng thái backend.
- UI: responsive, 2 theme, font mảnh, **0 alert/confirm** trình duyệt (mọi thứ qua modal), button có icon+tooltip, owner selector có tìm kiếm.

## Chạy nhanh
```bash
npm install
npm run build       # build FE (→ backend/public) + BE
API_FETCH_MANAGER_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
API_FETCH_MANAGER_STORAGE_MODE=file API_FETCH_MANAGER_DATA_DIR=.data \
npm start           # → http://localhost:8080
```
Dev (hot reload):
```bash
npm run dev:backend   # :8080
npm run dev:frontend  # :5173 (proxy /api → 8080)
```
Docker:
```bash
cp .env.example .env   # điền ENCRYPTION_KEY
docker compose up -d --build
```

## Test
```bash
npm test          # 76 tests / 12 files
```

## Cấu trúc thư mục
```
.
├── backend/        # Fastify + TS
│   ├── src/
│   │   ├── config/env.ts        # loader env (prefix API_FETCH_MANAGER_)
│   │   ├── db/rtdb.ts           # storage adapter (memory/file/firebase)
│   │   ├── lib/                 # crypto, types, ids, markdown
│   │   ├── engine/              # transforms, sandbox, extract, placeholder, executor
│   │   ├── modules/             # stores, parse-curl
│   │   ├── routes/routes.ts     # REST /api
│   │   └── server.ts
│   ├── scripts/seed-smoke.ts
│   └── test/                    # vitest
├── frontend/       # React + TS + Vite
│   └── src/{styles,components,pages,features,api,lib}
├── docker/database.rules.json   # RTDB rules + .indexOn
├── docs/           # OPERATIONS, DEPLOYMENT, USER_GUIDE, TEST_CASES, SMOKE
├── Dockerfile      # multi-stage → 1 image
├── docker-compose.yml
└── .env.example    # comment đầy đủ từng biến
```

## Bảo mật
- Credential mã hoá AES-256-GCM; API không trả plaintext (masked); reveal cần confirm.
- Log che token. Advanced JS trong sandbox cô lập.
- ⚠️ Secret mẫu trong tài liệu đã bị lộ → **rotate ngay**; seed/test chỉ dùng dữ liệu GIẢ.

## Tài liệu
- Vận hành: `docs/OPERATIONS.md`
- Triển khai (Docker/GitHub/Azure): `docs/DEPLOYMENT.md`
- Hướng dẫn sử dụng: `docs/USER_GUIDE.md`
- Test case: `docs/TEST_CASES.md`
- Smoke: `docs/SMOKE.md`
