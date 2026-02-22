# Direct-to-Vercel-Blob Uploads (Advanced)

## PRD

### Problem

Uploads around ~5MB fail on Vercel with `413` / “request too large” before reaching Payload endpoints (e.g. `POST /api/media`). This blocks attaching PDFs/images to chat and other workflows.

### Goal

Support reliable client uploads up to **20MB per file** on Vercel by uploading **directly to Vercel Blob**, then creating/associating Payload `chat-assets` records via a small JSON “finalize” request.

### Users / Primary Flows (defaults)

- Authenticated end-users uploading chat attachments (images + PDFs).
- Admin uploads in Payload remain as-is initially unless explicitly migrated (see Stages).

### Requirements

- Max file size: **20MB per file**.
- Supported MIME types (default): `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Auth + authorization:
  - Only authenticated users can obtain an upload token.
  - Uploads are tied to the authenticated user (and tenant) and cannot be finalized by other users.
  - Note: Vercel Blob URLs are effectively public; auth is enforced at token issuance + finalize (DB association), not at blob download.
- UX:
  - Per-file progress (0–100%), per-file cancel.
  - Automatic retries with backoff for transient failures.
  - Clear user-facing errors for: unsupported type, too large, network failure, auth required.
- Data integrity:
  - After successful upload, create a `chat-assets` document with correct metadata (`url`, `pathname`, `mimeType`, `filesize`, `originalFilename`) and ownership (`createdBy`, `tenant`).
  - Server verifies blob metadata (size/type) during finalize; do not trust client fields.
- Cleanup:
  - Orphaned blobs (uploaded but never finalized) are deleted automatically.
  - Expired ephemeral media deletion also deletes blob objects (not just DB records).
- Observability:
  - Structured logs for token issuance, upload finalize, retry counts, cleanup deletions.
  - Sentry capture for unexpected errors with requestId correlation.

### Out of Scope

- Resumable/chunked uploads.
- Public unauthenticated uploads.
- Allowing arbitrary document types beyond the default MIME set.
- Replacing all Payload Admin uploads on day 1.

### Success Criteria

- A 20MB PDF upload succeeds on Vercel in the primary UI with progress + retry.
- No more “request too large” errors for supported uploads.
- Orphaned blobs are cleaned within the defined TTL.
- Media expiry cleanup removes both DB records and underlying blobs.

### Gates

- Security gate: token endpoint cannot be used without auth; finalize endpoint enforces ownership; server-side checks block oversized/unsupported content.
- Reliability gate: retry logic is bounded and does not produce unbounded orphan blobs.
- Cleanup gate: scheduled cleanup demonstrably deletes orphan blobs.

### Timebox (overall)

3–5 engineering days.

---

## HLS (High-Level Solution)

### Architecture Overview

Replace “upload file bytes to app” with “upload bytes to Blob directly”:

1. Client requests an upload token/config (server-authenticated)
2. Client uploads file directly to Vercel Blob with progress callbacks
3. Client calls a small JSON finalize endpoint to create a Payload `chat-assets` document
4. Cleanup jobs delete:
   - blobs that never finalized (TTL)
   - blobs for expired ephemeral chat assets

### Key Components

#### 1) Upload Token Endpoint (server)

- New Next.js route handler (e.g. `POST /api/blob/upload-token`).
- Uses Payload auth (`payload.auth({ headers })`) to require an authenticated user.
- Returns a token/config usable by the Vercel Blob client upload helper.
- Enforces constraints at issuance time:
  - max size 20MB
  - allowed MIME types
  - max files per request (default 5)
  - rate limiting (default: 10 token mints/min/user + IP-based soft limit)

Note: Token issuance is not enough; finalize must still validate the blob.

#### 2) Direct Upload (client)

- Use Vercel Blob client upload helper (`@vercel/blob/client`) to upload directly.
- Client receives:
  - `blob.url`
  - `blob.pathname`
  - `contentType`
  - `size`
- Track per-file:
  - status: `queued | uploading | uploaded | finalizing | complete | failed | cancelled`
  - progress 0–100
  - retryCount
  - abort controller

#### 3) Finalize Endpoint (server)

- New Next.js route handler (e.g. `POST /api/chat-assets/finalize-direct-upload`).
- Auth required.
- Input: `{ blobUrl, pathname, originalFilename, mimeType? }` (minimal; server verifies).
- Server validation:
  - blob URL is a Vercel Blob URL
  - blob exists and metadata is retrievable
  - size <= 20MB
  - contentType in allowlist
  - pathname matches an expected prefix structure (tenant/user scoping)
- Create `chat-assets` doc:
  - `url = blobUrl` (authoritative retrieval)
  - `pathname` (authoritative for deletion and prefix enforcement)
  - `originalFilename`
  - `mimeType`, `filesize`
  - `createdBy` + `tenant` set server-side
  - `retentionPolicy = ephemeral`
  - `expiresAt = now + 30d`

#### Tenant Derivation (default)

- Determine `tenantId` server-side from the authenticated user’s active/default tenant.
- Fail closed if tenant cannot be resolved.

#### `chat-assets` Collection (new)

Purpose: canonical store for chat attachments uploaded directly to Blob.

Defaults:

- Access:
  - create: server-only via finalize endpoint
  - read:
    - owner (createdBy) can read
    - admins can read all
  - update/delete:
    - server-only (cleanup + retention patch)
- Admin UI:
  - Visible in admin as a read-only list for admins (for debugging/support).
  - Hidden from non-admin users.

Fields (minimum):

- tenant (relationship)
- createdBy (relationship)
- url (text)
- pathname (text, indexed)
- originalFilename (text)
- mimeType (text)
- filesize (number)
- retentionPolicy (select: persistent|ephemeral, default ephemeral)
- expiresAt (date)
- status (select: initiated|uploaded|finalized|failed|cancelled) (optional; can be derived from upload-sessions if you want to keep it minimal)

#### 4) Upload Session Tracking (server)

Introduce a small DB-backed record to enable cleanup + idempotency.

Default approach:

- New collection (e.g. `upload-sessions`) OR reuse existing collection patterns if present.
- Fields:
  - `id`, `tenant`, `createdBy`
  - `purpose` (e.g. `chat-media`)
  - `originalFilename`, `mimeType`, `expectedSize`
  - `blobUrl`, `pathname`
  - `status` (`initiated | uploaded | finalized | cancelled | failed`)
  - `expiresAt` (TTL for orphan cleanup, default: 24h)
  - `createdAt`, `updatedAt`
- Finalize transitions `uploaded -> finalized` and stores `chatAssetId`.
- Idempotency: finalize is idempotent per `uploadSessionId` (repeat finalize returns existing `chatAssetId`).

#### 5) Cleanup

1. Orphaned uploads cleanup (new cron job)

- Find sessions where status in (`initiated`,`uploaded`,`failed`,`cancelled`) and `expiresAt <= now`.
- Delete blob (`getMediaBlobAdapter().delete(blobUrl or pathname)`).
- Delete session record.

Schedule (default): run hourly.

2. Expired media cleanup upgrade

3. Expired chat-assets cleanup (new cron job)

- Find `chat-assets` where `retentionPolicy=ephemeral` and `expiresAt <= now`.
- Delete blob by `url`/`pathname` using the existing Blob adapter.
- Delete `chat-assets` DB records (authoritative).

### Path Strategy (tenant/user scoping)

Default blob pathname format:
`media/<tenantId>/<userId>/<uploadSessionId>/<sanitizedOriginalFilename>`

Why:

- Enables ownership validation by prefix check.
- Makes cleanup and debugging straightforward.

### Security / Abuse Controls

- Auth required for token + finalize.
- Finalize verifies blob metadata server-side.
- Prefix/ownership enforcement: tenant/user/session encoded in pathname.
- Rate limiting on token + finalize endpoints.
- Max attachments per message (default 5) enforced on client and server.
- Migration support (default): chat accepts both `mediaIds` (legacy) and `chatAssetIds` (new) during rollout.

### Rollout

- Feature flag (config-driven) to switch chat attachments from legacy `/api/media` multipart to direct upload.
- Keep legacy path as fallback for local/dev or quick rollback.

---

## LLP (Low-Level Plan) — Stages

### Stage 1 — Server Contracts (Token + Finalize)

Timebox: 1 day

Deliverables:

- Token endpoint contract (request/response schema, errors).
- Finalize endpoint contract + server-side blob verification.
- New `chat-assets` collection (minimal fields + access + admin visibility for admins).
- Upload session model chosen (new collection or equivalent) with minimal fields.

Guardrails:

- No trusting client-provided `size`/`mimeType`.
- All Payload Local API calls with user context explicitly set `overrideAccess: false` when enforcing access.
- Finalize is idempotent per `uploadSessionId`.

Gates:

- Integration test(s): unauthenticated token request rejected; finalize rejects wrong user/tenant.

### Stage 2 — Client Upload UX (Progress + Cancel)

Timebox: 1–2 days

Deliverables:

- Replace chat attachment upload path to:
  - request token
  - direct upload with progress
  - finalize to create `chat-assets` doc
- UI state:
  - per-file progress
  - cancel
  - disabled send while uploading/finalizing
  - clear errors

Guardrails:

- Enforce 20MB and MIME allowlist client-side early.
- Never send file bytes through `/api/*` routes.

Gates:

- Manual: upload 20MB PDF, observe progress, attach to message, server can read it back.

### Stage 3 — Retries (Bounded, Observable)

Timebox: 0.5–1 day

Deliverables:

- Automatic retry policy:
  - retries: 3
  - backoff: exponential + jitter
  - classify retryable errors (network/timeouts/5xx) vs non-retryable (401/403/415/413)
- UI:
  - show retry attempts and final failure state
  - allow manual retry

Guardrails:

- Retry must not create unbounded orphan blobs:
  - reuse a single uploadSessionId per file
  - record latest blobUrl/pathname in session

Gates:

- Test: simulated transient failure leads to retry and eventual success OR clean failure with cleanup eligibility.

### Stage 4 — Cleanup (Orphans + Expired Ephemeral)

Timebox: 1 day

Deliverables:

- New orphan-cleanup cron endpoint (CRON_SECRET protected) deleting blobs + session records.
- New chat-assets-expiry cron endpoint (CRON_SECRET protected) deleting blobs + `chat-assets` records.

Guardrails:

- Cleanup is idempotent: deleting already-deleted blobs must not fail the job.
- DB deletion remains authoritative, but blob deletion should be best-effort and logged.

Gates:

- Manual: create an upload session, upload blob, skip finalize, verify cron deletes blob within TTL.
- Manual: ephemeral media expiry deletes DB record and blob.

### Stage 5 — Hardening + Admin (Optional default)

Timebox: 0.5–1 day

Deliverables (defaults):

- Feature flag + fallback path.
- Improved logging (requestId, uploadSessionId, chatAssetId).

Optional extension:

- Add an Admin UI uploader for the Media collection that uses the same direct-to-Blob flow.

---

## API Contracts (Proposed)

### `POST /api/blob/upload-token`

Auth: required (Payload auth)

Request:

- `purpose`: `'chat-media'` (default)
- `filename`: string
- `contentType`: string
- `size`: number (client hint; server still enforces max)

Response:

- upload config/token required by Vercel Blob client
- `uploadSessionId`
- `pathname` (reserved path)

Errors:

- 401 unauthenticated
- 413 size too large
- 415 unsupported content type
- 429 rate limited

Rate limits (default): 10/min/user + IP-based soft limit.

### `POST /api/chat-assets/finalize-direct-upload`

Auth: required

Request:

- `uploadSessionId`: string
- `blobUrl`: string
- `pathname`: string
- `originalFilename`: string

Response:

- `chatAssetId`: string
- `chatAsset`: minimal doc (id, url, pathname, originalFilename, mimeType, filesize, expiresAt)

Errors:

- 401 unauthenticated
- 403 session not owned by user/tenant
- 404 blob missing
- 413 size too large
- 415 unsupported content type

Rate limits (default): 30/min/user.

Idempotency (default): repeated finalize for the same `uploadSessionId` returns the existing `chatAssetId`.

---

## Testing Plan

- Unit:
  - pathname sanitization
  - retry classifier
  - server-side validators (mime/size/url)
- Integration:
  - token endpoint auth + rate limit
  - finalize verifies blob metadata and creates `chat-assets`
  - cleanup endpoints delete blobs + `chat-assets` + sessions
- Manual:
  - 20MB PDF upload via chat UI on Vercel preview deployment

---

## Operational Notes

- Vercel Blob access is effectively public; do not store secrets in blobs.
- If access to blobs must be restricted in the future, introduce a download proxy with auth and short-lived signed URLs.
