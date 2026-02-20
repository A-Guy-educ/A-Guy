---
# High-Level Specification (HLS)

## Chat Media Upload with Multimodal Model Support
---

## 1. Scope

Implement support for **media uploads in chat messages** and enable passing that media to the AI model (Gemini) using provider-native multimodal APIs.

This HLS covers:

- Reuse of existing Payload **Media collection**
- Chat-only media expiry (30 days)
- Multimodal input construction
- Cleanup via GitHub Actions
- Strict server-side guardrails

---

## 2. In-Scope

- Upload media via existing Payload Media upload endpoint
- Attach uploaded media to chat messages
- Pass media + text to Gemini provider
- Enforce **chat-only expiry (30 days)**
- Permanent deletion of expired media
- GitHub Action–based cleanup job

---

## 3. Out of Scope

- Media editing (crop, annotate, OCR)
- Streaming media
- Fallback handling for unsupported PDFs
- Media reuse across chats
- CDN or performance optimization beyond existing setup

---

## 4. Key Constraints (Locked)

- Storage provider: **Vercel Blob**
- Media collection: **existing Payload Media**
- Model provider: **Gemini (already encapsulated)**
- Max file size: **10 MB**
- Only **chat media** is ephemeral
- Deletion is **hard delete** (no soft/tombstone records)

---

## 5. Data Model Changes (Media Collection)

### New Fields

```ts
retentionPolicy: 'persistent' | 'ephemeral' // required, default: 'persistent'
expiresAt?: Date | null                     // required if retentionPolicy === 'ephemeral'
```

### Rules (Guardrails)

- `retentionPolicy` is **set server-side only**
- If `retentionPolicy === 'ephemeral'`:
  - `expiresAt = createdAt + 30 days` (mandatory)

- If `retentionPolicy === 'persistent'`:
  - `expiresAt = null`

- Validation must fail if:
  - `ephemeral` without `expiresAt`

---

## 6. Chat → Media → Message Flow

### Upload Phase

1. Client uploads file via **Payload Media upload endpoint**
2. Server validates:
   - MIME allowlist
   - File size ≤ 10MB

3. Server sets:
   - `retentionPolicy = 'ephemeral'`
   - `expiresAt = now + 30 days`

4. Media record is persisted

### Message Creation Phase

1. Client sends chat message payload:
   - text (optional)
   - media IDs (from upload step)

2. Message is persisted atomically:
   - text + media references together

3. Orphaned media is not allowed

---

## 7. MultimodalInput Abstraction

### Purpose

Provide a **provider-agnostic internal structure** representing everything sent to the model.

### Structure (Conceptual)

```ts
MultimodalInput {
  textParts: string[]
  mediaParts: {
    type: 'image' | 'pdf' | 'audio' | 'video'
    url: string        // signed or server-resolved
    mimeType: string
  }[]
}
```

### Notes

- This is **not** a storage model
- This is built **at model invocation time**
- Media URLs are resolved securely (tenant-safe)

---

## 8. Gemini Provider Mapping

- Convert `MultimodalInput` → Gemini-native multimodal request
- PDF is passed **directly** (no fallback)
- If Gemini rejects the request:
  - Return explicit error to chat
  - Do not retry or degrade silently

---

## 9. Expiry & Cleanup Lifecycle

### Cleanup Logic

- Target only:
  - `retentionPolicy === 'ephemeral'`
  - `expiresAt <= now`

- For each expired record:
  1. Delete blob from Vercel Blob
  2. Delete Media record from Payload
  3. Emit audit log event

### No soft deletes

Deletion is permanent.

---

## 10. Cleanup Execution (GitHub Actions)

### Architecture

- GitHub Action with `schedule` trigger (daily)
- Action calls internal endpoint:

```
POST /api/cron/media-expiry
Authorization: Bearer <CRON_SECRET>
```

### Endpoint Responsibilities

- Authenticate via `CRON_SECRET`
- Execute cleanup logic
- Log summary:
  - count deleted
  - failures (if any)

### Guardrails

- Endpoint must not be callable without secret
- No direct DB/Blob access from GitHub Action

---

## 11. Security & Access Control

- Media access is tenant-scoped
- Signed URLs or server-side fetch only
- Media is accessible only through chat context
- Cron endpoint is isolated and authenticated
- Client cannot control retention or expiry

---

## 12. Validation Rules (Server-Side)

- Max file size: **10MB**
- MIME allowlist enforced
- `retentionPolicy` ignored if sent by client
- Media must belong to same tenant as chat
- Model invocation blocked if:
  - Media record missing
  - Media expired
  - Media type unsupported by model

---

## 13. Failure Modes (Explicit)

| Scenario          | Behavior                     |
| ----------------- | ---------------------------- |
| File too large    | Upload rejected              |
| Unsupported MIME  | Upload rejected              |
| Expired media     | Chat returns “Media expired” |
| Model rejects PDF | Chat error, no fallback      |
| Cron auth failure | Cleanup aborted + logged     |

---

## 14. Testing Strategy (Required)

### Integration Tests

- Chat upload sets `ephemeral + expiresAt`
- Non-chat media remains `persistent`
- Expired media is deleted (blob + record)
- Cron endpoint rejects invalid secret
- Gemini request includes media parts

### Negative Tests

- Oversized file
- Unsupported MIME
- Expired media used in chat
- Missing media reference

---

## 15. Rollout Plan

### Phase 1 (v1)

- Images + PDF
- Gemini only
- Admin flag gated

### Phase 2 (Later)

- Audio / video
- Analytics enrichment
- Model capability matrix

---

## 16. Definition of Done

- Chat supports media uploads
- Media reaches Gemini successfully
- Expired chat media is deleted automatically
- No CMS media is affected
- No silent failures
- All guardrails enforced server-side

---
