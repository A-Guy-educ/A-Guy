# Task 2298 — Add no button in Lesson Blocks empty state

## What was done

**Issue**: LessonBlocksField empty state (lines 293-304 of `src/ui/admin/LessonBlocksField/index.tsx`) showed only a static text div with no interactive elements, forcing users to manually navigate to `/admin/collections/exercises/create` or `/admin/collections/content-pages/create`.

**Fix**: Replaced the static empty state div with a flex container that preserves the message text and adds two styled buttons — "Add Exercise" and "Add Content Page" — that navigate to the respective creation pages using the existing `router.push()` pattern from `editBlock()`.

**Pattern followed**: Mirrored the empty state pattern from `ExerciseContentEditor` (`src/ui/admin/ExerciseContentEditor/index.tsx`, lines 1033-1040), which has an "Add First Block" button in its empty state.

**Files changed**:
- `src/ui/admin/LessonBlocksField/index.tsx` — Added `Plus` import, replaced static empty div with message + two buttons
- `tests/e2e/lesson-blocks-field.e2e.spec.ts` — Added E2E test that verifies both buttons are visible and navigate to the correct URLs

## Verification

All quality gates passed: `pnpm typecheck`, `pnpm lint`, `pnpm ci:local` returned `ok: true`.

## E2E test note

The test requires a running server (Playwright webServer config) so it runs in CI. Locally, it needs `pnpm test:e2e` with the server started via `global-setup.ts`.
