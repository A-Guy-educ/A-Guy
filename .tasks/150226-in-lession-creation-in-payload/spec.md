# Spec: 150226-in-lession-creation-in-payload

## Overview

Improve the Payload Admin lesson creation/edit experience by disambiguating the `Lessons.chapter` relationship dropdown. The dropdown currently displays only `Chapters.title`, which is ambiguous when multiple chapters share the same name. The displayed option label must include both the chapter title and its parent course title.

## Requirements

### FR-001: Chapter Dropdown Displays Course Context

**Priority**: MUST
**Description**: In the Payload Admin UI, the `Lessons` collection `chapter` relationship field must display each option label as `"<chapter title> — <course title>"`.

Notes:

- Applies to both the dropdown list and the selected value display.
- If course title is unavailable for any reason, fall back to `"<chapter title>"` (never render an empty label).

### FR-002: Backfill Existing Chapters

**Priority**: MUST
**Description**: Existing `Chapters` documents must show the new combined label immediately after deployment, without requiring editors to resave each chapter manually.

### FR-003: Label Stays Correct Over Time

**Priority**: MUST
**Description**: The combined display label must remain accurate when:

- a chapter title changes
- a chapter’s course relationship changes
- a course title changes (so labels referencing that course update accordingly)

### NFR-001: No Relationship Data Changes

**Priority**: MUST
**Description**: The stored `Lessons.chapter` relationship value(s) must not change format or semantics (still points to `chapters` by ID). Only display/label behavior changes.

### NFR-002: Performance-Safe Admin Dropdown

**Priority**: MUST
**Description**: The admin dropdown must not introduce per-option N+1 queries at render time. Any course-title lookup required to build the label must be done in a way that scales to large chapter lists (e.g., denormalized field maintained via hooks/migrations, or equivalent batch-safe strategy).

### NFR-003: Tenant Safety

**Priority**: SHOULD
**Description**: The displayed course title must correspond to the chapter’s actual `course` relationship within the same tenant data model used by the system (no cross-tenant leakage in labels).

## Acceptance Criteria

- [ ] In Payload Admin, when creating a new Lesson (`lessons`), the `chapter` dropdown options render as `"<chapter title> — <course title>"`.
- [ ] After selecting a chapter, the field’s selected value also shows `"<chapter title> — <course title>"`.
- [ ] When two chapters share the same `title` but belong to different courses, the dropdown clearly differentiates them via the course title.
- [ ] Existing chapters (already in the database) show the combined label without requiring manual edits.
- [ ] Updating a Course title updates the displayed combined labels for its chapters in the Lesson chapter dropdown.
- [ ] The change does not alter Lesson data shape or stored relationship values.

## Guardrails

- Do not rename or change slugs for existing collections: `lessons`, `chapters`, `courses`.
- Do not change access control behavior for reading/writing lessons/chapters/courses beyond what is necessary to compute/maintain the display label.
- Do not change frontend (non-admin) behavior or APIs except for any new internal/derived field needed to support labeling.
- Avoid introducing UI-only hacks that depend on unstable internal admin query behavior when a stable schema-backed approach is available.

## Out of Scope

- Changing sorting, filtering, or search behavior of the chapter selector beyond label text.
- Adding additional context such as `chapterLabel`, `courseLabel`, or tenant name to the label (unless required to meet the MUST criteria).
- Updating other relationship fields elsewhere unless they naturally inherit the improved chapter label.
