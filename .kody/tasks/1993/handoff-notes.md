# Fix: Contradictory empty state between /study and /practice (#1993)

## What I did

**Root cause:** In `StudyContent/index.tsx`, when the server-side prefetch failed (no grade cookie), the client-side fallback `fetch('/api/chapters/by-grade?grade=...')` did NOT pass `lessonType`. The API defaults to `'practice'` lessons. But `StudyContent` then filters using `getEffectiveLessonType(lesson.type) === lessonType` where `lessonType` defaults to `'learning'`. Result: `/study` shows "No topics available" even when the course has practice lessons.

**Fix:** Added `&lessonType=${lessonType}` to the client-side fetch URL in `StudyContent`'s `loadData()` function, and added `lessonType` to the `useEffect` dependency array.

**Files changed:**
- `src/app/(frontend)/study/_components/StudyContent/index.tsx` — 2-line change: added lessonType query param to fetch URL + added to useEffect deps
- `tests/int/study-practice-empty-state.int.spec.ts` — new integration test documenting API contract and the bug scenario

**Verification:** All 4 integration tests pass; quality gates (typecheck, lint, test:int) green on first attempt.
