# OPERATIONS — Vận hành API Fetch Manager

Tài liệu vận hành: cấu hình môi trường, storage, bảo mật, và cách chạy. Map: [SYS] 7.2, 8 · [REQ] 4.

## 1. Yêu cầu
- Node.js ≥ 20 (khuyến nghị 22) — chỉ cần khi chạy không dùng Docker.
- Docker + Docker Compose — cho triển khai chuẩn.

## 2. Biến môi trường
Tất cả biến prefix `API_FETCH_MANAGER_`. Xem `.env.example` để biết **đầy đủ ý nghĩa 5 mục** mỗi biến. Tóm tắt:

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `API_FETCH_MANAGER_PORT` | không (mặc định 8080) | Cổng HTTP |
| `API_FETCH_MANAGER_LOG_LEVEL` | không (info) | Mức log |
| `API_FETCH_MANAGER_STORAGE_MODE` | không (memory) | `memory` \| `file` \| `firebase` |
| `API_FETCH_MANAGER_DATA_DIR` | khi `file` | Thư mục JSON |
| `API_FETCH_MANAGER_ENCRYPTION_KEY` | **có** (prod/firebase) | Khóa AES-256 (32 byte base64) |
| `API_FETCH_MANAGER_ADMIN_TOKEN` | **có** khi `file`/`firebase` | Bearer token bảo vệ mọi `/api` ngoài health |
| `API_FETCH_MANAGER_FIREBASE_SA` | khi `firebase` | Service Account base64 |
| `API_FETCH_MANAGER_RTDB_*_URL` (5 cái) | khi `firebase` | URL 5 RTDB |
| `API_FETCH_MANAGER_HTTP_TIMEOUT_MS` | không (15000) | Timeout outbound executor/Firebase REST |
| `API_FETCH_MANAGER_HTTP_RETRIES` | không (2) | Retry lỗi mạng/timeout/429/5xx |
| `API_FETCH_MANAGER_HTTP_MAX_RESPONSE_BYTES` | không (1 MiB) | Giới hạn response executor đọc vào memory |

App **fail-fast**: thiếu biến bắt buộc → dừng với message rõ ràng.

### Sinh ENCRYPTION_KEY
```bash
openssl rand -base64 32
# hoặc
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
> ⚠️ Đổi khóa sẽ **không giải mã được** credential đã lưu bằng khóa cũ.

## 3. Chế độ storage

### 3.1 `memory` (mặc định)
Dữ liệu trong RAM, mất khi restart. Dùng test/demo.

### 3.2 `file`
Ghi JSON xuống `DATA_DIR` (mỗi DB 1 file: `rtdb-keys.json`, `rtdb-history.json`, ...). Giữ dữ liệu qua restart. Phù hợp self-host nhỏ.

### 3.3 `firebase` (production đúng SPEC)
Dùng Google Realtime Database, **5 DB tách biệt**. Các bước:
1. Firebase Console → tạo project.
2. Realtime Database → tạo **5 instance**: keys, history, logs, issues, variables. Copy URL từng cái vào `API_FETCH_MANAGER_RTDB_*_URL`.
3. Nạp rules từ `docker/database.rules.json` cho từng instance (đảm bảo `.indexOn` đúng schema — xem [SYS] 3 & 10.4).
4. Project Settings → Service accounts → Generate private key → base64 hóa → `API_FETCH_MANAGER_FIREBASE_SA`.
5. Sinh `API_FETCH_MANAGER_ADMIN_TOKEN` và gửi `Authorization: Bearer <token>` khi gọi API.
6. Đặt `API_FETCH_MANAGER_STORAGE_MODE=firebase`.

> Adapter Firebase được cắm qua interface `Db` trong `src/db/rtdb.ts`. Khi bật firebase, adapter dùng OAuth service account + Firebase RTDB REST API cho từng URL và bọc theo interface (get/set/update/push/remove/query). Cấu trúc dữ liệu & path giống hệt file/memory nên không đổi business logic.

## 4. Bảo mật
- Credential **luôn mã hóa** AES-256-GCM at-rest (`valueEnc` + `iv`). Không lưu plaintext.
- API list trả **masked** (`ghp_****ANR1M`). Chỉ endpoint `/reveal` (sau confirm ở UI) trả plaintext. Khi cấu hình `API_FETCH_MANAGER_ADMIN_TOKEN`, mọi endpoint `/api` ngoài `/api/health` yêu cầu Bearer token; file/firebase mode bắt buộc có token này. Frontend gửi token từ `VITE_API_FETCH_MANAGER_ADMIN_TOKEN` khi build hoặc từ `localStorage['api-fetch-manager.adminToken']`.
- Executor và Firebase REST có timeout/retry: mặc định timeout 15s, retry 2 lần cho lỗi mạng/timeout/429/5xx, và executor giới hạn response text 1 MiB.
- Log **che token** (Bearer/token/ghp_/sbp_ → `***`). Không log secret.
- Advanced JS chạy trong **sandbox cô lập** (node:vm): cấm network/fs/process/require, timeout 200ms.
- ⚠️ Secret mẫu trong tài liệu yêu cầu đã bị lộ → **rotate ngay**, chỉ dùng dữ liệu GIẢ cho seed/test.

## 5. Chạy local (không Docker)
```bash
cd app
npm install
# build FE (ra backend/public) + chạy BE
npm run build
API_FETCH_MANAGER_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
API_FETCH_MANAGER_STORAGE_MODE=file API_FETCH_MANAGER_DATA_DIR=.data \
API_FETCH_MANAGER_ADMIN_TOKEN="$(openssl rand -base64 32)" \
npm start
# → http://localhost:8080
```
Dev mode (2 process, hot reload):
```bash
npm run dev:backend   # cổng 8080
npm run dev:frontend  # cổng 5173, proxy /api → 8080
```

## 6. Seed dữ liệu mẫu
```bash
cd app/backend
API_FETCH_MANAGER_STORAGE_MODE=file API_FETCH_MANAGER_DATA_DIR=.data \
API_FETCH_MANAGER_ADMIN_TOKEN="$(openssl rand -base64 32)" \
API_FETCH_MANAGER_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
npm run seed
```
Xem thêm `SMOKE.md`.

## 7. Health check
`GET /api/health` → `{ "ok": true, "data": { "status": "up", "storage": "file" } }`.
