# LLP — Direct-to-Vercel-Blob Uploads (Chat Assets)

This plan implements the spec in `.tasks/20260802-direct-to-vercel-blob-uploads/spec.md`.

## Defaults Locked In

- Max size: 20MB per file.
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Max attachments per message: 5.
- Retention: `ephemeral`, `expiresAt = now + 30d`.
- Orphan upload-session TTL: 24h; cleanup runs hourly.
- Rate limits:
  - token/handleUpload route: 10/min/user + IP soft limit
  - finalize: 30/min/user
- Multi-tenant behavior: the codebase is effectively single-tenant today (tenant auto-filled from `DEFAULT_TENANT_SLUG`). Tenant is still stored on docs via `tenantField`.

## Stage 0 — Proof of Feasibility (Vercel Blob Client Upload)

Timebox: 2 hours

Goal: prove direct client uploads work on Vercel with progress events and without sending file bytes to `/api/*`.

Tasks:

1. Create a temporary server route implementing Vercel Blob `handleUpload`

- Path: `src/app/api/blob/upload-token/route.ts`
- Use `handleUpload` from `@vercel/blob/client`.
- `onBeforeGenerateToken` returns:
  - `allowedContentTypes`: the allowlist above
  - `maximumSizeInBytes`: 20MB
  - `validUntil`: short-lived (default 10 minutes)
  - `allowOverwrite: false`
  - `addRandomSuffix: true`
- `onUploadCompleted`: temporary no-op (log only).

2. Create a temporary client page to upload a file using `upload()`

- Use `upload(pathname, file, { handleUploadUrl, onUploadProgress })`.
- Confirm `onUploadProgress` fires and reaches 100%.

3. Vercel preview deploy validation

- Upload a 15–20MB PDF.
- Confirm no `413` from your API route.
- Confirm Blob URL is returned and accessible.

Exit criteria:

- Direct upload succeeds with progress on Vercel preview.

Rollback:

- Delete temporary page if you don’t want it shipped; keep the server route (it’s part of the final design).

---

## Stage 1 — Data Model: `chat-assets` + `upload-sessions`

Timebox: 0.5 day

### 1.1 Add collection: `chat-assets`

Create: `src/server/payload/collections/ChatAssets/index.ts`

Pattern to follow:

- `tenantField`: `src/server/payload/fields/tenant.ts`
- `createdByField`: `src/server/payload/fields/createdBy.ts`
- Access control helper patterns: `src/server/payload/access/*`

Fields (minimum):

- `tenantField`
- `createdByField`
- `url` (text, required)
- `pathname` (text, required, index: true)
- `originalFilename` (text, required)
- `mimeType` (text, required)
- `filesize` (number, required)
- `retentionPolicy` (select: `persistent`|`ephemeral`, default `ephemeral`, admin.hidden: true)
- `expiresAt` (date, admin.hidden: true)
- `uploadSessionId` (text, required, index: true) — for idempotency/debug

Access:

- `create`: `() => false` (server-only; endpoints will use `overrideAccess: true`)
- `read`:
  - admins: all
  - users: query constraint `{ createdBy: { equals: user.id } }`
- `update`: `() => false` (server-only)
- `delete`: `() => false` (server-only)

Admin UI:

- Visible to admins as read-only list (debug/support)
- Hidden for non-admin

### 1.2 Add collection: `upload-sessions`

Create: `src/server/payload/collections/UploadSessions/index.ts`

Fields:

- `tenantField`
- `createdByField`
- `purpose` (select, default `chat-media`)
- `originalFilename` (text, required)
- `mimeType` (text, required)
- `expectedSize` (number)
- `pathname` (text, required, index: true)
- `blobUrl` (text)
- `status` (select: `initiated`|`uploaded`|`finalized`|`cancelled`|`failed`, default `initiated`, required)
- `chatAssetId` (relationship to `chat-assets`)
- `expiresAt` (date, required)

Access:

- `create/update/delete`: `() => false` (server-only via `overrideAccess: true`)
- `read`: `adminOnly` (keep it an internal record)

Admin UI:

