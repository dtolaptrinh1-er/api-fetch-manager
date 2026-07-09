# cron-job.org — API Reference (nội bộ)

> Mẫu chuẩn theo `_TEMPLATE.md` + [UI+] addendum v1.6 (§3): mỗi nghiệp vụ có **tác dụng · curl mẫu đầy đủ · response mẫu · field trích xuất · link gốc**.
>
> ⚠️ Mọi curl dùng **placeholder credential** `{{...}}`, KHÔNG chứa secret thật. Placeholder resolve theo `credId` — key `cronjob.apiKey` có nhiều giá trị thì phải chọn đúng bản ghi.

## 1. Tổng quan
- Mục đích trong dự án: quản lý cron job HTTP (tạo/sửa/xóa/chạy thử, xem lịch sử) để lên lịch gọi các flow API.
- Base URL: `https://api.cron-job.org`
- Tài liệu chính thức: https://docs.cron-job.org/rest-api.html
- Định dạng: JSON (`Content-Type: application/json`).

## 2. Xác thực (Authentication)
- Kiểu: Bearer API key.
- Header mẫu: `Authorization: Bearer {{cronjob.apiKey}}`
- Credential key (rtdb-keys): `cronjob.apiKey`.
- Cách lấy: cron-job.org → Settings → API → Create API key → https://console.cron-job.org/settings
- Lưu ý: API key có toàn quyền trên tài khoản → luôn masked ở UI, thao tác xóa cần confirm.

---

## 3. Nghiệp vụ: Cron Jobs

### 3.1 List jobs — `GET /jobs`
**Tác dụng:** liệt kê toàn bộ cron job (dùng cho Services & Resources tab cron-job.org → resource `job`).
**Doc:** https://docs.cron-job.org/rest-api.html#listing-cron-jobs
```bash
curl https://api.cron-job.org/jobs \
  -H "Authorization: Bearer {{cronjob.apiKey}}"
```
**Response mẫu (200):**
```json
{
  "jobs": [
    {
      "jobId": 1234567,
      "enabled": true,
      "title": "Ping demo API",
      "url": "https://demo.example.com/health",
      "lastStatus": 1,
      "lastDuration": 142,
      "lastExecution": 1750000000
    }
  ],
  "someFailed": false
}
```
**Trích xuất (wildcard):** `jobIds=$.jobs[*].jobId` · `jobTitles=$.jobs[*].title` · `jobUrls=$.jobs[*].url`

### 3.2 Chi tiết job — `GET /jobs/{jobId}`
**Tác dụng:** xem cấu hình đầy đủ 1 job.
**Doc:** https://docs.cron-job.org/rest-api.html#retrieving-details-of-a-cron-job
```bash
curl https://api.cron-job.org/jobs/{{jobId}} \
  -H "Authorization: Bearer {{cronjob.apiKey}}"
```
**Response mẫu (200):**
```json
{
  "jobDetails": {
    "jobId": 1234567,
    "title": "Ping demo API",
    "url": "https://demo.example.com/health",
    "enabled": true,
    "schedule": { "timezone": "Asia/Bangkok", "hours": [-1], "minutes": [0, 30] },
    "requestMethod": 0
  }
}
```
**Trích xuất:** `jobUrl=$.jobDetails.url` · `jobEnabled=$.jobDetails.enabled` · `jobTimezone=$.jobDetails.schedule.timezone`

### 3.3 Tạo job — `PUT /jobs`
**Tác dụng:** tạo cron job mới (schedule + URL đích).
**Doc:** https://docs.cron-job.org/rest-api.html#creating-a-cron-job
```bash
curl -X PUT https://api.cron-job.org/jobs \
  -H "Authorization: Bearer {{cronjob.apiKey}}" \
  -H "Content-Type: application/json" \
  -d '{"job":{"url":"{{targetUrl}}","enabled":true,"title":"{{jobTitle}}","schedule":{"timezone":"Asia/Bangkok","hours":[-1],"mdays":[-1],"minutes":[0],"months":[-1],"wdays":[-1]}}}'
```
**Response mẫu (200):**
```json
{ "jobId": 1234568 }
```
**Trích xuất:** `jobId=$.jobId` (pin `cronjob.lastJobId`)

### 3.4 Cập nhật job — `PATCH /jobs/{jobId}`
**Tác dụng:** sửa job (bật/tắt, đổi URL, đổi lịch).
**Doc:** https://docs.cron-job.org/rest-api.html#updating-a-cron-job
```bash
curl -X PATCH https://api.cron-job.org/jobs/{{jobId}} \
  -H "Authorization: Bearer {{cronjob.apiKey}}" \
  -H "Content-Type: application/json" \
  -d '{"job":{"enabled":false}}'
```
**Response:** `200 OK` (body rỗng hoặc `{}`).

### 3.5 Xóa job — `DELETE /jobs/{jobId}`
**Tác dụng:** xóa 1 cron job (action ghi → cần confirm ở UI).
**Doc:** https://docs.cron-job.org/rest-api.html#deleting-a-cron-job
```bash
curl -X DELETE https://api.cron-job.org/jobs/{{jobId}} \
  -H "Authorization: Bearer {{cronjob.apiKey}}"
```
**Response:** `200 OK`.

---

## 4. Nghiệp vụ: Lịch sử thực thi (History)

### 4.1 List history — `GET /jobs/{jobId}/history`
**Tác dụng:** xem các lần chạy gần đây của job (dùng để đối chiếu với History & Logs của app).
**Doc:** https://docs.cron-job.org/rest-api.html#retrieving-the-execution-history-of-a-cron-job
```bash
curl https://api.cron-job.org/jobs/{{jobId}}/history \
  -H "Authorization: Bearer {{cronjob.apiKey}}"
```
**Response mẫu (200):**
```json
{
  "history": [
    { "identifier": "abc", "date": 1750000000, "httpStatus": 200, "duration": 142, "status": 1 }
  ]
}
```
**Trích xuất:** `lastHttpStatus=$.history[0].httpStatus` · `lastDuration=$.history[0].duration`

---

## 5. Bảng field trích xuất gợi ý (tổng hợp)
| field | jsonPath | pinToVar |
|---|---|---|
| jobId | `$.jobId` | `cronjob.lastJobId` |
| jobIds | `$.jobs[*].jobId` | — |
| jobUrl | `$.jobDetails.url` | — |
| lastHttpStatus | `$.history[0].httpStatus` | — |

## 6. Rate limit & lỗi thường gặp
- `401 Unauthorized` = API key sai/thu hồi (chọn nhầm credId?).
- `404 Not Found` = jobId không tồn tại.
- `409/429` = quá giới hạn tạo job / rate limit; thử lại sau.

## 7. Bảo mật & lưu ý
- API key luôn masked ở UI; resolve theo `credId` cụ thể.
- Thao tác `DELETE`/`PATCH enabled=false` là hành động ghi → UI phải confirm trước khi chạy.

## 8. Cập nhật
- 2026-07-09 — thêm mới theo addendum v1.6, hoàn thiện đủ 6 dịch vụ (github, cloudflare, dpdns, tailscale, supabase, cron-job.org).
