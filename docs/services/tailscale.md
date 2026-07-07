# Tailscale — API Reference (nội bộ)

## 1. Tổng quan
- Mục đích: quản lý tailnet, devices, keys.
- Base URL: `https://api.tailscale.com/api/v2`
- Docs: https://tailscale.com/api

## 2. Xác thực
- Kiểu: OAuth client (clientId/secret) hoặc API access token.
- Header: `Authorization: Bearer {{tailscale.token}}`
- Credential key: `tailscale.com.TrustCredentials` (clientId + secretId); tailnet ở `tailscale.com.dns` / `tailscale.com.uniqueID`.
- Cách lấy: Admin console → Settings → OAuth clients / Keys.

## 3. Endpoint hay dùng
| Nghiệp vụ | Method | Path | Ghi chú |
|---|---|---|---|
| List devices | GET | /tailnet/{tailnet}/devices | |

## 4. Ví dụ curl
```bash
curl https://api.tailscale.com/api/v2/tailnet/{tailnet}/devices -u "TOKEN:"
```

## 5. Field trích xuất gợi ý
| field | jsonPath | pinToVar |
|---|---|---|
| deviceIds | $.devices[*].id | tailscale.deviceIds |

## 6. Rate limit & lỗi
- 401/403: token sai hoặc thiếu scope.

## 7. Bảo mật
- client secret nhạy cảm. ⚠️ Đã lộ trong doc gốc → rotate ngay.

## 8. Cập nhật
- 2026-07-08 — tạo tài liệu.