- Visible to admins (debug)

### 1.3 Register collections

Modify: `src/payload.config.ts`

- Import new collections
- Add to `collections: [...]` array

### 1.4 Generate types

Commands (later, during implementation):

- `pnpm generate:types`
- `pnpm tsc --noEmit`

Exit criteria:

- Collections appear in Payload admin (for admin users).
- Type generation passes.

---

## Stage 2 — Server Upload API

Timebox: 1 day

This stage introduces two server endpoints:

1. `handleUpload` route used by `@vercel/blob/client.upload()`
2. explicit finalize route that creates `chat-assets`

### 2.1 Shared constants + sanitization

Create: `src/server/chat-assets/constants.ts`

- `CHAT_ASSET_MAX_BYTES = 20 * 1024 * 1024`
- `CHAT_ASSET_ALLOWED_MIME_TYPES = [...] as const`
- `CHAT_ASSET_MAX_ATTACHMENTS = 5`

Create: `src/server/chat-assets/filename.ts`

- `sanitizeFilename(original: string): string`
  - ASCII-safe
  - strip path separators
  - collapse whitespace
  - cap length (e.g. 120 chars)
  - keep extension if present

Create: `src/server/chat-assets/pathname.ts`

- `buildChatAssetPathname({ tenantId, userId, uploadSessionId, filename }): string`
  - Format: `chat-assets/<tenantId>/<userId>/<uploadSessionId>/<sanitizedFilename>`

### 2.2 Rate limiting utility

Create: `src/server/utils/rate-limiter.ts`

- Extract pattern from `src/app/(frontend)/signup/actions/signup_rateLimit-action.ts`
- Implement:
  - `createSlidingWindowLimiter({ windowMs, max }): { check(key): boolean; getRemaining(key): number }`
  - Use in-memory `Map` (acceptable for Vercel best-effort); document limitation.

### 2.3 `handleUpload` route (token issuance)

Create/Modify: `src/app/api/blob/upload-token/route.ts`

Purpose:

- This route is called by the client-side `upload()` function to obtain a client token.
- It must implement `handleUpload()` from `@vercel/blob/client`.

Implementation steps:

1. Auth

- `const payload = await getPayload({ config })`
- `const { user } = await payload.auth({ headers: request.headers })`
- If no user: return 401

2. Parse request body from `handleUpload` call

- `handleUpload` expects a specific JSON shape (`HandleUploadBody`).
- Use `handleUpload({ request, body, onBeforeGenerateToken, onUploadCompleted })`.

3. `onBeforeGenerateToken(pathname, clientPayload, multipart)`

Recommended approach:

- Client sets `clientPayload` to a JSON string containing:
  - `originalFilename`
  - `contentType`
  - `size`
  - `purpose` (default `chat-media`)

Server does:

- Validate `contentType` in allowlist; else throw/return error
- Validate `size <= 20MB`; else throw/return error
- Resolve `tenantId` via `getDefaultTenantId(payload)`
- Create `upload-sessions` doc (`overrideAccess: true`) with:
  - `originalFilename`, `mimeType`, `expectedSize`, `purpose`
  - `status = initiated`
  - `expiresAt = now + 24h`
  - `pathname` = computed pathname (ignore user-provided pathname)
- Return token constraints:
  - `allowedContentTypes`: [validated contentType]
  - `maximumSizeInBytes`: 20MB
  - `validUntil`: now + 10 minutes
  - `addRandomSuffix: false` (we already include sessionId; keep deterministic)
  - `allowOverwrite: false`
  - `tokenPayload`: serialize `{ uploadSessionId, tenantId, userId }`

Important:

- The pathname passed into `onBeforeGenerateToken` by the library is what the client requested. You should ignore it and return your own constraints/path rules. The blob SDK uses `tokenPayload` for verification; your finalize step is authoritative.

4. Rate limit

- Identify user by `user.id`.
- Enforce 10/min for token generation.
- IP soft limit: `x-forwarded-for` best-effort.

5. `onUploadCompleted`

Use it to reduce client trust:

