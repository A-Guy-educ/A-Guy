# Build Agent Report: 260315-auto-706

## Changes

### 1. Added contentStatusVisible filtering to course queries
- **File**: `src/server/repos/queries/courses.ts`
- **Changes**:
  - Added filter to `queryCourseBySlug` - excludes "Soon" content where `contentStatusVisible` is not true
  - Added filter to `queryPublishedCourses` - same filtering logic applied

### 2. Added contentStatusVisible filtering to lesson queries
- **File**: `src/server/repos/queries/lessons.ts`
- **Changes**:
  - Added filter to `queryLessonsByChapter` - excludes "Soon" content where `contentStatusVisible` is not true
  - Added filter to `queryLessonBySlug` - same filtering logic applied
  - Added filter to `queryLessonsByCourse` - same filtering logic applied

### 3. Fixed CourseCard button disabled prop for accessibility
- **File**: `src/app/(frontend)/courses/_components/CourseCard/index.tsx`
- **Change**: Line 131 changed from `disabled={isLoading}` to `disabled={isLoading || isSoon}`
- **Reason**: For proper accessibility, the button should be truly disabled when content is "Soon" (not just have visual styling)

## Query Filter Logic

The new filtering uses this pattern to exclude hidden "Soon" content:
```typescript
{
  or: [
    { contentStatus: { not_equals: 'soon' } },
    { contentStatusVisible: { equals: true } },
  ],
}
```

This ensures:
- Content with `contentStatus !== 'soon'` is always shown
- Content with `contentStatus === 'soon'` AND `contentStatusVisible === true` is shown
- Content with `contentStatus === 'soon'` AND `contentStatusVisible !== true` is hidden from student listings

## Quality

- TypeScript: PASS (`pnpm tsc --noEmit` completed successfully)
- Lint: PASS (no warnings or errors)

## Notes

- The full test suite (3716 tests) was verified in the prior run and passes
- This rerun focused on the 2 critical fixes identified in the review
- No changes to access control (`publishedAndActive`) were made - query-level filtering was used instead as specified
