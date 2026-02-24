# Spec: 260224-html-pages-lesson-blocks

## Overview

Support HTML-based content pages as part of a lesson's flow. Transition the lesson content structure from an implicit "exercises-only" list to a STRICT ordered polymorphic `blocks` list that can contain both Exercises and HTML Content Pages.

## Requirements

### FR-001: ContentPages Collection
**Priority**: MUST
**Description**: Create a standalone `content-pages` collection to store HTML content. Must include fields for title, lesson (relationship), htmlContent (textarea with Quill editor), status (draft/published), and isActive. Slugs must be auto-generated and unique within the scope of a single lesson. Access control must restrict creation/updating to admins, and reading to authenticated users (for drafts) or anyone (published). Order is NOT stored on the ContentPage itself.

### FR-002: Shared HTML Validation
**Priority**: MUST
**Description**: Extract the existing HTML validation logic from the `HtmlBlock` config into a shared utility. Apply this exact same validation to the `htmlContent` field in the new `content-pages` collection.

### FR-003: Lesson Blocks Field (Strict Mode)
**Priority**: MUST
**Description**: Add a required `blocks` field to the `lessons` collection. This field must accept two block types: `exerciseRef` (referencing an exercise) and `contentPageRef` (referencing a content page). This array is the SOLE source of truth for a lesson's content and ordering.

### FR-004: Remove Exercise Order Field
**Priority**: MUST
**Description**: Delete the `order` field from the `exercises` collection. Order is now strictly defined by the `blocks` array on the lesson.

### FR-005: Lesson Content Resolution
**Priority**: MUST
**Description**: Implement a query function (`queryLessonBlocks`) that resolves a lesson's content strictly via the `blocks` array. It must batch-resolve the references to prevent N+1 queries. There is NO fallback query for exercises not listed in the blocks array.

### FR-006: LessonPager Component
**Priority**: MUST
**Description**: Generalize the existing `ExercisesPager` into a `LessonPager` that navigates through the mixed blocks. Renders exercises using `ExerciseRenderer` and content pages using a new `ContentPageRenderer`. Progress bar and navigation must account for all blocks.

### FR-007: Content Page Routing
**Priority**: MUST
**Description**: Implement a new route at `/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/content/[pageSlug]` that renders the full `LessonPager` with the specific content page selected based on the URL.

### FR-008: Enhanced Admin Editor
**Priority**: SHOULD
**Description**: Create a full-page WYSIWYG editor component (`ContentPageEditor`) for the `htmlContent` field in the admin panel, providing a larger editing area and a live preview toggle.

## Acceptance Criteria

- [ ] `content-pages` collection exists and enforces lesson-scoped slug uniqueness and HTML sanitization.
- [ ] `lessons` collection has a required `blocks` field accepting `exerciseRef` and `contentPageRef`.
- [ ] `exercises` collection no longer has an `order` field.
- [ ] `queryLessonBlocks` accurately resolves the `blocks` array and returns ordered content.
- [ ] The lesson pager UI displays both exercises and content pages in the exact order defined by the lesson `blocks`.
- [ ] Direct navigation to a content page URL (`/content/[slug]`) loads the pager at the correct step.
- [ ] E2E and integration tests verify the mixed-content workflow in strict blocks mode.

## Guardrails

- Do NOT change the existing HTML validation rules; only extract and reuse them.
- Ensure the CMS URL namespace does not collide (use `/content/` for lesson pages instead of `/pages/`).
- Fix any broken tests or queries that previously relied on the `order` field in the `Exercises` collection.

## Out of Scope

- Automated data migration script to convert existing implicit exercise relationships into explicit `blocks` references (explicitly told to skip backward compatibility).
- Complex nested block structures within content pages (content pages are a single HTML blob for now).
