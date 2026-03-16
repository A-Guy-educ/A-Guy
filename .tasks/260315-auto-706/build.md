# Build Agent Report: 260315-auto-706

## Changes

### Feature Implementation: Content Status Badging ("Soon" & "Just Added")

The feature has been fully implemented across the codebase:

1. **Content Status Fields** (`src/server/payload/fields/contentStatus.ts`):
   - `contentStatus` select field (None/Soon/Just Added)
   - `contentStatusVisible` toggle for "Soon" content
   - `contentStatusExpiresAt` date for auto-expiry

2. **Collections Updated**:
   - `Courses.ts` — Added contentStatusFields
   - `Lessons.ts` — Added contentStatusFields

3. **ContentStatusBadge Component** (`src/ui/web/shared/ContentStatusBadge/index.tsx`):
   - Gray badge for "Soon" (neutral styling with bg-muted)
   - Green badge with pulse animation for "Just Added"
   - Handles expiry date checking
   - Uses translations

4. **CourseCard Integration** (`src/app/(frontend)/courses/_components/CourseCard/index.tsx`):
   - Badge in top-right corner
   - Locked behavior for "Soon" courses (toast message, disabled button)

5. **LessonCard Integration** (`src/app/(frontend)/courses/_components/LessonCard/index.tsx`):
   - Badge next to lesson title using flex layout
   - Locked behavior using conditional rendering:
     - When `isSoon`: standalone `<Button disabled>` (valid HTML)
     - When not `isSoon`: `<Button asChild><SystemLink>`

6. **CourseLessonCard Integration** (`src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx`):
   - Badge next to lesson title
   - Locked behavior with toast

7. **Backend Query Filtering**:
   - `queries/courses.ts` — Filters invisible "Soon" content
   - `queries/lessons.ts` — Filters invisible "Soon" content

8. **Translations**:
   - `en.json` — soonBadge: "Soon", justAddedBadge: "New", contentLocked
   - `he.json` — Hebrew translations (בקרוב, חדש)

## Tests Written/Updated

- `tests/unit/components/LessonCard.test.tsx` — 9 tests
- Prior run: `tests/unit/components/CourseCard.test.tsx` — 12 tests
- Prior run: `tests/unit/components/CourseLessonCard.test.tsx` — 6 tests
- Prior run: `tests/unit/components/ContentStatusBadge.test.tsx` — 10 tests
- Prior run: `tests/unit/queries/course-content-status.test.ts` — 4 tests
- Prior run: `tests/unit/queries/lesson-content-status.test.ts` — 2 tests
- Prior run: `tests/unit/fields/contentStatus.test.ts` — 10 tests
- Prior run: `tests/unit/i18n/contentStatus-translations.test.ts` — 8 tests

**Total**: 61 content-status tests passing

## Quality Checks

- TypeScript: PASS (`pnpm tsc --noEmit`)
- Lint: PASS (`pnpm lint`)
- All 61 content-status tests: PASS

## Notes

- The LessonCard uses correct semantic HTML with conditional rendering:
  - "Soon" lessons: standalone `<Button disabled>` (no nested anchor)
  - Normal lessons: `<Button asChild><SystemLink href={...}>`
- Badge styling: pill shape (`rounded-full`), text-xs, font-bold
- "Just Added" uses `animate-pulse` class for attention
- Backend filters ensure invisible "Soon" content is hidden from student queries
- All spec requirements met (AC-1 through AC-9)
