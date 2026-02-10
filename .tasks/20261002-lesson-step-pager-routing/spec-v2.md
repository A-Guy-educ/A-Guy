# Spec v2: Lesson Exercises Pager Synced With Routes

## Document Control

- Date: 2026-02-10
- Owner: Product + Engineering
- Status: Draft for implementation (v2 -- post-mortem revision)
- Stage: 1 (Routes + Data model + Pager sync)
- Supersedes: `.tasks/20261002-lesson-step-pager-routing/spec.md` (v1)

## Revision History

| Version | Date       | Changes                                                                |
| ------- | ---------- | ---------------------------------------------------------------------- |
| v1      | 2026-02-10 | Initial spec                                                           |
| v2      | 2026-02-10 | Post-mortem: 13 issues found in v1 implementation, all addressed below |

## v1 Post-Mortem Summary

The v1 implementation broke the system. Root causes:

1. **`slug` was optional but treated as always-present** via `as any` casts (7 locations). Exercises without slugs produced URLs like `/exercises/null`.
2. **`formatSlug` strips all non-ASCII characters** -- Hebrew titles (the primary language) produce empty or meaningless slugs.
3. **Validation rejected self-updates** -- admins couldn't save existing exercises; the backfill script also failed.
4. **No ID fallback** -- the system was all-or-nothing on slugs with no graceful degradation.

See **Appendix A** for full 13-issue breakdown.

---

## Goal

Sync the lesson exercises pager with routes so:

- Exercise pages are canonical by exercise slug (unique within the lesson)
- The pager uses routes for navigation (no purely in-memory page state)
- The pager includes two constant content pages per lesson: pre-exercises (intro) and post-exercises (complete)
- **v2: Graceful fallback to exercise ID when slug is unavailable -- no data migration required**

## Non-Goals

- Implement the hierarchical question numbering system (A/A.1, etc.).
- Re-design the UI.
- Add draft/preview flows for unpublished lessons.
- Client-side completion tracking (tracked separately).
- **Data migration / backfill scripts** -- the system must work with existing data as-is.

## Requirements

### Functional Requirements

- FR-1: Every pager page has a stable, shareable URL.
- FR-2: Exercise pages are canonical by slug when available, scoped to the lesson:
  - Preferred route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/exercises/:exerciseSlug`
  - Fallback route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/exercises/:exerciseId`
  - `exerciseSlug` is unique within the lesson.
- FR-3: The pager includes exactly two constant content pages per lesson:
  - Pre-exercises (intro)
  - Post-exercises (complete)
- FR-4: The intro page route is the existing lesson route:
  - `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug`
- FR-5: The complete page route is:
  - `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/complete`
- FR-6: Pager navigation uses the following sequence:
  - intro -> exercises (ordered) -> complete
- FR-7: Pager shows "exercise N of M" on exercise routes by ordinal position among exercises only.
- FR-8: Validation:
  - If exercise param does not match any exercise for the lesson (by slug or ID), return 404.
  - If exercise exists but belongs to a different lesson, return 404.
- **FR-9 (v2): Dual-mode route resolution with ID fallback:**
  - The `[exerciseSlug]` route param accepts BOTH slugs and MongoDB ObjectIDs.
  - Resolution order:
    1. Try slug-based lookup: `queryExerciseBySlug({ lessonId, slug })`
    2. If not found AND param looks like an ObjectID: try ID-based lookup via `queryExerciseById({ id })`
    3. If found by ID and exercise belongs to this lesson AND has a slug: redirect (308) to canonical slug URL
    4. If found by ID and exercise belongs to this lesson but has NO slug: **render the exercise in-place** (no redirect, no 404)
    5. If not found by either method: 404
- **FR-10 (v2): URL construction uses slug-or-ID:**
  - When building exercise URLs (prev/next, links, cards), use: `exercise.slug || exercise.id`
  - Zero `as any` casts -- use a typed helper function `getExerciseUrlParam()`.
- **FR-11 (v2): Slug generation supports Hebrew/Unicode:**
  - Use the `slugify` npm package with locale support.
  - Fallback for empty slugs after processing: `exercise-{order}` or `exercise-{shortId}`.
  - Applies to ALL collections using `formatSlug` (Courses, Chapters, Lessons, Exercises).
- **FR-12 (v2): Slug uniqueness validation excludes self on update:**
  - Both the `beforeChange` hook and `validate` function exclude the current document ID when checking uniqueness.

### Non-Functional Requirements

