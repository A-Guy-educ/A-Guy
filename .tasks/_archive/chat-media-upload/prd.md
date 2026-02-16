---

# PRD — Multimodal Media Upload Support in Chat

## 1. Overview

Enable the chat system to support **media uploads (images, audio, video, documents)** that are sent as part of a user message and made available to the underlying AI model in a **first-class, structured way**.

This feature is a **capability enabler** for future use cases: multimodal tutoring, PDF reasoning, image-based exercises, audio feedback, and rich AI workflows.

This is not a UX experiment. This is infrastructure.

---

## 2. Problem Statement

Current chat supports **text-only interactions**.

Limitations:

- Cannot reason over images (diagrams, screenshots, handwritten notes)
- Cannot process PDFs or media-based exercises
- Cannot evolve toward multimodal AI assistants
- Forces out-of-band hacks (copy-paste, external tools, context loss)

This blocks:

- Advanced educational flows
- AI tutors for visual/math content
- PDF-centric workflows already present in the system

---

## 3. Goals

### Primary Goals

- Allow users to upload media **as part of a chat message**
- Make uploaded media **accessible to the AI model**
- Store media **securely and traceably**
- Support **multiple media types** in a single message

### Secondary Goals

- Enable future automation and agent workflows using media
- Keep model-agnostic architecture (OpenAI, Gemini, future providers)
- Maintain strict tenant and access isolation

---

## 4. Non-Goals (Explicit)

- No real-time streaming (v1)
- No media editing (crop, annotate, etc.)
- No OCR / transcription guarantees (model-dependent)
- No public media sharing
- No CDN optimization work beyond basics

---

## 5. Supported Media Types (v1)

| Type      | Formats                 |
| --------- | ----------------------- |
| Images    | PNG, JPG, JPEG, WEBP    |
| Documents | PDF                     |
| Audio     | MP3, WAV                |
| Video     | MP4 (pass-through only) |

Constraints:

- Max file size (configurable, default: 20MB)
- Max files per message (default: 5)

---

## 6. User Experience (UX)

### Chat Input

- “Upload media” button next to text input
- Drag & drop support
- Preview thumbnails before sending
- Media + text sent as **one atomic message**

### Chat Timeline

- Media rendered inline (image preview, PDF icon, audio player)
- Clear association between message and media
- No auto-processing UI promises

---

## 7. Functional Requirements

### Message Composition

- A chat message may contain:
  - Text (optional)
  - One or more media attachments

- Message send is atomic: **either all parts succeed or none**

### Media Handling

- Upload → temporary storage → validation → permanent storage
- Virus / file-type validation (basic)
- MIME type verification (not extension-based)

### Model Invocation

- Media must be passed to the model using **provider-native multimodal APIs**
- Fallback behavior:
  - If model does not support a media type → explicit error
  - No silent degradation

---

## 8. Data Model

### New / Extended Entities

#### `ChatMessage`

- `id`
- `chatId`
- `sender`
- `text`
- `media[]` → references to `MediaAsset`
- `modelContextSnapshot`
- `createdAt`

#### `MediaAsset`

- `id`
- `tenant`
- `type` (image | pdf | audio | video)
- `mimeType`
- `size`
- `storageUrl`
- `checksum`
- `createdBy`
- `createdAt`
- `accessScope` (chat-only)

---

## 9. Architecture (High Level)

```
Client
  → Media Upload API
    → Validation
    → Storage (tenant-scoped)
      → MediaAsset
  → Chat Send API
    → Message + media references
      → Model Adapter
        → Provider-specific multimodal call
```

Key rule:
**Chat never directly handles blobs — only references.**

---

## 10. Security & Access Control

- Media is **tenant-scoped**
- Media access requires:
  - Authenticated user
  - Membership in chat tenant

- Signed URLs with expiration
- No public URLs
- Audit log includes:
  - Upload
  - Model access
  - Deletion

---

## 11. Model Compatibility Strategy

### Provider Abstraction

- Introduce `MultimodalInput` abstraction
- Each provider adapter maps:
  - Text → text
  - Media → provider-native format

### Explicit Capability Flags

- Model declares:
  - `supportsImages`
  - `supportsPDF`
  - `supportsAudio`

- Chat UI enforces compatibility **before send**

No guessing. No magic.

---

## 12. Analytics & Observability

Track:

- Media uploads per tenant
- Media type distribution
- Model invocations with media
- Failure reasons (size, format, model incompatibility)
- Cost attribution (tokens + media)

---

## 13. Risks & Mitigations

| Risk                | Mitigation                  |
| ------------------- | --------------------------- |
| Model inconsistency | Capability flags            |
| Cost explosion      | Per-tenant limits           |
| Storage bloat       | Retention policy            |
| UX confusion        | Explicit errors             |
| Security leaks      | Signed URLs + tenant checks |

---

## 14. Rollout Plan

### Phase 1

- Images + PDF
- One model
- Admin-only flag

### Phase 2

- Audio
- Multiple models
- Usage analytics

### Phase 3

- Video pass-through
- Agent & automation hooks

---

## 15. Success Metrics

- % of chats using media
- Model success rate with media
- User retention on multimodal chats
- Reduction in external tool usage
- Cost vs value per tenant

---

## 16. Open Questions (Must Be Answered Before LLP)

1. Which model is first-class in v1?
2. Storage backend choice (existing vs new)
3. Retention policy default
4. Hard limits per tenant
5. Do we allow system messages with media?

---

**Guardrail — Media Expiry**
All uploaded media assets are subject to a mandatory expiration policy.
By default, every `MediaAsset` is assigned an `expiresAt` timestamp of **30 days from upload**.
Upon reaching expiry, the asset is **permanently deleted** from storage and becomes inaccessible to chat history, models, and automations.
Extensions or exemptions are allowed **only via explicit system or admin action** and are never implicit.
