# Test Agent Report: 260315-auto-706

## Tests Written

- `tests/unit/queries/course-content-status.test.ts` - Tests contentStatusVisible filtering in course queries
- `tests/unit/queries/lesson-content-status.test.ts` - Tests contentStatusVisible filtering in lesson queries
- `tests/unit/components/CourseCard.test.tsx` - Added test for disabled button on "Soon" courses

## Test Files

| File | Test Count | Type |
|------|-----------|------|
| tests/unit/queries/course-content-status.test.ts | 4 | unit |
| tests/unit/queries/lesson-content-status.test.ts | 2 | unit |
| tests/unit/components/CourseCard.test.tsx | 1 (new) | unit |

## Test Cases

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| queryPublishedCourses includes courses with contentStatus 'none' | unit | Verifies filter is applied for contentStatus=none |
| queryPublishedCourses includes 'soon' courses where contentStatusVisible is true | unit | Verifies visible soon content is returned |
| queryPublishedCourses excludes 'soon' courses where contentStatusVisible is false | unit | Verifies the where clause contains contentStatusVisible filter |
| queryCourseBySlug includes contentStatusVisible filter in query | unit | Verifies single course query has the filter |
| queryLessonsByChapter includes contentStatusVisible filter in query | unit | Verifies lesson listing has the filter |
| queryLessonsByCourse includes contentStatusVisible filter in query | unit | Verifies course lesson query has the filter |
| renders button as disabled when course.contentStatus is "soon" | unit | Button has disabled attribute for accessibility |

## Additional Changes

- Updated existing test `does NOT navigate when clicking a "Soon" course` to reflect new behavior where disabled buttons don't fire click events

## Verification

- All 3723 unit tests pass
- TypeScript compilation passes