- NFR-1: Deterministic ordering for exercises:
  - Primary sort: `order ASC`
  - Tie-breakers: `createdAt ASC`, then `id ASC`
- NFR-2: No N+1 queries to compute pager state; fetch the ordered exercises list once per lesson.
- NFR-3: Do not introduce new infrastructure (queues, cron, external services).
- **NFR-4 (v2): Zero `as any` casts in route/URL construction code.**
- **NFR-5 (v2): No duplicated resolution logic between `page` and `generateMetadata`.**
- **NFR-6 (v2): No data migration required.** The system works immediately on deploy with existing data. Slugs populate organically as exercises are created or updated.

## Data Model

### Exercises: Add `slug` field (canonical identity within a lesson)

Add a new text field on `exercises`:

- Field: `slug` (text, **optional** -- `required: false`)
  - Rationale: existing exercises lack slugs and there is no migration step. The system must handle null/undefined slugs gracefully via ID fallback.
- Index: `true` (for query performance)
- Uniqueness: unique within the same `lesson` when non-null (compound constraint).
  - Implementation: custom validation + compound DB index `{ lesson: 1, slug: 1 }` (sparse).
  - **v2: Validation MUST exclude the current document on update** (`id != currentId`).
- Generation:
  - Auto-generated from `title` via `slugify` library (supports Hebrew).
  - De-duplicated within the same lesson by appending `-1`, `-2`, etc.
  - **v2: Regenerates on title change** (not only on create).
  - **v2: If slug resolves to empty after processing, use fallback:** `exercise-{order}` or `exercise-{shortId}`.
  - **v2: beforeChange hook excludes self when checking uniqueness on update.**

## Routing

### Intro Page (Pre-Exercises)

- Route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug`
- Behavior:
  - When a lesson is in "interactive exercises" mode, render the intro page as page 0 of the pager.
  - "Start" button links to first exercise URL using `getExerciseUrlParam(exercise)`.

### Canonical Exercise Page

- Route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/exercises/:exerciseSlug`
- **v2 Lookup contract (dual-mode):**
  1. Try `queryExerciseBySlug({ lessonId, slug: param })`.
  2. If not found AND `isObjectId(param)`: try `queryExerciseById({ id: param })`.
  3. If found by ID:
     - If exercise belongs to this lesson AND has a slug: redirect (308) to canonical slug URL.
     - If exercise belongs to this lesson AND has NO slug: render in-place.
  4. If not found by either method: 404.
- Prev/next URLs: use `getExerciseUrlParam(exercise)` (returns `slug || id`).

### Complete Page (Post-Exercises)

