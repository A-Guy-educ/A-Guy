# High-Level Spec (HLS) v2 — Lesson Type Tabs

## Goal

Add a Lesson `type` field (Learning / Practice / Exam) and use it to filter **existing** client tabs that already render chapters + lessons on the course page.

Each tab must:

* Show only lessons matching its mapped `type`
* Hide chapters that have zero matching lessons
* Fall back missing lesson `type` to `learning`

## Decisions (Locked)

* Lesson `type` is a property of **Lesson only** (never Chapter/Course).
* Lesson `type` is **editable after creation**.
* Tabs already exist in the client and must be **reused** (no new tabs UI components).
* The existing query/loader/endpoints must remain **generic and unchanged** (no server-side filtering by type).
* Localization for tab labels already exists; **no i18n key additions** are required.

## Data Model

### Lesson

Add a required enum/select field:

* `type: 'learning' | 'practice' | 'exam'`

Field behavior:

* Required for new/updated lessons
* Default value: `learning`
* Indexed
* Editable in Payload admin

### Legacy Records (Missing type)

Some existing lessons may not have `type` until backfilled.

UI rule:

* `effectiveType = lesson.type ?? 'learning'`

Backfill rule:

* Migrate existing lessons with missing `type` to `learning`.

## UI / UX Behavior

### Tabs (Existing)

Tabs map 1:1 to lesson types:

* Learn → `learning`
* Practice → `practice`
* Exam → `exam`

Default active tab:

* Learn

### Rendering Rules (Per Active Tab)

Given:

* A list of chapters (ordered)
* A list of lessons (unfiltered)

Do:

1. Compute `effectiveType` for each lesson (`lesson.type ?? 'learning'`).
2. Filter lessons to those where `effectiveType === activeType`.
3. Group filtered lessons by chapter.
4. Render only chapters that have `>= 1` lesson after filtering.

Empty state:

* If no chapters remain after filtering, render the existing “empty” UX pattern (reuse existing copy/component; do not add new translations).

## Query / Data Fetch Strategy

### Principle

Keep the data layer generic.

Locked constraints:

* Do not add `type` filters to Payload queries.
* Do not add tab-specific endpoints or loader params.
* Fetch all required chapters + lessons using the existing query functions.

Filtering is a presentation concern:

* Filtering by `type` must occur inside the existing tabs rendering layer.

## Guardrails

* Do NOT add `type` to Chapter or Course.
* Do NOT infer type from route, tab index, or chapter structure.
* Do NOT create a new tabs implementation (reuse existing).
* Do NOT modify existing queries/loaders/endpoints to add type filtering.
* Chapter visibility must be derived strictly from lesson filtering results.

## Migration / Backfill

* Provide a migration/backfill step that sets `type='learning'` for existing lessons where `type` is missing/null.
* Until migration runs everywhere, the UI fallback (`?? 'learning'`) must prevent empty tabs caused by missing data.

## Acceptance Criteria

* Lesson has a required, editable `type` field in Payload with default `learning`.
* Existing tabs remain in place and continue to render chapters + lessons.
* Each tab shows only lessons of its mapped `type` (using `effectiveType`).
* Chapters with zero matching lessons are not rendered.
* If a tab has no content, an empty state is shown (reusing existing UX; no new i18n).
* Editing a lesson’s `type` moves it between tabs after refresh.
* No new tabs UI, no i18n edits, and no query changes were introduced.

## Non-Goals

* Per-course configurable default tab
* Adding new lesson types beyond the enum
* Progress tracking, grading, permissions, or analytics
