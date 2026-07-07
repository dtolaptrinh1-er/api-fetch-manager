# Supabase — API Reference (nội bộ)

## 1. Tổng quan: quản lý project, storage (S3-compatible).

- Management API base: `https://api.supabase.com`
- Docs: https://supabase.com/docs

## 2. Xác thực

- Management: Bearer personal access token. Header `Authorization: Bearer {{supabase.accessToken}}`.
- Credential key: `supabase.com.accessToken`.
- Storage S3: AccessKeyID/SecretAccessKey (key `supabase.com.database`) — dùng SDK/S3 client.
- Cách lấy: Supabase → Account → Access Tokens; Storage → S3 credentials.

## 3. Endpoint hay dùng

| Nghiệp vụ     | Method | Path         |
| ------------- | ------ | ------------ |
| List projects | GET    | /v1/projects |

## 4. curl

```bash
curl https://api.supabase.com/v1/projects -H "Authorization: Bearer TOKEN"
```

## 5. Field trích: projectRef → $[0].id.

## 6. Bảo mật: access token + S3 secret rất nhạy. Đã lộ → rotate toàn bộ.
