# `<Service Name>` — API Reference (nội bộ)

## 1. Tổng quan
- Mục đích dùng trong dự án: `<vd tạo repo, chạy workflow>`
- Base URL: `https://...`
- Tài liệu chính thức: `<link>`

## 2. Xác thực (Authentication)
- Kiểu: Bearer token | API key header | Basic | OAuth
- Header mẫu: `Authorization: Bearer {{<service>.token}}`
- Credential key trong hệ thống (rtdb-keys): `<service>.token` / `<service>.apikey`
- Cách lấy giá trị: `<hướng dẫn ngắn + link trang tạo token>`
- Scope/quyền tối thiểu cần: `<...>`

## 3. Endpoint hay dùng
| Nghiệp vụ | Method | Path | Ghi chú |
|---|---|---|---|
| `<nghiệp vụ>` | POST | /`<path>` | ... |

## 4. Ví dụ curl (để đưa vào Fetch Builder)
```bash
curl -X POST https://api.example.com/... \
  -H "Authorization: Bearer TOKEN" \
  -d '{"...":"..."}'
```

## 5. Field trích xuất gợi ý (extract JSONPath → pin biến)
| field | jsonPath | pinToVar |
|---|---|---|
| `<field>` | $.`<path>` | `<service>.<var>` |

## 6. Rate limit & lỗi thường gặp
- Rate limit: `<...>`
- Lỗi 401/403: `<nguyên nhân + xử lý>`

## 7. Bảo mật & lưu ý
- Token nhạy cảm, luôn masked ở UI.
- ⚠️ Nếu token từng bị lộ → rotate ngay.

## 8. Cập nhật
- `<ngày>` — `<thay đổi>`
