# Spec: 260309-auto-347

## Overview

Fix a production bug where videos added to lessons/exercises in the Payload admin (either uploaded to Media or attached via URL) are saved successfully but do not render for **Student** users on the frontend. The fix must cover **video blocks inside exercises** and **lesson introduction video rendering**, using a single, consistent rendering/resolution path.

## Requirements

### FR-001: Render videos for students in exercise video blocks

**Priority**: MUST  
**Description**: In the student-facing exercise view, any configured “video” block must render an HTML5 video player when video data is present.

### FR-002: Render videos for students in lesson introductions

**Priority**: MUST  
**Description**: In the student-facing lesson introduction view, any configured lesson intro video must render using the same video rendering/resolution logic as exercise video blocks.

### FR-003: Support both Media relationship and direct URL storage forms

**Priority**: MUST  
**Description**: The video renderer must accept (and correctly resolve) video sources stored as:

1. A **relationship** to the Payload `media` collection (either populated Media doc or an ID), and/or
2. A **direct URL string** (already absolute), and/or
3. A media-like object shape that contains at least `url` and optional `mimeType`/`filename`.

The renderer must choose the best available source deterministically (e.g., direct URL overrides relationship if both are present, if that matches existing product intent).

### FR-004: Ensure the rendered video `src` is publicly reachable (absolute URL)

**Priority**: MUST  
**Description**: The video `src` used by the frontend must be a valid, absolute URL in production.

- If a resolved Media `url` is relative (e.g., `/media/file.mp4`), the frontend must convert it to an absolute URL using a configured public base/origin (not `window.location` in server-rendered paths).
- If the URL is already absolute (e.g., blob/CDN), it must be used as-is.

### FR-005: Do not incorrectly hide videos due to MIME type filtering

**Priority**: MUST  
**Description**: Video display must not be blocked by overly strict or incorrect MIME type checks.

- Treat `mimeType` values starting with `video/` as renderable.
- Support at minimum: `video/mp4`, `video/webm`, `video/ogg`.
- If `mimeType` is missing or non-specific (e.g., `application/octet-stream`), the renderer must still attempt to render the video (do not silently drop it); when `mimeType` is unknown, omit the `<source type>` attribute.

### FR-006: Access control must be enforced (no Local API bypass)

**Priority**: MUST  
**Description**: Any server-side fetching/resolution of lesson/exercise/media data for the student experience must not bypass Payload access control.

- When using Payload Local API “on behalf of” a user, calls must include both `user` and `overrideAccess: false`.
- When resolving for anonymous/public access, Local API calls must still use `overrideAccess: false` so anonymous access rules are enforced.

### FR-007: Query/Resolution strategy must be explicit and consistent

**Priority**: MUST  
**Description**: The implementation must choose and document one of the following strategies (or a hybrid with clear precedence):

- **Depth-based**: student queries fetch lessons/exercises with sufficient `depth` so Media relationships are populated with `url`/`mimeType`, or
- **Renderer-based**: student queries can keep `depth: 0`, and the renderer resolves Media IDs server-side (with access enforced) to obtain `url`/`mimeType`.

In either case, the fields required for rendering must be present at render time.

### FR-008: Provide a user-visible fallback when video cannot be rendered

**Priority**: SHOULD  
**Description**: If the video source cannot be resolved (missing ID, missing URL, access denied, or other non-fatal issues), the UI should show a localized, non-breaking fallback message instead of rendering nothing.

Notes:
- If implementing runtime load failure messaging via `<video onError>`, the spec allows a client-component wrapper; otherwise fallback may be limited to “missing/unresolvable data”.

### NFR-001: No regression for other block types and layouts

**Priority**: MUST  
**Description**: Changes must not alter rendering of non-video blocks or other lesson/exercise content. The fix must be scoped to video-related rendering/resolution only.

### NFR-002: Performance—avoid N+1 media lookups

**Priority**: SHOULD  
**Description**: The chosen resolution strategy must avoid per-block/per-video repeated lookups when multiple video blocks exist on a page (prefer depth population, batching, or caching within the request lifecycle).

