# Plan: Fix Approval Gate Button 403 Forbidden

## Task Type: fix_bug

## Research Findings

- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — Actions API route (exists, 441 lines)
- ✅ `src/ui/cody/api.ts` — Client-side API module (exists, 549 lines)
- ✅ `src/ui/cody/auth.ts` — Auth middleware (exists, 158 lines)
- ✅ `src/ui/cody/github-client.ts` — GitHub client with `postComment`, `getOctokit`, `createUserOctokit` (exists, 1773 lines)
- ✅ `src/ui/cody/hooks/index.ts` — `useTaskActions` hook with `approveGate` mutation (exists, 461 lines)
- ✅ `src/ui/cody/components/TaskDetail.tsx` — Calls `taskActions.approveGate()` (exists, 1608 lines)
- ✅ `src/infra/auth/cody_session.ts` — Session management with encrypted token (exists, 213 lines)
- ✅ `src/ui/cody/github-error-handler.ts` — Error handler (exists but NOT used by actions route)
- ✅ `tests/unit/ui/cody/api/close-action.test.ts` — Existing test pattern for actions route

### Patterns Observed

- The `actions/route.ts` gets `userOctokit` from the session (per-user GitHub token), then passes it to `postWithAttribution` → `postComment`
- `postComment` uses `userOctokit ?? getOctokit()` — prefers user token over bot token
- If user's token returns 403 from GitHub, the entire request fails. There's **no fallback** to bot token
- The 401 error path has a `github_token_expired` code, but 403 from GitHub is returned as generic `github_forbidden`
- The `handleCodyApiError` helper exists but is NOT used by the actions route (inconsistency)

### Root Cause

When the user clicks "Approve Gate", the flow is:
1. `approveGate()` → `POST /api/cody/tasks/issue-822/actions` with `{ action: 'approve' }`
2. Route calls `getUserOctokit(req)` → extracts encrypted user token from JWT cookie → creates Octokit
3. Route calls `postWithAttribution(issueNumber, '/cody approve', actor, userOctokit)`
4. `postComment` calls `userOctokit.issues.createComment(...)` 
5. GitHub returns 403 because user's token is expired/revoked/lacks permissions
6. Error caught at line 418 → returns `{ error: 'github_forbidden' }` with status 403

The bug is that **the user's expired/revoked token is used without any fallback to the bot token**. When `userOctokit` is non-null but its token is invalid, GitHub returns 403 and the operation fails entirely.

## Reuse Inventory

- **Reuse** `getOctokit()` from `src/ui/cody/github-client.ts` — bot token fallback
- **Reuse** `postComment()` from `src/ui/cody/github-client.ts` — already has `userOctokit ?? getOctokit()` pattern
- **Reuse** `withActor()` from `src/app/api/cody/tasks/[taskId]/actions/route.ts` — attribution formatting
- **Reuse** test pattern from `tests/unit/ui/cody/api/close-action.test.ts`

---

## Step 1: Add retry-with-fallback for GitHub API calls in actions route

**Root Cause**: When the user's OAuth token returns 403 from GitHub, the route doesn't retry with the bot token. The `postWithAttribution` helper uses `userOctokit` directly without any fallback retry.

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — lines 72-85, 401-434)

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL now):

- Test location: `tests/unit/ui/cody/api/approve-gate-fallback.test.ts` (NEW)
- What it tests: When `postComment` fails with a 403 using the user's Octokit, the route should retry with the bot token and return success
- Why it fails: Currently the 403 is caught and returned to the client without any retry

**Fix**:

1. Add a `postWithFallback` helper (or modify `postWithAttribution`) that wraps the GitHub API call in a try-catch. If the user's Octokit throws a 403, retry the call using `getOctokit()` (bot token) with actor attribution in the message body.

2. Update the error handler for 403 errors: if the 403 came from the user's token (not the bot token), the catch block should add a warning header or log indicating the user should re-authenticate, but still succeed via bot token.

