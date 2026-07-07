# DEPLOYMENT — Triển khai API Fetch Manager

Map: [SYS] 8 · [REQ] 4. Toàn bộ hệ thống đóng gói **1 Docker image** (FE tĩnh + BE Node).

## 1. Build & chạy bằng Docker Compose (self-host)

```bash
cd app
cp .env.example .env
# Điền tối thiểu:
#   API_FETCH_MANAGER_ENCRYPTION_KEY=<openssl rand -base64 32>
#   API_FETCH_MANAGER_STORAGE_MODE=file   (hoặc firebase)

docker compose up -d --build
docker compose logs -f
# → http://localhost:8080  (đổi qua API_FETCH_MANAGER_PORT)
```
Dữ liệu file-storage lưu ở volume `afm-data` (mount `/data`).

Kiểm tra:
```bash
curl http://localhost:8080/api/health
```

## 2. Build image thủ công
```bash
cd app
docker build -t api-fetch-manager:latest -f Dockerfile .
docker run -d --name afm -p 8080:8080 \
  -e API_FETCH_MANAGER_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  -e API_FETCH_MANAGER_STORAGE_MODE=file \
  -e API_FETCH_MANAGER_DATA_DIR=/data \
  -v afm-data:/data \
  api-fetch-manager:latest
```

## 3. GitHub Actions runner (Linux)
`.github/workflows/deploy.yml` mẫu (build image, self-hosted runner pull & chạy):

```yaml
name: Deploy API Fetch Manager
on:
  push:
    branches: [main]
jobs:
  build-and-run:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t api-fetch-manager:latest -f app/Dockerfile app
      - name: Run container
        env:
          API_FETCH_MANAGER_ENCRYPTION_KEY: ${{ secrets.API_FETCH_MANAGER_ENCRYPTION_KEY }}
        run: |
          docker rm -f afm || true
          docker run -d --name afm -p 8080:8080 \
            -e API_FETCH_MANAGER_ENCRYPTION_KEY="$API_FETCH_MANAGER_ENCRYPTION_KEY" \
            -e API_FETCH_MANAGER_STORAGE_MODE=file \
            -e API_FETCH_MANAGER_DATA_DIR=/data \
            -v afm-data:/data \
            api-fetch-manager:latest
```
> Lưu `API_FETCH_MANAGER_ENCRYPTION_KEY` (và các biến firebase nếu dùng) trong **GitHub Secrets**.

## 4. Azure runner (Linux)
Tương tự GitHub. Azure Pipelines mẫu:

```yaml
trigger: [main]
pool:
  vmImage: 'ubuntu-latest'   # hoặc self-hosted Linux agent
steps:
  - script: docker build -t api-fetch-manager:latest -f app/Dockerfile app
    displayName: Build image
  - script: |
      docker rm -f afm || true
      docker run -d --name afm -p 8080:8080 \
        -e API_FETCH_MANAGER_ENCRYPTION_KEY="$(AFM_KEY)" \
        -e API_FETCH_MANAGER_STORAGE_MODE=file \
        -e API_FETCH_MANAGER_DATA_DIR=/data \
        -v afm-data:/data \
        api-fetch-manager:latest
    displayName: Run container
    env:
      AFM_KEY: $(AFM_ENCRYPTION_KEY)   # lấy từ Azure pipeline secret variable
```

## 5. Production với Firebase
Khi dùng RTDB thật, thêm vào env (Compose/secret): `API_FETCH_MANAGER_STORAGE_MODE=firebase`, `API_FETCH_MANAGER_FIREBASE_SA`, `API_FETCH_MANAGER_ADMIN_TOKEN`, và 5 `API_FETCH_MANAGER_RTDB_*_URL`. Xem `OPERATIONS.md` mục 3.3.

## 6. Cập nhật / rollback
```bash
docker compose pull && docker compose up -d   # nếu dùng registry
docker compose down                            # dừng
```
Backup dữ liệu file: sao lưu volume `afm-data` (các file `rtdb-*.json`).
