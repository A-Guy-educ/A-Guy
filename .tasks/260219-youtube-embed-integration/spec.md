# Spec: 260219-youtube-embed-integration

## Overview

Enhance the existing `Media` collection “External” media type to support first-class YouTube embeds by auto-detecting YouTube URLs, extracting the video ID, fetching lightweight metadata (title/thumbnail) via YouTube oEmbed (no API key), persisting embed fields on the Media document, and rendering a responsive privacy-enhanced YouTube player everywhere external media is used (web + exercise renderer) without requiring changes to downstream media consumers.

High-level flow:

1. Editor creates/edits Media doc with `type = external` and pastes `externalUrl`.
2. A `beforeChange` hook resolves the URL into embed metadata.
3. Embed metadata is stored on the Media doc (`embedProvider`, `embedVideoId`, `embedUrl`, `embedTitle`, `embedThumbnailUrl`).
4. Frontend renderers read stored embed fields and choose the appropriate embed UI (YouTube vs generic iframe), with a legacy fallback to `externalUrl`.

## Requirements

### FR-001: Embed Provider Resolution Utilities

**Priority**: MUST
**Description**: Implement provider-agnostic utilities to resolve an external URL into a normalized `EmbedMetadata` structure.

- Create an embed “provider” model with an explicit union of supported providers (initially: `youtube`, `generic`).
- Implement URL detection + video ID extraction for common YouTube URL formats.
- Generate a privacy-enhanced YouTube embed URL using `https://www.youtube-nocookie.com/embed/<videoId>`.
- Fetch optional metadata from YouTube oEmbed endpoint:
  - Endpoint: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<videoId>&format=json`
  - Timeout: 5 seconds; failures must not throw past the resolver (graceful degradation).
- Implement a top-level resolver that tries providers in order (YouTube first), and falls back to `generic` where `embedUrl` equals the input URL and other fields are `null`.

Expected locations (new):

- `src/infra/media/embed/types.ts`
- `src/infra/media/embed/youtube.ts`
- `src/infra/media/embed/resolve.ts`
- `src/infra/media/embed/index.ts`

### FR-002: Persist Embed Metadata on Media Documents

**Priority**: MUST
**Description**: Extend the existing `Media` collection schema to store resolved embed metadata for `type = external`.

- Add five fields to the Media collection:
  - `embedProvider` (select; `youtube` | `generic`)
  - `embedVideoId` (text; nullable)
  - `embedUrl` (text; nullable)
  - `embedTitle` (text; nullable)
  - `embedThumbnailUrl` (text; nullable)
- Admin UI behavior:
  - Fields only visible when `type === external`.
  - Fields placed in the sidebar where appropriate.
  - Fields must be read-only (derived; not editor-authored).
  - Provide brief descriptions indicating auto-detection / auto-population.
- Run type generation after schema changes (`pnpm generate:types`) to ensure `payload-types` includes new fields.

Expected location (modify):

- `src/server/payload/collections/Media/index.ts`

### FR-003: Auto-Resolve External URLs via Media Hook

**Priority**: MUST
**Description**: Add a `beforeChange` hook for the Media collection that resolves `externalUrl` into embed fields for external media.

Hook behavior:

- Trigger conditions:
  - On `create` when `data.type === external` and `externalUrl` present: resolve.
  - On `update` when `data.type === external` and `externalUrl` changed from `originalDoc.externalUrl`: re-resolve.
  - On `update` when type changes away from `external`: clear embed fields (set to `null`) if the original doc had embed data.
  - Otherwise: no-op.
- Error handling:
  - Resolver failures must not fail the save.
  - Log info when resolving and log errors on failure using `req.payload.logger`.
- Side-effect placement:
  - Hook must live in `beforeChange` (network fetch is a side effect).

Expected location (new + register):

- `src/server/payload/collections/Media/hooks/resolveEmbed.ts`
- `src/server/payload/collections/Media/index.ts` (import + add to `hooks.beforeChange`)

### FR-004: Web Frontend Rendering for External Media (YouTube-Aware)

**Priority**: MUST
**Description**: Update the existing web External media renderer to render provider-specific embeds, with a first-class YouTube experience.

- For `embedProvider === youtube` and `embedVideoId` + `embedUrl` present:
  - Render a responsive 16:9 iframe embed using stored `embedUrl`.
  - Use `loading="lazy"`, `allowFullScreen`, a restrictive `referrerPolicy`, and a conservative `allow` list suitable for YouTube.
  - Use `embedTitle` as iframe `title` when present; otherwise use a reasonable fallback based on video ID.
- For other cases where `embedUrl` exists:
  - Render a generic iframe using `embedUrl`.
- Legacy/backward compatibility:
  - If embed fields are missing (older docs), fall back to rendering `externalUrl` as a generic iframe.
- Must not require changes to existing media consumers (i.e., keep behavior behind the existing `ExternalMedia` component).

Expected location (modify):

- `src/ui/web/media/ExternalMedia/index.tsx`

### FR-005: Admin Preview for External Media

**Priority**: SHOULD
**Description**: Improve the Payload admin preview for external media to reflect detected provider and metadata.

- Read form values reactively with `useFormFields`.
- Show:
  - Provider badge (distinct styling for YouTube).
  - Original URL and an “Open Link” action.
  - Title when available.
  - For YouTube: thumbnail preview (preferred over iframe in sidebar).
  - For non-YouTube / missing thumbnail: iframe preview using `embedUrl` or fallback to `externalUrl`.
  - Optional debug info (video ID) for YouTube.
- Use inline styles appropriate for Payload admin (no Tailwind dependency for admin-only components).

Expected location (modify):

- `src/ui/admin/MediaPreview/ExternalPreview.tsx`

### FR-006: Exercise Renderer Support for External Media

**Priority**: MUST
**Description**: Ensure the exercise renderer supports external media attachments, including YouTube embeds.

- Update the exercise `MediaAttachments` rendering to handle `media.type === external`.
- For YouTube external media with populated embed fields:
  - Render responsive 16:9 iframe embed using stored `embedUrl`.
  - Mirror key iframe security/performance attributes from the main web embed.
- For generic external:
  - Render iframe using `embedUrl` or fallback `externalUrl`.

Expected location (modify):

- `src/ui/web/exerciserenderer/components/MediaAttachments/index.tsx`

### FR-007: Unit Test Coverage for Embed + Hook Logic

**Priority**: MUST
**Description**: Add unit tests to validate URL parsing, resolver routing, and hook behaviors without making real network calls.

- YouTube utility tests:
  - URL detection supports common formats (`watch`, `youtu.be`, `embed`, `shorts`, `live`, `m.youtube.com`).
  - Video ID extraction returns the expected 11-char ID (or `null`).
  - Embed URL uses `youtube-nocookie.com`.
  - oEmbed fetch is mocked; success populates title/thumbnail; failures return base metadata.
- Resolver tests:
  - Provider routing returns YouTube metadata when YouTube resolver matches.
  - Fallback returns `generic` metadata when no provider matches.
- Hook tests:
  - Resolves on create (external).
  - Skips on update when URL unchanged.
  - Re-resolves on update when URL changed.
  - Clears embed fields when type changes away from external.
  - Does not throw/fail save if resolver throws.
  - Skips when external with no URL.
  - Supports generic URLs.

Expected locations (new):

- `tests/unit/infra/media/embed/youtube.test.ts`
- `tests/unit/infra/media/embed/resolve.test.ts`
- `tests/unit/hooks/resolveEmbed.test.ts`

### NFR-001: Backward Compatibility

**Priority**: MUST
**Description**: Existing Media documents and non-external media types must remain unaffected.

- Image/video/PDF uploads continue to render as before.
- Existing external media created prior to this change must still render via `externalUrl` fallback.

### NFR-002: Reliability Under Provider Failure

**Priority**: MUST
**Description**: The system must remain functional when YouTube oEmbed is unavailable.

- Media save must succeed even if oEmbed fetch errors, times out, or returns non-OK.
- When metadata fetch fails, embeds must still render using derived/stored `embedUrl` (at minimum), with `title`/`thumbnail` possibly missing.

### NFR-003: Privacy/Security Defaults for YouTube Embeds

**Priority**: MUST
**Description**: YouTube embeds must use privacy-enhanced mode and safe iframe attributes.

- Use `youtube-nocookie.com` embed URLs.
- Apply `referrerPolicy="strict-origin-when-cross-origin"` on the YouTube iframe.
- Use `loading="lazy"`.
- Use an explicit `allow` list.

### NFR-004: Performance

**Priority**: SHOULD
**Description**: Avoid unnecessary network calls and repeated parsing.

- Resolve on save only when URL changes.
- Store resolved fields on the document so reads do not need to re-fetch metadata.

## Acceptance Criteria

- [ ] Editors can create an External Media item by pasting a YouTube URL and saving; embed fields are auto-populated.
- [ ] YouTube URLs in multiple formats (watch, youtu.be, embed, shorts, live, mobile) resolve to the correct video ID.
- [ ] YouTube embeds render as a responsive 16:9 player in all web contexts that use the existing Media renderer.
- [ ] Exercise pages render external media attachments, including YouTube embeds.
- [ ] Non-YouTube external URLs still render via generic iframe without breaking.
- [ ] Switching a Media item’s type away from External clears embed fields.
- [ ] If network/oEmbed fails, saving still succeeds and rendering still works (without title/thumbnail).
- [ ] Existing non-external media types render unchanged.
- [ ] Unit tests cover provider utilities, resolver routing, and hook behavior with mocked fetch.

## Guardrails

- Do not introduce new collections, blocks, or consumer-facing schema beyond the existing Media collection.
- Do not require changes in “media consumer” features (Lessons, Posts, blocks, etc.); behavior must be encapsulated within Media + ExternalMedia renderer + exercise attachments.
- Embed fields are derived and read-only in admin; editors only manage `externalUrl`.
- Hook must not block or fail a save due to external network issues.
- Keep provider design extensible (add new provider by adding a resolver and updating the provider union/options).

## Out of Scope

- Additional providers beyond YouTube (e.g., Vimeo) and their parsing/metadata.
- Rich provider-specific UI beyond a standard responsive iframe and thumbnail preview.
- Migration/backfill job for existing external media documents (legacy fallback is sufficient).
- E2E tests and production monitoring/metrics for embed resolution (unit + manual verification only).