Pseudo-logic for the fallback:
```
async function postWithFallback(issueNumber, message, actor, userOctokit) {
  if (userOctokit) {
    try {
      await postComment(issueNumber, message, userOctokit)
      return
    } catch (error) {
      if (error.status === 403 || error.status === 401) {
        // User token failed — fall back to bot token with attribution
        console.warn('[Cody] User token failed, falling back to bot token')
        const attributed = withActor(message, actor)
        await postComment(issueNumber, attributed) // uses bot token
        return
      }
      throw error // Re-throw non-auth errors
    }
  }
  // No user token — use bot with attribution
  const attributed = withActor(message, actor)
  await postComment(issueNumber, attributed)
}
```

3. Replace `postWithAttribution` calls with `postWithFallback` for comment-posting actions (approve, reject, execute, abort, close, reopen, reset).

4. For actions that use `userOctokit ?? getOctokit()` directly (like `triggerWorkflow`, `closePR`, `addLabels`, etc.), wrap those in similar try-catch-fallback patterns within each case block.

**Verification**:
- Run test → FAILS (route returns 403 without fallback)  
- After fix → PASSES (route falls back to bot token and returns success)

**Acceptance Criteria**:
- [ ] When user's GitHub token returns 403, the action falls back to bot token with attribution
- [ ] When user's GitHub token returns 401, same fallback behavior
- [ ] When bot token also fails, error is returned to client
- [ ] A warning is logged when fallback occurs
- [ ] Test covers: approve gate with user token 403 → succeeds via bot token

---

## Step 2: Improve client-side error handling for auth-related 403s

**Root Cause**: The client-side `handleResponse` in `api.ts` treats 403 as a generic `ApiError`. It doesn't distinguish between "your token expired — please re-login" vs "you don't have permission". The toast shows a generic "Failed to approve gate" without helpful guidance.

**Files to Touch**:
- `src/ui/cody/api.ts` (MODIFIED — lines 68-96)
- `src/ui/cody/hooks/index.ts` (MODIFIED — lines 306-309)

**Reproduction Test**:
- Test location: `tests/unit/ui/cody/api/error-handling.test.ts` (NEW)
- What it tests: When the API returns `{ error: 'github_forbidden' }` with status 403, the client should throw a descriptive error
- Why it fails: Currently throws generic `ApiError` without distinguishing auth errors

**Fix**:

1. In `handleResponse`, add a check for `github_forbidden` and `github_token_expired` error codes from the server:
```typescript
if (res.status === 403) {
  if (data.error === 'github_forbidden') {
    throw new ApiError(
      'GitHub permission denied. You may need to re-authenticate.',
      403,
      data
    )
  }
  throw new ApiError(data.error || 'Forbidden', 403, data)
}
```

2. After Step 1's fix, this step becomes less critical since the server will fall back to bot token. But it's still valuable for non-comment actions where fallback isn't possible (e.g., `approve-pr` which needs user's identity).

**Verification**:
- Run test → FAILS (generic error message)
- After fix → PASSES (descriptive error with re-auth suggestion)

**Acceptance Criteria**:
- [ ] 403 errors from the server include descriptive messages
- [ ] `github_token_expired` responses suggest re-authentication
- [ ] Existing error handling for 401/429 still works

---

## Step 3: Add integration test for the full approve gate flow

**Files to Touch**:
- `tests/unit/ui/cody/api/approve-gate-fallback.test.ts` (created in Step 1, expanded)

**Test Scenarios**:
1. Happy path: user token works → comment posted under user identity
2. User token 403 → fallback to bot token with attribution → success
3. User token 401 → fallback to bot token with attribution → success  
4. Both tokens fail → error returned to client
5. No user token (legacy session) → bot token with attribution → success

**Acceptance Criteria**:
- [ ] All 5 scenarios tested and passing
- [ ] Tests mock `postComment` and `getOctokit` appropriately
- [ ] Tests follow existing pattern from `close-action.test.ts`

---

## Summary

| Step | Files | Estimated Time |
|------|-------|---------------|
| 1 | actions/route.ts, approve-gate-fallback.test.ts | 20 min |
| 2 | api.ts, hooks/index.ts, error-handling.test.ts | 15 min |
| 3 | approve-gate-fallback.test.ts (expand) | 10 min |

**Total**: ~45 minutes

**Key Insight**: The core fix is in Step 1 — adding a fallback mechanism so that when the user's GitHub token fails, the bot token is used with actor attribution. This is the same pattern already used when `userOctokit` is `null` (legacy sessions), but wasn't being applied when the token exists but is invalid.
