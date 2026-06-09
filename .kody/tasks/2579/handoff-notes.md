## Fix Summary

**Root cause:** The `useCurrentUser` hook (`src/client/hooks/useCurrentUser.ts`) made a fetch request to `/api/users/me` without any timeout. If that endpoint hung or was unreachable, `isLoading` would stay `true` forever, causing the `/admin/chat` page to show "Loading..." indefinitely.

**Fix applied:** Added an `AbortController` with a 15-second timeout to the `fetchUser` function, mirroring the pattern already used in `useStudyPlan`. Also added proper cleanup via `AbortController` on component unmount in the mount `useEffect`.

**Files changed:**
- `src/client/hooks/useCurrentUser.ts` — Added AbortController + 15s timeout to fetchUser; updated mount effect to pass controller for shared abort
- `tests/unit/hooks/useCurrentUser-timeout.spec.ts` — New test file with 3 tests covering: timeout behavior, successful load, and 401 response

**Pattern used:** Same as `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` which already had this fix.