### NFR-003: i18n coverage for new user-facing text

**Priority**: MUST  
**Description**: Any new fallback/error messages must be translated in all supported locales (at minimum `en` and `he`) and follow existing Next.js `next-intl` patterns.

### NFR-004: Test coverage for the regression

**Priority**: SHOULD  
**Description**: Add automated coverage that would fail before the fix and pass after, covering both:

- Exercise video block renders a `<video>` with a valid `src`.
- Lesson introduction video renders a `<video>` with a valid `src`.

Tests must include at least one case where Media `url` is relative and must be made absolute, and one case where `mimeType` is missing/unknown but video still renders.

## Acceptance Criteria

- [ ] In production-like configuration, a Student viewing an exercise with a configured video block sees an HTML5 video player and the video loads.
- [ ] In production-like configuration, a Student viewing a lesson introduction with a configured video sees the same HTML5 video player and the video loads.
- [ ] Videos render when the block stores a relationship to Media (populated doc).
- [ ] Videos render when the block stores only a Media ID (resolution via `depth` or server-side lookup), with access control enforced.
- [ ] Videos render when the block stores a direct URL string.
- [ ] Relative Media URLs are converted to absolute URLs using a configured public origin; absolute URLs remain unchanged.
- [ ] MIME type handling does not filter out valid videos; at minimum mp4/webm/ogg work, and missing/unknown MIME types still attempt to render.
- [ ] The student path does not “fix” the issue by bypassing access control (no admin-context reads; Local API calls enforce access rules with `overrideAccess: false`).
- [ ] When video data is missing/unresolvable, the UI shows a localized fallback message (and does not break surrounding content).
- [ ] No regressions in rendering for other blocks or lesson/exercise content.

## Guardrails

- Do not change admin authoring UX, block schemas, or upload behavior unless strictly required to render existing saved data.
- Do not introduce new endpoints or privileged server reads that bypass Payload access control to make videos “work”.
- Do not hardcode media URL paths; use the canonical Media `url` returned by Payload/storage and make it absolute safely.
- Keep the fix limited to student/frontend rendering for:
  - exercise video blocks
  - lesson introduction video
- Avoid duplicating rendering logic in multiple places; prefer a shared video renderer used by both surfaces.

## Out of Scope

- Adding captions/subtitles UI (`<track>`), transcoding, or multiple source variants beyond basic HTML5 support.
- Changing storage providers (e.g., moving to a different blob/CDN setup).
- Broad refactors of the block rendering system unrelated to video.
- New product decisions about whether all media is public vs protected (see Open Questions); only implement what is necessary to satisfy the current access model.

## Open Questions

1. **Media access model**: Are video files intended to be public to anyone with the link, or protected to authenticated/enrolled students only? (This affects whether absolute URLs can be used directly or must be signed/proxied.)
2. **Published vs draft**: Do lessons/exercises use drafts/versions, and is the video being attached only in a draft while students view published content? If yes, the student query must explicitly fetch published content and/or authoring workflows must ensure publishing includes the video.
3. **Field shape**: What is the exact stored shape for the video in (a) exercise blocks and (b) lesson intro (relationship field name(s), URL field name(s))? The renderer must support the actual persisted shapes.
4. **Origin configuration**: What is the single source of truth for the public origin/base URL used to convert relative `media.url` into an absolute URL in production?

## Domain Expert Feedback (incorporated)

- **@web-expert**: Specify support for relationship/ID/URL shapes; ensure absolute URL building is server-safe; improve MIME type tolerance; add localized fallback; reuse a single renderer for exercise and lesson intro.
- **@payload-expert**: Ensure Media `access.read` and student queries/resolution do not rely on access bypass; explicitly choose depth-based vs renderer-based Media resolution; use Media doc `url` as canonical source; be mindful of draft vs published lesson/exercise differences.
- **@security-auditor**: Add guardrails against Local API access bypass; make media protection/publicness explicit; minimize Media fields returned; prevent IDOR by tying access to parent resource if media is protected.
