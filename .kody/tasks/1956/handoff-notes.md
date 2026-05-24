# Handoff Notes: Fix /api/stats/streak returning HTTP 500

## What I Did

1. **Investigated the streak API** (`src/app/api/stats/streak/route.ts`) - the POST handler had no try-catch error handling, unlike other stats routes (heartbeat, track-activity, progress) which use `captureAndRespond` for error handling.

2. **Added error handling** to the streak route: wrapped the entire handler body in try-catch, returning a proper 500 JSON response with the error message instead of letting exceptions propagate as unhandled 500s.

3. **Created integration tests** (`tests/int/stats-streak.int.spec.ts`) covering: auth check (401), streak creation (200), idempotency (200 on repeat calls same day), and empty body handling.

4. **Root cause was not conclusively identified**: The API works correctly in integration tests (4/4 pass). The issue describes a 500 specifically on exercise pages at `/api/stats/streak:0` - note the `:0` suffix which suggests a client-side URL construction bug appending the exercise slug.

## Key Observations

- The URL `streak:0` in the error strongly suggests the frontend is constructing a wrong URL, likely because `lessonId` or similar is being appended to `/api/stats/streak` instead of being sent as JSON body
- The error handling fix ensures any remaining edge case won't crash the server with an unhandled exception
- The exercise page uses `ExercisesPager` which calls `LessonAnalytics` → `useSetCurrentLesson(lessonId)` → `ActiveTimeProvider` → `useActiveTimeTracker` → `sendStreakUpdate()`

## Files Changed

- `src/app/api/stats/streak/route.ts` - Added try-catch error handling
- `tests/int/stats-streak.int.spec.ts` - New integration test file

## Verification

- All 4 streak API tests pass
- Quality gates (typecheck, lint, tests) pass
