# Plan: Fix GITHUB_TOKEN error message mismatch on Cody Dashboard

## Research Findings

- ✅ `src/ui/cody/github-client.ts` (line 83) — throws `"Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured"`
- ✅ `src/app/api/cody/tasks/route.ts` (line 339) — catch checks `error?.message?.includes('GITHUB_TOKEN not configured')` — **MISMATCH**
- ✅ `src/ui/cody/api.ts` (line 70) — client-side correctly maps 401 → `NoTokenError`
- ✅ `src/ui/cody/components/CodyDashboard.tsx` (line 368, 592) — shows error when `error instanceof NoTokenError`
- ✅ `src/app/api/cody/tasks/approve/route.ts` (line 26-31) — local `getOctokit()` only checks `GITHUB_TOKEN`, ignores `CODY_BOT_TOKEN`
- ✅ `src/app/api/cody/tasks/approve-review/route.ts` (line 17-22) — same issue
- ✅ `src/app/api/cody/publish/route.ts` (line 14-19) — same issue
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` (line 312-317) — `approve-pr` action creates a local Octokit with only `GITHUB_TOKEN`

## Root Cause

**String mismatch between thrown error and catch clause.**

The shared `getOctokit()` in `github-client.ts` was updated to support `CODY_BOT_TOKEN` and the error message changed to `"Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured"`. However, the catch clause in `tasks/route.ts` line 339 still checks for `error?.message?.includes('GITHUB_TOKEN not configured')` — this `includes()` check **fails** because the new message doesn't contain that exact substring.

**Result**: When no token is configured, the error falls through to the generic handler (line 350), which returns `{ tasks: [], error: "Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured" }` with HTTP 200 — NOT the `{ error: 'no_token' }` with HTTP 401 that the client expects. The client-side `handleResponse` doesn't throw `NoTokenError` because the status isn't 401, so the dashboard shows an empty task list instead of the helpful "GITHUB_TOKEN is not configured" error with retry button.

Wait — actually re-reading: the generic fallback returns status 200 with `tasks: []` and an `error` field. The client `handleResponse` only throws `NoTokenError` on `res.status === 401`. So the user actually sees an **empty dashboard** rather than the error screen shown in the screenshot. Let me re-examine.

Actually, looking at the screenshot again — the user IS seeing the "Unable to Load Tasks / GITHUB_TOKEN is not configured" screen. This means the 401 IS being returned in some cases. Let me reconsider:

The `approve/route.ts`, `approve-review/route.ts`, and `publish/route.ts` have their own local `getOctokit()` that throws `"GITHUB_TOKEN not configured"` — but these are POST endpoints, not the task list GET. The task list GET calls the shared `getOctokit()` via `fetchIssues()`.

**Revised analysis**: The error screen shown IS matching. The check `includes('GITHUB_TOKEN not configured')` does NOT match `'Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured'` — let me verify: `"Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured".includes("GITHUB_TOKEN not configured")` → this is FALSE because the actual message has `"GITHUB_TOKEN is configured"` not `"GITHUB_TOKEN not configured"`.

Wait: `"Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured"` — does this include `"GITHUB_TOKEN not configured"`? No! The actual string has `"GITHUB_TOKEN is configured"` (with "is" not "not"). The catch checks for `"GITHUB_TOKEN not configured"` which is NOT a substring.

So the error falls to the generic handler at line 350, which returns `{ tasks: [], error: "Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured" }` with HTTP 200. The client gets tasks=[] and no error thrown, so user sees empty dashboard.

But the screenshot shows the explicit "GITHUB_TOKEN is not configured" error page... This could be from a **different deployment** where the environment previously had `GITHUB_TOKEN` and the message did match, or from a scenario where one of the other endpoints that throw "GITHUB_TOKEN not configured" is also called.

**Regardless**, the fix is the same: make the string matching robust.

## Reuse Inventory

- `getOctokit()` from `src/ui/cody/github-client.ts` — reuse for approve/publish routes instead of local copies
- Existing test pattern from `tests/unit/cody-api-routes.spec.ts`

## Plan Steps

### Step 1: Fix the error message matching in tasks/route.ts

**Root Cause**: The catch clause checks `error?.message?.includes('GITHUB_TOKEN not configured')` but the actual error is `'Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured'` — no substring match.

**Files to Touch**:
- `src/app/api/cody/tasks/route.ts` (MODIFIED - line 339)

**Fix**: Change the error detection to match any token-related error from `getOctokit()`. Use a broader check that catches both the old and new error messages:

```typescript
// Before (line 339):
if (error?.message?.includes('GITHUB_TOKEN not configured')) {

// After:
if (error?.message?.includes('not configured') && 
    (error?.message?.includes('GITHUB_TOKEN') || error?.message?.includes('CODY_BOT_TOKEN'))) {
```

**Reproduction Test**: 
- Test location: `tests/unit/cody-dashboard-token-error.test.ts`
- Test: Mock `fetchIssues` to throw `Error('Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured')`, call the GET handler, assert it returns `{ error: 'no_token' }` with status 401
- Why it fails now: The includes() check doesn't match, so the route returns 200 with empty tasks instead of 401

**Verification**:
- Run test → FAILS before fix (returns 200 with empty tasks)
- After fix → PASSES (returns 401 with `error: 'no_token'`)

### Step 2: Replace local getOctokit() copies with shared import

**Root Cause**: Three API routes define their own `getOctokit()` that only checks `GITHUB_TOKEN`, ignoring `CODY_BOT_TOKEN`. This means they fail even when `CODY_BOT_TOKEN` is configured.

**Files to Touch**:
- `src/app/api/cody/tasks/approve/route.ts` (MODIFIED - remove local getOctokit, import from github-client)
- `src/app/api/cody/tasks/approve-review/route.ts` (MODIFIED - remove local getOctokit, import from github-client)
- `src/app/api/cody/publish/route.ts` (MODIFIED - remove local getOctokit, import from github-client)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED - line 312-317, use shared getOctokit for approve-pr action)

**Fix**: 
1. Remove the local `getOctokit()` functions from `approve/route.ts`, `approve-review/route.ts`, and `publish/route.ts`
2. Import `getOctokit` from `@/ui/cody/github-client` instead
3. In `actions/route.ts`, replace the inline `new Octokit({ auth: token })` with `getOctokit()` from the shared module (already imported)

**Test**:
- Test location: `tests/unit/cody-dashboard-token-error.test.ts` (add cases)
- Test: Verify that when `CODY_BOT_TOKEN` is set but `GITHUB_TOKEN` is not, the shared `getOctokit()` still works (returns an Octokit instance)
- Test: Verify that when neither token is set, it throws an error containing both token names

**Verification**:
- Run test → FAILS before fix (local getOctokit only checks GITHUB_TOKEN)
- After fix → PASSES (uses shared getOctokit that checks both)

### Step 3: Improve error UX — show actionable message for both tokens

**Root Cause**: The dashboard error message hardcodes "GITHUB_TOKEN is not configured" but the system now supports `CODY_BOT_TOKEN` as well.

**Files to Touch**:
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED - line 599)
- `src/ui/cody/api.ts` (MODIFIED - line 39, update default message)

**Fix**:
1. Update `NoTokenError` default message to be more helpful: `'GitHub token is not configured. Set CODY_BOT_TOKEN or GITHUB_TOKEN in environment variables.'`
2. Update the dashboard error display to use the error message from the `NoTokenError` instance instead of a hardcoded string

**Test**:
- Manual verification in browser — no automated test needed for UI text change
- But we can add a test that `NoTokenError` has the updated message

**Acceptance Criteria**:
- [x] Error message mentions both token options
- [x] User understands which env vars to set
