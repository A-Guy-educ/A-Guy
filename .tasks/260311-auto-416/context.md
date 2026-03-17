# Codebase Context: 260311-auto-416

## Files to Modify
- `src/server/payload/collections/Lessons.ts` (lines 37-49 admin config, lines 107-116 order field) — Add `defaultSort: 'order'` to admin config, add `index: true` to order field
- `src/server/repos/queries/lessons.ts` (lines 147-201, `queryLessonsByCourse` function) — Sort results by chapter order first, then lesson order

## Files to Read (reference patterns)
- `src/server/payload/collections/Chapters.ts` — Reference pattern for `order` field with `index` (note: Chapters also lacks `index: true` on order field, but out of scope)
- `tests/unit/queries/lessons.test.ts` — Test pattern to follow for mocking Payload
- `tests/int/lesson-query-hierarchy-safety.int.spec.ts` — Integration test pattern for lesson queries
- `src/server/repos/queries/chapters.ts` — `queryChaptersByCourse` returns chapters sorted by `order`

## Key Signatures
- `queryLessonsByCourse(args: { courseId: string }): Promise<Lesson[]>` from `src/server/repos/queries/lessons.ts`
- `queryLessonsByChapter(args: { chapterId: string }): Promise<Lesson[]>` from `src/server/repos/queries/lessons.ts`
- `queryChaptersByCourse(args: { courseId: string }): Promise<Chapter[]>` from `src/server/repos/queries/chapters.ts`
- `publishedAndActive: Access` from `src/server/payload/access/publishedAndActive.ts`

## Reuse Inventory
- `queryChaptersByCourse` from `src/server/repos/queries/chapters.ts` — already called inside `queryLessonsByCourse`, returns chapters sorted by order
- `publishedAndActive` from `src/server/payload/access/publishedAndActive.ts` — existing access control, no change needed
- Test mocking pattern from `tests/unit/queries/lessons.test.ts` — reuse `vi.mock('payload')` + `vi.mock('@payload-config')` pattern

## Integration Points
- `queryLessonsByCourse` is called by `src/app/(frontend)/courses/[courseSlug]/page.tsx` (line 52)
- Results are passed to `CoursePageContent` → `LearnTab` / `PracticeTab` which render the flat list
- `/api/chapters/by-grade` route independently fetches and groups lessons by chapter (separate code path)
- No changes needed to frontend components — the data layer fix ensures correct order at the source

## Imports Verified
- `@/server/repos/queries/lessons` → exports `queryLessonsByChapter`, `queryLessonsByCourse`, `queryLessonBySlug` ✅
- `@/server/repos/queries/chapters` → exports `queryChaptersByCourse`, `queryChapterBySlug`, `queryChaptersByGrade` ✅
- `@/payload-types` → exports `Lesson`, `Chapter`, `Course` types ✅
- `@/server/payload/access/publishedAndActive` → exports `publishedAndActive` ✅

## Test Commands
- Unit tests: `pnpm test:unit`
- Specific test file: `pnpm test:unit -- tests/unit/queries/lessons.test.ts`
- Integration tests: `pnpm test:int`
- Type check: `pnpm -s tsc --noEmit`
- Lint: `pnpm -s lint`
