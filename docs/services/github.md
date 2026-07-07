# GitHub — API Reference (nội bộ)

## 1. Tổng quan

- Mục đích: tạo repo, chạy workflow, quản lý nội dung.
- Base URL: `https://api.github.com`
- Docs: https://docs.github.com/rest

## 2. Xác thực

- Kiểu: Bearer token (PAT / fine-grained)
- Header: `Authorization: Bearer {{github.token}}` + `Accept: application/vnd.github+json`
- Credential key: `github.token`
- Cách lấy: GitHub → Settings → Developer settings → Personal access tokens.
- Scope tối thiểu: `repo` (repo riêng), `workflow` (chạy workflow).

## 3. Endpoint hay dùng

| Nghiệp vụ        | Method | Path                                                    |
| ---------------- | ------ | ------------------------------------------------------- |
| Tạo repo         | POST   | /user/repos                                             |
| Lấy repo         | GET    | /repos/{owner}/{repo}                                   |
| Trigger workflow | POST   | /repos/{owner}/{repo}/actions/workflows/{id}/dispatches |

## 4. Ví dụ curl

```bash
curl -X POST https://api.github.com/user/repos \
  -H "Authorization: Bearer TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"name":"demo","private":true}'
```

```

## 5. Field trích xuất gợi ý

## 6. Rate limit & lỗi

5000 req/h (authenticated). 401=token sai/hết hạn; 403=thiếu scope hoặc rate limit.

## 7. Bảo mật

Token masked ở UI. Token trong doc gốc đã lộ → PHẢI rotate.
```
