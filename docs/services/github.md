# GitHub — API Reference (nội bộ)

> Mẫu chuẩn theo `_TEMPLATE.md`, mở rộng theo [UI+] addendum v1.6 (§3): mỗi nghiệp vụ có **tác dụng · curl mẫu đầy đủ · response mẫu · field trích xuất · link gốc**. Dùng file này làm khuôn cho 5 dịch vụ còn lại (cloudflare, dpdns, tailscale, supabase, cron-job.org).
>
> ⚠️ Mọi curl dùng **placeholder credential** `{{...}}`, KHÔNG chứa secret thật. Placeholder resolve theo `credId` (xem `01.PROMPT_MASTER` §A.1) — key `github.token` có nhiều giá trị thì phải chọn đúng bản ghi.

## 1. Tổng quan
- Mục đích trong dự án: quản lý repo, workflow (Actions), runner log, secrets.
- Base URL: `https://api.github.com`
- Tài liệu chính thức: https://docs.github.com/rest
- API version header: `X-GitHub-Api-Version: 2022-11-28`

## 2. Xác thực (Authentication)
- Kiểu: Bearer token (PAT classic / fine-grained).
- Header mẫu: `Authorization: Bearer {{github.token}}` + `Accept: application/vnd.github+json`
- Credential key (rtdb-keys): `github.token` (dữ liệu mẫu có **2 giá trị** → chọn đúng `credId` qua KeyPicker).
- Cách lấy: GitHub → Settings → Developer settings → Personal access tokens → https://github.com/settings/tokens
- Scope tối thiểu: `repo` (repo riêng), `workflow` (Actions), `admin:repo_hook` nếu cần webhook.

---

## 3. Nghiệp vụ: Repositories

### 3.1 Tạo repo — `POST /user/repos`
**Tác dụng:** tạo repository mới cho user hiện tại.
**Doc:** https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user
```bash
curl -X POST https://api.github.com/user/repos \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{"name":"{{repoName}}","private":true,"auto_init":true}'
```
**Response mẫu (201):**
```json
{
  "id": 987654321,
  "name": "demo",
  "full_name": "o861shelter-dot/demo",
  "private": true,
  "html_url": "https://github.com/o861shelter-dot/demo",
  "clone_url": "https://github.com/o861shelter-dot/demo.git",
  "default_branch": "main",
  "created_at": "2026-07-08T14:00:00Z"
}
```
**Trích xuất:** `repoUrl=$.html_url` (pin `github.lastRepoUrl`) · `repoFullName=$.full_name` · `cloneUrl=$.clone_url`

### 3.2 Lấy repo — `GET /repos/{owner}/{repo}`
**Tác dụng:** xem chi tiết 1 repo.
**Doc:** https://docs.github.com/rest/repos/repos#get-a-repository
```bash
curl https://api.github.com/repos/{{owner}}/{{repo}} \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json"
```
**Response mẫu (200):** như 3.1 kèm `stargazers_count`, `open_issues_count`, `pushed_at`.
**Trích xuất:** `defaultBranch=$.default_branch` · `openIssues=$.open_issues_count`

### 3.3 List repo — `GET /user/repos?per_page=100&sort=updated`
**Tác dụng:** liệt kê repo (dùng cho Services & Resources tab GitHub → resource `repo`).
**Doc:** https://docs.github.com/rest/repos/repos#list-repositories-for-the-authenticated-user
```bash
curl "https://api.github.com/user/repos?per_page=100&sort=updated" \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json"
```
**Response mẫu (200):**
```json
[
  { "name": "demo", "full_name": "o861shelter-dot/demo", "html_url": "https://github.com/o861shelter-dot/demo", "private": true },
  { "name": "api-fetch-manager", "full_name": "o861shelter-dot/api-fetch-manager", "html_url": "https://github.com/o861shelter-dot/api-fetch-manager", "private": false }
]
```
**Trích xuất (wildcard):** `repoNames=$[*].name` · `repoUrls=$[*].html_url`

---

## 4. Nghiệp vụ: Actions / Workflows

### 4.1 List workflows — `GET /repos/{owner}/{repo}/actions/workflows`
**Tác dụng:** liệt kê workflow của repo.
**Doc:** https://docs.github.com/rest/actions/workflows#list-repository-workflows
```bash
curl https://api.github.com/repos/{{owner}}/{{repo}}/actions/workflows \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json"
```
**Response mẫu (200):**
```json
{
  "total_count": 1,
  "workflows": [
    { "id": 161335, "name": "CI", "path": ".github/workflows/ci.yml", "state": "active" }
  ]
}
```
**Trích xuất:** `workflowId=$.workflows[0].id` · `workflowNames=$.workflows[*].name`

