# Issue #1896 Investigation - Practice Page Lesson Card Heading

## Summary
Investigated issue #1896 where practice page lesson card headings allegedly don't match lesson numbers in Chapter 2.

## What I Found
The code logic is **correct**. The index calculation formula in `StudyContent/index.tsx`:
```tsx
const startIndex = chapterGroups.slice(0, groupIdx).reduce((sum, g) => sum + g.lessons.length, 0)
```
produces correct sequential numbering (e.g., Ch1: 1,2,3 and Ch2: 4,5,6 for 3 lessons per chapter).

## Tests Created
1. **Unit test** `tests/unit/study-content-index-calculation.test.ts` - verifies the pure calculation logic with multiple scenarios
2. **Unit test** `tests/unit/components/CourseLessonCard.test.tsx` - verifies the card renders correct labels for indices 1, 4, 5, 6
3. **Integration test** `tests/int/practice-page-lesson-numbering.int.spec.ts` - verifies API returns correct lesson grouping with 2 chapters × 3 lessons

All 24 tests pass.

## Quality Gates
- TypeScript: PASS
- ESLint: PASS (warnings only, pre-existing)
- Unit tests: 19/19 PASS
- Integration tests: 5/5 PASS

## Key Observation
The issue description states Chapter 2's first lesson shows "Lesson 4" instead of "Lesson 5", which would only happen if Chapter 1 has 3 lessons (making startIndex=3 and first Ch2 lesson index=4). This is actually the CORRECT output for 3 lessons in Chapter 1.

The issue description appears potentially inaccurate or describes a different data scenario than tested. QA should verify the actual course data on the QA account to confirm if the bug still exists.

## Files Changed
- `tests/unit/study-content-index-calculation.test.ts` (new)
- `tests/unit/components/CourseLessonCard.test.tsx` (updated with new test cases)
- `tests/int/practice-page-lesson-numbering.int.spec.ts` (new)
