# Bug #1823: Stats page chart area renders empty

## What I Did

**Root cause identified**: The `StatsDashboard` component did not handle non-OK API responses. When the `/api/stats/dashboard` endpoint returned an error (e.g., 401 Unauthorized, 500 Internal Server Error), the component silently failed and showed a blank chart area.

**Fix applied**: Added proper error state handling to `StatsDashboard.tsx`:
1. Added `error` state to track API failures
2. Modified `fetchData` to set error message on non-OK responses
3. Added error UI rendering between loading and empty state

**Files changed**:
- `src/app/(frontend)/stats/_components/StatsDashboard.tsx` — Added error state and rendering
- `tests/int/stats-dashboard-api.int.spec.ts` — New integration test for stats dashboard API

## Key Changes

The fix follows the same pattern as commit `00419e6b8` (which was on dev but not on this branch) — adding `setError` state and displaying an error message when the API fails.

## Testing

- Created integration test `tests/int/stats-dashboard-api.int.spec.ts` that verifies:
  - Dashboard API returns valid response structure
  - Practiced lessons appear when user has progress data
  - Category progress shows correct counts
  - Activity API returns valid activities array