### 4.2 Trigger workflow — `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`
**Tác dụng:** chạy workflow theo `workflow_dispatch`.
**Doc:** https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event
```bash
curl -X POST https://api.github.com/repos/{{owner}}/{{repo}}/actions/workflows/{{workflowId}}/dispatches \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"ref":"{{ref | default(main)}}"}'
```
**Response:** `204 No Content` (thành công, không body).
**Trích xuất:** không có body → assert theo status 204.

### 4.3 List workflow runs (xem log runner) — `GET /repos/{owner}/{repo}/actions/runs`
**Tác dụng:** xem lịch sử chạy Actions (runner log list).
**Doc:** https://docs.github.com/rest/actions/workflow-runs#list-workflow-runs-for-a-repository
```bash
curl "https://api.github.com/repos/{{owner}}/{{repo}}/actions/runs?per_page=20" \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json"
```
**Response mẫu (200):**
```json
{
  "total_count": 1,
  "workflow_runs": [
    { "id": 555001, "name": "CI", "status": "completed", "conclusion": "success", "run_number": 42, "html_url": "https://github.com/o861shelter-dot/demo/actions/runs/555001" }
  ]
}
```
**Trích xuất:** `runStatus=$.workflow_runs[0].status` · `runConclusion=$.workflow_runs[0].conclusion` · `runUrl=$.workflow_runs[0].html_url`

---

## 5. Nghiệp vụ: Secrets (Actions)

> Ghi bí mật cần mã hoá bằng public key của repo (libsodium sealed box). Trong app: bước lấy key + bước PUT, dùng flow 2 step.

### 5.1 Lấy public key — `GET /repos/{owner}/{repo}/actions/secrets/public-key`
**Doc:** https://docs.github.com/rest/actions/secrets#get-a-repository-public-key
```bash
curl https://api.github.com/repos/{{owner}}/{{repo}}/actions/secrets/public-key \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json"
```
**Response mẫu (200):**
```json
{ "key_id": "3380204578043523", "key": "base64-public-key==" }
```
**Trích xuất:** `secretKeyId=$.key_id` (pin ctx) · `secretPubKey=$.key`

### 5.2 Tạo/ghi secret — `PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}`
**Tác dụng:** tạo hoặc cập nhật secret (value đã seal bằng pubkey ở 5.1).
**Doc:** https://docs.github.com/rest/actions/secrets#create-or-update-a-repository-secret
```bash
curl -X PUT https://api.github.com/repos/{{owner}}/{{repo}}/actions/secrets/{{secretName}} \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"encrypted_value":"{{ctx.encryptedValue}}","key_id":"{{ctx.secretKeyId}}"}'
```
**Response:** `201 Created` (mới) hoặc `204 No Content` (cập nhật).

### 5.3 Xóa secret — `DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}`
**Tác dụng:** xóa 1 secret (action ghi → cần confirm ở UI).
**Doc:** https://docs.github.com/rest/actions/secrets#delete-a-repository-secret
```bash
curl -X DELETE https://api.github.com/repos/{{owner}}/{{repo}}/actions/secrets/{{secretName}} \
  -H "Authorization: Bearer {{github.token}}" \
  -H "Accept: application/vnd.github+json"
```
**Response:** `204 No Content`.

---

## 6. Bảng field trích xuất gợi ý (tổng hợp)
| field | jsonPath | pinToVar |
|---|---|---|
| repoUrl | `$.html_url` | `github.lastRepoUrl` |
| repoFullName | `$.full_name` | `github.lastRepoName` |
| workflowId | `$.workflows[0].id` | `github.lastWorkflowId` |
| runConclusion | `$.workflow_runs[0].conclusion` | — |
| secretKeyId | `$.key_id` | — (ctx) |

## 7. Rate limit & lỗi thường gặp
- 5000 req/h (authenticated). Header `X-RateLimit-Remaining` cho biết còn lại.
- `401 Bad credentials` = token sai/hết hạn (chọn nhầm credId?). `403` = thiếu scope hoặc quá rate limit. `404` = sai owner/repo hoặc token không thấy repo private.

## 8. Bảo mật & lưu ý
- Token luôn masked ở UI; resolve theo `credId` cụ thể (key `github.token` có 2 giá trị).
- ⚠️ Token trong doc gốc (`00.YEUCAU.md` §6) đã lộ → PHẢI rotate; seed/test chỉ dùng token GIẢ.

## 9. Cập nhật
- 2026-07-08 — mở rộng đầy đủ curl + response mẫu + extract theo addendum v1.6, làm mẫu chuẩn cho các service khác.
