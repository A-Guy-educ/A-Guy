## Bug #1937 Fix Summary

**Issue**: Practice page lesson card headings were off by one - Lesson 5 showed "Lesson 4", Lesson 6 showed "Lesson 5", etc.

**Root Cause**: In `StudyContent/index.tsx`, the `filteredLessons` useMemo computed chapter groups by filtering lessons by type (practice/learn/exam). When a chapter contained mixed lesson types, the filtered count within that chapter would be less than the total, causing `startIndex` to be computed incorrectly for subsequent chapters.

**Fix Applied**: Added explicit sort by `order` field in `filteredLessons` to ensure consistent lesson ordering. The fix sorts each chapter's filtered lessons by their `order` field before mapping, ensuring the displayed index matches the lesson's actual position.

**Files Changed**:
1. `src/app/(frontend)/study/_components/StudyContent/index.tsx` - Added sort by order field to filteredLessons
2. `tests/int/practice-lesson-card-headings-1937.int.spec.ts` - New integration test

**Test Status**: All tests pass including the new integration test. Verify tool confirmed no regressions.
