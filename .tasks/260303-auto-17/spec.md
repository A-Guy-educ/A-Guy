# Spec: 260303-auto-17

## Overview

Fix a production bug where students cannot upload an image in the AI tutor chat (“צט”): the UI shows the file name (e.g., `Capture.JPG`) with status **Failed**, the image is not attached to the chat message, and the AI cannot “see”/use the image.

## Requirements

### FR-001: Student can upload chat image in prod

**Priority**: MUST  
**Description**: A student user on production (Chrome desktop) can select an image file and successfully upload it as a chat attachment, with the attachment becoming available for the AI tutor to use.

### FR-002: Support common image formats and case-insensitive extensions

**Priority**: MUST  
**Description**: The upload flow MUST accept at least JPEG and PNG images and MUST treat file extensions case-insensitively (e.g., `.JPG` must be handled the same as `.jpg`). Validation MUST not rely solely on filename extension.

### FR-003: Correct end-to-end attachment contract (upload → message → AI)

**Priority**: MUST  
**Description**: After upload succeeds, the chat message sent to the server MUST include a stable, server-confirmed attachment reference (e.g., attachment id and/or URL) plus required metadata (mime type, byte size). The AI tutor request MUST receive/resolve this reference so that image content is actually available during response generation.

### FR-004: Actionable error handling (no generic “Failed” only)

