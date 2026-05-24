# Issue #1979: Lesson page renders nearly empty

## What I did

Created `tests/int/lesson-blocks-rendering.int.spec.ts` with 5 integration tests that verify:
1. `queryLessonBySlug` returns a lesson with blocks
2. `queryLessonBlocks` returns blocks for a lesson with blocks field
3. `queryLessonBlocks` returns exercise block with exercise data
4. `queryLessonBlocks` returns contentPage block with contentPage data
5. `hasRenderableBlocks` returns true for exercise with blocks

All 5 tests pass.

## Key findings

1. **queryLessonBlocks works correctly** - When blocks are properly set with valid exerciseRef and contentPageRef entries, the function correctly resolves and returns the blocks with full data.

2. **populateLessonBlocks is failing for 106 lessons** - On every payload initialization, the migration runs and fails for 106 lessons. The error is swallowed without logging the actual error, making it hard to diagnose.

3. **visibleRenderers edge case** - If `visibleRenderers` is set to `[]` (empty array), `getVisibleTabs([])` returns all tabs hidden, which would cause `DualModeLessonView` to render nothing.

## Root cause hypothesis

The "nearly empty" page is most likely caused by one of:

1. **populateLessonBlocks failure** - Lessons with empty blocks fall through to legacy path, which may not render correctly for certain lessons

2. **visibleRenderers = []** - All tabs hidden, causing empty content area

3. **Access gate issue** - User without entitlement for 'paid' content sees empty page

## Tests pass

- `pnpm typecheck` passes
- `pnpm lint` passes  
- `pnpm exec vitest run tests/int/lesson-blocks-rendering.int.spec.ts` - all 5 tests pass
