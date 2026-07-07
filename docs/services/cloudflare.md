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
| Nghiệp vụ | Method | Path |
|---|---|---|
| List zones | GET | /zones |
| Tạo DNS record | POST | /zones/{zone_id}/dns_records |

## 4. Ví dụ curl
```bash
curl -X POST https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"A","name":"x","content":"1.2.3.4"}'
```

## 5. Field trích xuất gợi ý
| field | jsonPath | pinToVar |
|---|---|---|
| recordId | $.result.id | cloudflare.lastRecordId |
| zoneId | $.result[0].id | cloudflare.lastZoneId |

## 6. Rate limit & lỗi
- Response `{ success:false, errors:[...] }` → đọc `errors[].message`.

## 7. Bảo mật
- Global key quyền rất rộng → ưu tiên scoped token. Key đã lộ → rotate.

## 8. Cập nhật
- 2026-07-08 — chuẩn hoá theo `_TEMPLATE.md`.