**Priority**: MUST  
**Description**: Any failure in the upload/attach/process pipeline MUST surface a user-actionable message and a stable machine-readable error code (e.g., `UPLOAD_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `UNAUTHORIZED`, `NETWORK_ERROR`, `STORAGE_UPLOAD_FAILED`, `OPTIMIZATION_FAILED`, `VISION_UNAVAILABLE`). “Failed” as the only signal is insufficient.

### FR-005: Retry and non-blocking behavior

**Priority**: SHOULD  
**Description**: Users SHOULD be able to retry a failed upload. If image upload fails, the chat MUST remain usable for text-only messages without requiring a page refresh.

### FR-006: Image preprocessing for AI compatibility (if vision is supported)

**Priority**: SHOULD  
**Description**: Before sending to an image-capable model, the system SHOULD generate an “AI-optimized” variant (orientation fix, resize, compression, metadata stripping) within configured limits. If optimization fails, the system SHOULD gracefully fall back (use original if within limits or ask user to re-upload).

### NFR-001: Security—authenticated, authorized, and scoped access

**Priority**: MUST  
**Description**: Upload/attach/read operations MUST require authentication and MUST enforce conversation-scoped authorization (only chat participants and admins can attach/read the image). The fix MUST NOT introduce public/anonymous upload paths.

### NFR-002: Security—file validation and safe serving

**Priority**: MUST  
**Description**: The server MUST validate image content using an allowlist and (where feasible) magic-byte sniffing; SVG MUST remain unsupported unless a dedicated sanitizer is introduced. Enforce server-side size and dimension limits to mitigate decompression bombs. Uploaded images MUST be served with correct content-type and `X-Content-Type-Options: nosniff`.

### NFR-003: Reliability—production-safe upload architecture

**Priority**: MUST  
**Description**: The production upload path MUST be robust to platform request-size/time limits (e.g., avoid proxying large `multipart/form-data` through constrained runtimes unless confirmed safe). The chosen approach (direct-to-storage signed upload vs server-mediated upload) MUST be explicitly defined and consistent.

### NFR-004: Observability—correlation and stage-level diagnostics

**Priority**: MUST  
**Description**: Each upload attempt MUST have a correlation/debug id that is propagated across client → upload endpoint(s) → message send → AI processing. Logs/metrics MUST identify the failing stage (select/upload/attach/preprocess/provider) and include HTTP status and error code (without logging image bytes).

### NFR-005: Performance—bounded resource usage

**Priority**: SHOULD  
**Description**: Enforce configurable limits (max bytes, max pixels, max images per message) and timeouts for preprocessing and AI vision calls to prevent latency/cost spikes.

### NFR-006: UX/i18n consistency

**Priority**: SHOULD  
**Description**: User-facing strings for upload states and errors SHOULD support the app’s i18n (including Hebrew/RTL) and present clear status transitions (e.g., Uploading → Processing → Ready → Failed).

## Acceptance Criteria

- [ ] Reproduction scenario is fixed: in **prod**, as **student** on **Chrome desktop**, uploading a JPEG named **`Capture.JPG`** succeeds (no “Failed”), and the attachment is visible/attached in the chat.
- [ ] After a successful upload, sending a chat message with the attachment results in an AI response that demonstrably had access to the image (or the server confirms the attachment reference was included in the AI request).
- [ ] `.JPG` (uppercase) is accepted and treated equivalently to `.jpg`.
- [ ] Unsupported formats fail with a specific message and error code (not only “Failed”).
- [ ] Files exceeding configured limits are rejected with an explicit “too large” message and error code.
- [ ] If an upload/attach step fails (non-2xx), the UI shows an actionable message and offers retry; no “ghost” attachments remain in the thread after retry/cancel.
- [ ] Upload endpoints require authentication (401 when unauthenticated) and enforce conversation-scoped authorization (403 when authenticated but not a participant).
- [ ] Server-side validation checks actual content (not only filename/MIME header) and blocks disallowed types (e.g., SVG).
- [ ] Logging/monitoring includes a correlation/debug id and stage-level error code for failures, without logging image bytes or other sensitive payload.

## Guardrails

- Do NOT create new public/anonymous upload routes or broaden existing media/chat read access beyond current role/thread rules.
- Do NOT bypass access control when using server-side APIs (if a user context is used, access enforcement must remain enabled).
- Do NOT add support for risky formats (e.g., SVG) unless a dedicated sanitization and security review is included.
- Do NOT log raw images, base64 payloads, or additional PII “for debugging.”
- Keep existing chat behavior (message sending, streaming, history) unchanged except where required to correctly attach and reference images.

## Out of Scope

- Adding support for non-image attachments (PDF/video/audio) or multi-file album features.
- Redesigning the chat UI beyond necessary attachment status/error presentation.
- Implementing content moderation beyond basic allowlist validation (unless already part of the platform).
- Broad changes to storage visibility (public vs private) unless required to fix the bug and explicitly agreed.

## Domain Expert Feedback (inputs incorporated)

- **@web-expert**: Common causes include MIME/type mismatches, incorrect `FormData` usage (manual multipart headers), auth/cookie issues in prod, body-size/timeouts, and UI state bugs where upload succeeds but message lacks attachment reference. Add retry, actionable errors, and correlation ids.
- **@llm-expert**: Define an image optimization step (orientation/resize/compress), a capability registry for vision models, routing when default model is non-vision, and graceful fallbacks (retry smaller, continue text-only).
- **@payload-expert**: Clarify whether uploads go to Payload Media directly or via signed direct-to-blob flow; ensure students are allowed to create/read chat-scoped media with proper access control; avoid serverless limitations by using direct-to-storage when needed.
- **@security-auditor**: Enforce auth + conversation-scoped authorization, allowlist + magic-byte validation, size/pixel limits, metadata stripping, safe headers, rate limiting, and PII-safe structured logs.

## Open Questions

1. What is the current upload path in prod (direct to Payload `/api/media`, Next.js route handler proxy, or signed direct-to-storage uploads)?
2. What HTTP status and server error (if any) correspond to the UI state `Capture.JPG` → `Failed` in production?
3. Are there existing size/type limits, and what are the desired limits for chat image uploads (max MB, max pixels, max images per message)?
4. Are chat images intended to be public or private? If private, how are read URLs authorized/signed for display in chat?
5. Does the frontend perform any client-side preprocessing (resize/compress/convert), and could it be producing an invalid/empty blob?
6. Does the AI tutor use a vision-capable model today, and if not, what is the intended routing behavior when an image is attached?
7. Are there role-based restrictions on creating Media documents (e.g., students blocked) that would explain prod-only failures?
