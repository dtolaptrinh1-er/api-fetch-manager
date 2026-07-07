# dpdns — API Reference (nội bộ)

## 1. Tổng quan
- Mục đích: quản lý DNS động (dpdns.org).
- Base URL: `https://api.dpdns.org` (⚠️ CẦN XÁC MINH tại trang dpdns.org)
- Docs: `<link chính thức — CẦN BỔ SUNG>`

## 2. Xác thực
- Kiểu: API key.
- Header/param: `<CẦN XÁC MINH: header Authorization hay query ?apikey=>`
- Credential key: `dpdns.apikey`
- Cách lấy: dashboard dpdns → API key.

## 3. Endpoint hay dùng
| Nghiệp vụ | Method | Path | Ghi chú |
|---|---|---|---|
| `<cập nhật record>` | `<GET/POST>` | /`<path>` | CẦN BỔ SUNG |

## 4. Ví dụ curl
```bash
# CẦN BỔ SUNG sau khi xác minh endpoint
curl "https://api.dpdns.org/..." -H "Authorization: Bearer TOKEN"
```

## 5. Field trích xuất gợi ý
| field | jsonPath | pinToVar |
|---|---|---|
| `<field>` | $.`<path>` | dpdns.`<var>` |

## 6. Bảo mật
- apikey đã lộ → rotate.

## 8. Cập nhật
- 2026-07-08 — khung, còn `<BỔ SUNG>` endpoint/base URL cần xác minh.