- Route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/complete`
- "Previous" button uses `getExerciseUrlParam(lastExercise)`.

### Legacy Exercise ID Route

- Handled by the dual-mode resolution in FR-9 (no separate route needed).
- Exercises with slugs: ID access redirects 308 to slug URL.
- Exercises without slugs: ID access renders in-place.

## Pager Behavior

### Step Source

- Steps are implicit:
  - intro (lesson route)
  - exercises (ordered list)
  - complete (complete route)
- Exercises list source: `queryExercisesByLesson({ lessonId })` ordered by `order ASC, createdAt ASC, id ASC`.

### Next/Prev Computation

- Page positions:
  - `introIndex = 0`
  - exercise pages are `1..N`
  - `completeIndex = N + 1`
- Current route -> current index:
  - Lesson route = `introIndex`
  - Exercise route = `1 + indexOf(exercise in ordered list)`
  - Complete route = `completeIndex`
- Navigation:
  - prev of `introIndex` is disabled
  - next of `introIndex` goes to first exercise if any, else to complete
  - prev/next on exercise pages goes to adjacent exercise or intro/complete as appropriate
  - next of complete is disabled
- **v2: All URL construction uses `getExerciseUrlParam()` -- never raw `.slug` access.**

### Exercise Ordinal Display

- `Exercise {ordinal} of {total}` -- same as v1.

## Out of Scope

- Content pages between exercises.
- Admin UX for editing interleaved step sequences.
- Deep linking to question blocks inside an exercise.
- Progress persistence keyed by step order.
- Data migration / backfill scripts.
- **Client-side completion tracking** (tracked as separate follow-up task).

## Gates

### Gate 1 -- Routing + Sync Works

- Exercise with slug: slug-based URL renders correctly.
- Exercise without slug: ID-based URL renders correctly (no 404).
- Exercise with slug accessed by ID: redirects 308 to slug URL.
- Next/prev navigates across intro -> exercises -> complete correctly.
- Hebrew-titled exercises created going forward get valid slugs.

### Gate 2 -- Determinism + Integrity

- Default ordering is deterministic (`order ASC, createdAt ASC, id ASC`).
- 404 behavior is consistent for missing/mismatched exercises.
- Admin can save/update existing exercises without validation errors.

### Gate 3 -- Type Safety

- Zero `as any` casts in route/URL construction code.
- `getExerciseUrlParam()` is the single source of truth for exercise URL params.
- `generateMetadata` shares resolution logic with `page` (no duplication).

## Risks and Mitigations

| Risk                                                                      | Mitigation                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Compound uniqueness for `(lesson, slug)` not enforced at DB level         | Add sparse compound index + validation. Validation excludes self on update.            |
| Hebrew transliteration produces unexpected slugs                          | Use well-maintained `slugify` library. Add fallback for empty results.                 |
| Exercises without slugs break URL construction                            | `getExerciseUrlParam()` falls back to exercise ID. Route handles both.                 |
| Existing exercises have no slugs                                          | No migration needed. ID fallback renders them correctly. Slugs populate organically.   |
| Race condition in slug generation (concurrent creates)                    | Accept as low-risk. Sparse compound index prevents duplicate slug inserts at DB level. |
| Mixed slug/ID URLs in same lesson (some exercises have slugs, some don't) | Acceptable transitional state. URLs are functional regardless.                         |

## Timebox

- 1-2 engineering days for routes + data model + minimal tests.

## Definition of Done

- Data model changes implemented (exercise slug with Unicode support).
- `formatSlug` supports Hebrew via `slugify` library (all collections benefit).
- Canonical exercise slug routes work.
- ID fallback works for exercises without slugs (no 404, no migration needed).
- Intro and complete pages are routable and participate in next/prev navigation.
- Exercise ID access redirects to slug URL when slug exists; renders in-place when not.
- Zero `as any` casts in URL construction.
- Validation allows self-updates (excludes current doc ID).
- Tests cover route resolution (slug + ID) + ordering + next/prev.
- No backfill script required.

---

## Appendix A: v1 Post-Mortem Issues

| #   | Severity | Issue                                                      | Root Cause                                    | v2 Fix                                                       |
| --- | -------- | ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| 1   | CRITICAL | `as any` hides null slugs in 7 URL locations               | `slug` optional but treated as required       | FR-10: `getExerciseUrlParam()` returns `slug or id`          |
| 2   | HIGH     | `beforeChange` hook no self-exclusion on updates           | Missing `id != currentId` in uniqueness check | FR-12: Exclude self in hook + validate                       |
| 3   | HIGH     | `validate` rejects self-updates (finds itself)             | Missing `id != currentId` in validation query | FR-12: Exclude self in validation                            |
| 4   | HIGH     | `formatSlug` strips all non-ASCII (Hebrew) chars           | `\w` regex only matches `[A-Za-z0-9_]`        | FR-11: Use `slugify` npm package                             |
| 5   | MEDIUM   | Legacy ID redirect hard-404s valid exercises without slugs | No fallback to render-in-place                | FR-9: Dual-mode resolution, render in-place                  |
| 6   | MEDIUM   | Double `queryLessonBySlug` + null slug on intro "Start"    | `(exercises[0] as any).slug`                  | FR-10: Use `getExerciseUrlParam()`, fix query                |
| 7   | HIGH     | Prev/next nav crashes if neighbor lacks slug               | `as any` hides nullability                    | FR-10: `getExerciseUrlParam()` for all URLs                  |
| 8   | MEDIUM   | Complete page "Previous" same problem                      | `as any` hides nullability                    | FR-10: `getExerciseUrlParam()`                               |
| 9   | MEDIUM   | Backfill script fails due to validation bug (#3)           | Validate finds itself                         | No backfill needed. FR-12 fixes validation for normal saves. |
| 10  | LOW      | Lesson slug not globally unique                            | `queryLessonBySlug` returns first match       | Out of scope (pre-existing)                                  |
| 11  | MEDIUM   | Lost ExercisesPager state management                       | Removed without replacement                   | Tracked as separate follow-up task                           |
| 12  | LOW      | ExerciseWorkspaceProps type drift                          | Types file stale                              | Update types to match actual props                           |
| 13  | LOW      | Duplicated redirect logic in `generateMetadata`            | Copy-paste of resolution                      | NFR-5: Extract shared resolution helper                      |