- Decode `tokenPayload` to get `uploadSessionId`.
- Update upload session (overrideAccess: true):
  - `blobUrl` = `blob.url`
  - `status = uploaded`
  - `pathname` = `blob.pathname` (authoritative from callback)

Notes:

- This callback is invoked by Vercel Blob, not the browser. Do not assume cookies.
- Rely on tokenPayload, not request auth, inside onUploadCompleted.

Response handling:

- `handleUpload` returns either token generation response or upload-completed `ok`. Wire both.

### 2.4 Finalize route

Create: `src/app/api/chat-assets/finalize/route.ts`

Request (JSON):

- `uploadSessionId: string`

Response:

- `{ chatAssetId, chatAsset: { id, url, pathname, originalFilename, mimeType, filesize, expiresAt } }`

Implementation steps:

1. Auth

- Same Payload auth pattern
- 401 if no user

2. Rate limit

- 30/min/user

3. Load upload session

- `payload.findByID({ collection: 'upload-sessions', id: uploadSessionId, overrideAccess: true, depth: 0 })`
- Validate ownership:
  - if `createdBy` is not the current user: 403
- If `status === finalized`:
  - return existing `chatAssetId` (idempotency)
- If `status` not in `uploaded|initiated`:
  - return 409

4. Verify blob data

- Preferred: require upload session to have `blobUrl` and `pathname` populated by `onUploadCompleted`.
- If missing:
  - return 409 "upload not completed" (do not accept client-supplied URL)
- Verify `blobUrl` is Vercel Blob URL (`isVercelBlobUrl`).
- Verify blob metadata:
  - Use Blob adapter `getMediaBlobAdapter().getMetadata(blobUrl)`
  - Ensure size <= 20MB
  - Ensure contentType in allowlist

5. Create `chat-assets` doc

- Data:
  - `url = session.blobUrl`
  - `pathname = session.pathname`
  - `originalFilename = session.originalFilename`
  - `mimeType = session.mimeType`
  - `filesize = metadata.size` (authoritative)
  - `retentionPolicy = ephemeral`
  - `expiresAt = now + 30d`
  - `uploadSessionId`
- Create with `overrideAccess: true` and pass `req` so hooks populate `tenant` and `createdBy`.

6. Update session

- `status = finalized`
- `chatAssetId = created chat-assets id`

Exit criteria:

- Can finalize an uploaded blob into a `chat-assets` document.
- Finalize is idempotent.

---

## Stage 3 — Client Upload UX (Progress, Cancel, Retry)

Timebox: 1–2 days

### 3.1 Client-side direct upload implementation

Create: `src/ui/web/chat/hooks/useDirectChatAssetUpload.ts`

Core responsibilities:

- Validate files on selection (mime, size, count)
- Upload via `@vercel/blob/client.upload()` to Blob
- Show progress via `onUploadProgress`
- Support cancel via `AbortController`
- After upload completes, call finalize endpoint
- Maintain retry state and allow manual retry

State model per file:

- `localId` (uuid)
- `file`
- `status`: queued|uploading|uploaded|finalizing|complete|failed|cancelled
- `progress` 0..100
- `retryCount`
- `uploadSessionId`
- `chatAssetId`
- `error`
- `abortController`

Retry policy:

- Retryable: network errors + 5xx from finalize
- Non-retryable: 401/403/413/415/409
- Max 3 retries with exponential backoff + jitter
- Cancel transitions to `cancelled` and stops further retries

Upload call:

- `upload(pathname, file, { handleUploadUrl: '/api/blob/upload-token', clientPayload: JSON.stringify({...}), onUploadProgress, abortSignal })`
- Pathname passed can be a placeholder; server ultimately chooses constraints. Use a deterministic placeholder like `chat-assets/placeholder`.

Finalize call:

- `POST /api/chat-assets/finalize` with `{ uploadSessionId }`

### 3.2 UI component

Create: `src/ui/web/chat/components/ChatAssetUploads.tsx`

- Renders list of selected uploads
- For each item: filename, size, progress bar, status label
- Buttons:
  - cancel (uploading)
  - retry (failed)
  - remove (complete/failed/cancelled)

