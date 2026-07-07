# Cloudflare — API Reference (nội bộ)

## 1. Tổng quan

- Mục đích: quản lý DNS/nameserver, zones.
- Base URL: `https://api.cloudflare.com/client/v4`
- Docs: https://developers.cloudflare.com/api

## 2. Xác thực

- Kiểu: Bearer token (khuyến nghị) hoặc Global API Key.
- Header: `Authorization: Bearer {{cloudflare.token}}`
- Credential key: `cloudflare.token.global` (đang lưu) → nên chuyển sang scoped token.
- Cách lấy: Cloudflare dashboard → My Profile → API Tokens.

## 3. Endpoint hay dùng

| Nghiệp vụ      | Method | Path                         |
| -------------- | ------ | ---------------------------- |
| List zones     | GET    | /zones                       |
| Tạo DNS record | POST   | /zones/{zone_id}/dns_records |

## 4. curl

```bash
curl -X POST https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"A","name":"x","content":"1.2.3.4"}'
```

## 5. Field trích

## 6. Lỗi: response {success:false, errors:[...]} → đọc errors[].message.

## 7. Bảo mật: Global key quyền rất rộng → ưu tiên scoped token. Key đã lộ → rotate.
