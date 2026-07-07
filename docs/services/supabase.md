# Supabase — API Reference (nội bộ)

## 1. Tổng quan
- Mục đích: quản lý project, storage (S3-compatible).
- Management API base: `https://api.supabase.com`
- Docs: https://supabase.com/docs

## 2. Xác thực
- Management: Bearer personal access token. Header `Authorization: Bearer {{supabase.accessToken}}`.
- Credential key: `supabase.com.accessToken`.
- Storage S3: AccessKeyID/SecretAccessKey (key `supabase.com.database`) — dùng SDK/S3 client.
- Cách lấy: Supabase → Account → Access Tokens; Storage → S3 credentials.

## 3. Endpoint hay dùng
| Nghiệp vụ | Method | Path |
|---|---|---|
| List projects | GET | /v1/projects |

## 4. Ví dụ curl
```bash
curl https://api.supabase.com/v1/projects -H "Authorization: Bearer TOKEN"
```

## 5. Field trích xuất gợi ý
| field | jsonPath | pinToVar |
|---|---|---|
| projectRef | $[0].id | supabase.lastProjectRef |

## 6. Bảo mật
- Access token + S3 secret rất nhạy. Đã lộ → rotate toàn bộ.

## 7. Cập nhật
- 2026-07-08 — chuẩn hoá theo `_TEMPLATE.md`.