### 3.3 Integrate into chat hook

Modify: `src/ui/web/chat/hooks/useNotebookChat.ts`

- Replace existing `fetch('/api/media')` multipart upload flow.
- Store completed `chatAssetIds` returned by the new hook.
- When sending:
  - Pass `chatAssetIds` into chat API request.
- Ensure "Send" disabled when any file is uploading/finalizing.

Client-side limits:

- Update local `MAX_FILE_SIZE` used by UI validation from 10MB to 20MB.

Exit criteria:

- Upload 20MB PDF with visible progress and successful finalize.

---

## Stage 4 — Chat API + Persistence + AI Integration

Timebox: 1 day

### 4.1 Extend chat request schema

Modify: `src/server/payload/endpoints/agent/chat/request-validation.ts`

- Add `chatAssetIds: z.array(z.string()).max(5).optional()`

Modify: `src/server/services/api/api-service.ts`

- Extend `chat()` signature to accept `chatAssetIds?: string[]`.
- Include it in JSON body.

### 4.2 Conversation persistence

Modify: `src/server/payload/collections/Conversations.ts`

Approach (default): add separate `chatAssets` array next to `media` (avoid polymorphic migration).

Add to message fields:

- `chatAssets` array (maxRows 5)
- `chatAssetId` relationship to `chat-assets`

Modify persistence in:

- `src/server/payload/endpoints/agent/chat.ts`
- `src/server/payload/endpoints/agent/chat/pipeline.ts`

Store:

- existing `media` attachments (legacy)
- new `chatAssets` attachments

### 4.3 Validate + transform chat-assets into `MediaPartWithPath`

Create: `src/server/payload/endpoints/agent/chat/chat-asset-processing.ts`

Responsibilities:

- Accept `chatAssetIds`, ensure <= 5
- Query `chat-assets` by IDs with ownership constraint (`createdBy == userId`)
- Validate:
  - exists
  - not expired (`expiresAt`)
  - mime allowlist
  - size <= 20MB
- Convert to `MediaPartWithPath[]`:
  - `mediaId`: chatAsset.id (still required by type)
  - `type`: `pdf` if `mimeType === application/pdf` else `image`
  - `absoluteFilePath`: ''
  - `publicUrl`: chatAsset.url (Blob URL)
  - `mimeType`: chatAsset.mimeType

Integrate in:

- `src/server/payload/endpoints/agent/chat.ts`
- `src/server/payload/endpoints/agent/chat/pipeline.ts`

Behavior:

- Merge media parts from legacy `mediaIds` and new `chatAssetIds`.
- Enforce combined attachment count <= 5.

### 4.4 Fix AI media reading for blob-only parts

Problem:

- `src/infra/llm/providers/shared/media-reader.ts` and `src/infra/llm/services/exercise-chat-service.ts` both assume IDs live in `media` collection.

Fix strategy (minimal-change):

- If `mediaPart.publicUrl` is a Vercel Blob URL, fetch directly from it and skip `payload.findByID({ collection: 'media' })`.

Tasks:

1. Modify `src/infra/llm/providers/shared/media-reader.ts`

- In the fallback path (after fs read fails), before `payload.findByID`, check:
  - `if (isVercelBlobUrl(mediaPart.publicUrl))` then `fetch(mediaPart.publicUrl)` and convert.

2. Modify `src/infra/llm/services/exercise-chat-service.ts`

- In `sendMultimodalToGenkit`, if `isVercelBlobUrl(mediaPart.publicUrl)`, fetch that URL directly and base64 it.
- Keep existing behavior for legacy `media` attachments.

### 4.5 Streaming behavior

Streaming currently rejects `mediaIds`.

Modify:

- `src/server/payload/endpoints/agent/chat-stream.ts`
- `src/app/api/agent/chat/stream/route.ts`

Add: reject `chatAssetIds` with same 400 error.

Exit criteria:

- Sending a chat message with `chatAssetIds` results in AI receiving attachments.
- Conversation history stores chat-assets relationship.

