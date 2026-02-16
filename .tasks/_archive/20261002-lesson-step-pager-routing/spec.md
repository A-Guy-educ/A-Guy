# Spec: Lesson Exercises Pager Synced With Routes (Simplified)

## Document Control

- Date: 2026-02-10
- Owner: Product + Engineering
- Status: Draft for implementation
- Stage: 1 (Routes + Data model + Pager sync)

## Goal

Sync the lesson exercises pager with routes so:

- Exercise pages are canonical by exercise slug (unique within the lesson)
- The pager uses routes for navigation (no purely in-memory page state)
- The pager includes two constant content pages per lesson: pre-exercises (intro) and post-exercises (complete)

## Non-Goals

- Implement the hierarchical question numbering system (A/A.1, א/א.1, etc.).
- Re-design the UI.
- Add draft/preview flows for unpublished lessons.

## Requirements

### Functional Requirements

- FR-1: Every pager page has a stable, shareable URL.
- FR-2: Exercise pages are canonical by slug, scoped to the lesson:
  - Route shape: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/exercises/:exerciseSlug`
  - `exerciseSlug` is unique within the lesson.
- FR-3: The pager includes exactly two constant content pages per lesson:
  - Pre-exercises (intro)
  - Post-exercises (complete)
- FR-4: The intro page route is the existing lesson route:
  - `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug`
- FR-5: The complete page route is:
  - `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/complete`
- FR-6: Pager navigation uses the following sequence:
  - intro → exercises (ordered) → complete
- FR-7: Pager shows “exercise N of M” on exercise routes by ordinal position among exercises only.
- FR-8: Validation:
  - If an exercise slug does not exist for the lesson, return 404.
  - If an exercise slug exists but belongs to a different lesson, return 404.
- FR-9: Backward compatibility:
  - Existing exercise route by ID (`.../exercises/:exerciseId`) remains supported but is non-canonical.
  - Requests to the ID route redirect (308) to the canonical slug route.

### Non-Functional Requirements

- NFR-1: Deterministic ordering for exercises:
  - Primary sort: `order ASC`
  - Tie-breakers: `createdAt ASC`, then `id ASC`
- NFR-2: No N+1 queries to compute pager state; fetch the ordered exercises list once per lesson.
- NFR-3: Do not introduce new infrastructure (queues, cron, external services).

## Data Model

This simplified stage does NOT introduce explicit interleaved content steps. Pre/post pages are fixed routes.

### Exercises: Add `slug` (canonical identity within a lesson)

Add a new text field on `exercises`:

- Field: `slug` (text, required)
- Uniqueness: unique within the same `lesson`.
  - Implementation note: this is a compound uniqueness requirement; enforce via custom validation and/or a compound DB index.
- Generation: if empty, generate from `title` (slugify) and de-duplicate within the same lesson.

## Routing

### Intro Page (Pre-Exercises)

- Route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug`
- Behavior:
  - When a lesson is in “interactive exercises” mode, render the intro page as page 0 of the pager.
  - The intro page content is constant (static UI + lesson title + counts).

### Canonical Exercise Page

- Route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/exercises/:exerciseSlug`
- Lookup contract:
  1. Resolve lesson by `lessonSlug` (existing published+active behavior).
  2. Resolve exercise by `(lessonId, exerciseSlug)`.
  3. 404 if not found or mismatched.

### Complete Page (Post-Exercises)

- Route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/complete`
- Behavior:
  - Render the pager completion page (constant UI).
  - Provide navigation back to chapter/lesson list.

### Legacy Exercise ID Route

- Route: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/exercises/:exerciseId`
- Behavior:
  - If `exerciseId` matches an exercise and that exercise belongs to the lesson:
    - Redirect (308) to `/.../exercises/:exerciseSlug`.
  - Else: 404.

## Pager Behavior

### Step Source

- Steps are implicit in this simplified stage:
  - intro (lesson route)
  - exercises (ordered list)
  - complete (complete route)

- Exercises list source: `queryExercisesByLesson({ lessonId })` ordered by `order ASC, createdAt ASC, id ASC`.

### Next/Prev Computation

- Define page positions:
  - `introIndex = 0`
  - exercise pages are `1..N` (in the ordered exercises list)
  - `completeIndex = N + 1`

- Current route → current index:
  - Lesson route = `introIndex`
  - Exercise route = `1 + indexOf(exercise in ordered list)`
  - Complete route = `completeIndex`

- Next/prev:
  - prev of `introIndex` is disabled
  - next of `introIndex` goes to first exercise if any, else to complete
  - prev/next on exercise pages goes to adjacent exercise or intro/complete as appropriate
  - next of complete is disabled

### Exercise Ordinal Display

- For the current exercise step, compute:
  - `exerciseOrdinal = count(steps[0..activeIndex] where type=exercise)` (1-indexed)
  - `totalExercises = count(steps where type=exercise)`
- Display: `Exercise {exerciseOrdinal} of {totalExercises}`.

## Out of Scope

- Content pages between exercises.
- Admin UX for editing interleaved step sequences.
- Deep linking to question blocks inside an exercise.
- Progress persistence keyed by step order.

## Gates

### Gate 1 — Routing + Sync Works

- Every content step route (`/steps/:stepId`) renders the correct content and highlights pager state.
- Every exercise route (`/exercises/:exerciseSlug`) renders the exercise and highlights pager state.
- Next/prev navigates across mixed content/exercise sequences correctly.
- Legacy exercise ID URLs redirect to the canonical slug URL.

### Gate 2 — Determinism + Integrity

- Default steps fallback ordering is deterministic (`order ASC, createdAt ASC, id ASC`).
- 404 behavior is consistent for missing/mismatched step/exercise.

## Risks and Mitigations

- Risk: Compound uniqueness for `exercise.slug` within a lesson is not enforced.
  - Mitigation: enforce at write-time (validation) and add a compound index at the DB layer if supported.
- Risk: Existing lessons have no `steps`, so content pages are not routable until populated.
  - Mitigation: keep fallback behavior (exercise-only pager) and add a minimal admin workflow to populate steps per lesson.

## Timebox

- 1–2 engineering days for routes + data model + minimal tests.

## Definition of Done

- Data model changes defined and implemented (exercise slug).
- Canonical exercise slug routes work and are linked from navigation.
- Intro and complete pages are routable and participate in next/prev navigation.
- Legacy exercise ID URLs redirect to canonical slug URLs.
- Tests cover route resolution + ordering + next/prev across mixed steps.