---

## Stage 5 — Cleanup + Cron

Timebox: 0.5–1 day

### 5.1 Orphan upload session cleanup

Create: `src/server/payload/endpoints/cron/upload-session-cleanup.ts`

Pattern:

- Follow `src/server/payload/endpoints/cron/media-expiry.ts` + `withCronMiddleware`.

Logic:

- Find `upload-sessions` where:
  - `status in (initiated, uploaded, failed, cancelled)` AND
  - `expiresAt <= now`
- For each:
  - if `blobUrl` exists: delete blob via `getMediaBlobAdapter().delete(blobUrl)` (best-effort)
  - delete session doc (overrideAccess: true)
- Return stats.

Add Next route bridge:

- `src/app/api/cron/upload-session-cleanup/route.ts` (pattern: `src/app/api/cron/media-expiry/route.ts`)

### 5.2 Chat-assets expiry cleanup

Create: `src/server/payload/endpoints/cron/chat-asset-expiry.ts`

Logic:

- Find `chat-assets` where `retentionPolicy=ephemeral` and `expiresAt <= now`
- Delete blob via adapter using `url` (best-effort)
- Delete chat-asset doc (overrideAccess: true)
- Return stats.

Add Next route bridge:

- `src/app/api/cron/chat-asset-expiry/route.ts`

### 5.3 Vercel cron schedule

If `vercel.json` does not exist, create it.

Add:

- hourly: `/api/cron/upload-session-cleanup`
- every 6 hours: `/api/cron/chat-asset-expiry`

Exit criteria:

- Orphans are removed (blob + DB record)
- Expired chat-assets are removed (blob + DB record)

---

## Stage 6 — Hardening + Quality Gates

Timebox: 0.5 day

### 6.1 Tests

Add integration tests:

- Token route
  - 401 unauth
  - 413 oversize
  - 415 unsupported mime
- Finalize route
  - 401 unauth
  - 403 wrong user
  - idempotent finalize
- Chat endpoint
  - accepts `chatAssetIds` and persists them

Notes:

- For blob operations, mock `@vercel/blob` / adapter methods by default.

### 6.2 Type + lint gates

Run:

- `pnpm generate:types`
- `pnpm tsc --noEmit`
- `pnpm lint`
- `pnpm test:int`

### 6.3 Logging + Sentry

Add requestId correlation for:

- token route
- finalize route
- cleanup cron routes

Do not log blob URLs at info level unless redacted.

---

## Change List (Expected)

New files (core):

- `src/server/payload/collections/ChatAssets/index.ts`
- `src/server/payload/collections/UploadSessions/index.ts`
- `src/app/api/blob/upload-token/route.ts`
- `src/app/api/chat-assets/finalize/route.ts`
- `src/server/chat-assets/*` (constants/sanitize/path helpers)
- `src/server/utils/rate-limiter.ts`
- `src/ui/web/chat/hooks/useDirectChatAssetUpload.ts`
- `src/ui/web/chat/components/ChatAssetUploads.tsx`
- `src/server/payload/endpoints/agent/chat/chat-asset-processing.ts`
- `src/server/payload/endpoints/cron/upload-session-cleanup.ts`
- `src/server/payload/endpoints/cron/chat-asset-expiry.ts`
- `src/app/api/cron/upload-session-cleanup/route.ts`
- `src/app/api/cron/chat-asset-expiry/route.ts`

Modified files (high-impact):

- `src/payload.config.ts`
- `src/ui/web/chat/hooks/useNotebookChat.ts`
- `src/server/services/api/api-service.ts`
- `src/server/payload/endpoints/agent/chat/request-validation.ts`
- `src/server/payload/endpoints/agent/chat.ts`
- `src/server/payload/endpoints/agent/chat/pipeline.ts`
- `src/server/payload/collections/Conversations.ts`
- `src/infra/llm/providers/shared/media-reader.ts`
- `src/infra/llm/services/exercise-chat-service.ts`
- `src/server/payload/endpoints/agent/chat-stream.ts`
- `src/app/api/agent/chat/stream/route.ts`
