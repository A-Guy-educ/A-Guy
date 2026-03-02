# Plan: Security Auth Fixes — Cody Admin-Only Auth

**Task ID**: 260302-security-auth-fixes  
**Type**: fix_bug (security)  
**Priority**: CRITICAL  
**Estimated Time**: ~35 minutes  

---

## Summary

4 Cody/Copilotkit API endpoints have zero authentication — they expose Gemini AI and GitHub tokens to the public internet. These should be **admin-only** (using the existing `requireAuth` pattern already used by 6 other Cody endpoints).

> **Note**: Anonymous chat in agent/chat endpoints is **by design** (rate-limited guest sessions). These are NOT changed.

---

## Step 1: Add Admin Auth to Cody Chat POST Endpoint

**Root Cause**: The POST handler at `src/app/api/cody/chat/route.ts:341` has `// Skip auth check for now - open access for testing` and processes requests without any authentication. This exposes Gemini AI API and GitHub MCP tools to the public.

**Files to Touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — lines 341-346)

**Exact Behavior**:
- Import `requireAuth` from `@/ui/cody/auth` (already imported on line 13 as `requireDashboardAuth` — the `requireAuth` function checks for admin role)
- At line 344-345, replace the skip comment with:
  ```typescript
  const authError = await requireAuth(req)
  if (authError) return authError
  ```
- This matches the exact pattern used by the GET handler at line 308-314 (which uses `requireDashboardAuth`) but uses the stricter `requireAuth` (admin-only) matching all other Cody mutation endpoints like `publish/route.ts`, `prs/route.ts`, etc.

**Reproduction Test**: `tests/unit/api/cody-chat-auth.test.ts` (NEW)
- Test: `POST /api/cody/chat without auth returns 401`
- Test: `POST /api/cody/chat with non-admin user returns 401`  
- Why it fails now: Currently returns 200/streams response for unauthenticated requests

**Fix**: Replace comment with `requireAuth` call (3 lines)

**Verification**:
- Run reproduction test → FAILS before fix (POST returns 200 without auth)
- After fix → PASSES (POST returns 401 without auth)

**Acceptance Criteria**:
- [ ] `POST /api/cody/chat` returns 401 for unauthenticated requests
- [ ] `POST /api/cody/chat` returns 401 for non-admin authenticated users
- [ ] `POST /api/cody/chat` succeeds for admin users
- [ ] GET handler behavior unchanged (still uses `requireDashboardAuth`)

---

## Step 2: Add Admin Auth to Cody Boards Endpoint

**Root Cause**: `src/app/api/cody/boards/route.ts:14` has `// Skip auth check for now - open access for testing`. Exposes GitHub labels and milestones publicly.

**Files to Touch**:
- `src/app/api/cody/boards/route.ts` (MODIFIED — lines 13-15)

**Exact Behavior**:
- Import `requireAuth` from `@/ui/cody/auth`
- Replace skip comment with admin auth check:
  ```typescript
  const authError = await requireAuth(req)
  if (authError) return authError
  ```

**Reproduction Test**: `tests/unit/api/cody-boards-auth.test.ts` (NEW)
- Test: `GET /api/cody/boards without auth returns 401`
- Why it fails now: Returns 200 with board data for unauthenticated requests

**Fix**: Add `requireAuth` call (3 lines + 1 import)

**Verification**:
- Run reproduction test → FAILS before fix
- After fix → PASSES

**Acceptance Criteria**:
- [ ] `GET /api/cody/boards` returns 401 for unauthenticated requests
- [ ] `GET /api/cody/boards` returns 401 for non-admin users
- [ ] `GET /api/cody/boards` succeeds for admin users

---

## Step 3: Add Admin Auth to Cody Collaborators Endpoint

**Root Cause**: `src/app/api/cody/collaborators/route.ts:12` has `// Skip auth check for now - open access for testing`. Exposes GitHub collaborator list publicly.

**Files to Touch**:
- `src/app/api/cody/collaborators/route.ts` (MODIFIED — lines 11-13)

**Exact Behavior**:
- Import `requireAuth` from `@/ui/cody/auth`
- Replace skip comment with admin auth check (same pattern as Step 2)

**Reproduction Test**: `tests/unit/api/cody-collaborators-auth.test.ts` (NEW)
- Test: `GET /api/cody/collaborators without auth returns 401`
- Why it fails now: Returns 200 with collaborator list for unauthenticated requests

**Fix**: Add `requireAuth` call (3 lines + 1 import)

**Verification**:
- Run reproduction test → FAILS before fix
- After fix → PASSES

**Acceptance Criteria**:
- [ ] `GET /api/cody/collaborators` returns 401 for unauthenticated requests
- [ ] `GET /api/cody/collaborators` returns 401 for non-admin users

---

## Step 4: Add Admin Auth to Copilotkit Chat Endpoint

**Root Cause**: `src/app/api/copilotkit/route.ts:91` POST handler has zero authentication. Exposes Gemini AI and all GitHub issues (titles, labels, assignees) to anonymous users.

**Files to Touch**:
- `src/app/api/copilotkit/route.ts` (MODIFIED — lines 91-98)

**Exact Behavior**:
- Import `requireAuth` from `@/ui/cody/auth`
- At the start of the POST handler (line 91-94), add admin auth check before any processing:
  ```typescript
  export async function POST(request: NextRequest) {
    const authError = await requireAuth(request)
    if (authError) return authError
    
    const requestId = crypto.randomUUID()
    // ... rest of handler
  ```
- This prevents unauthenticated Gemini API calls AND prevents `getDashboardContext()` from exposing GitHub issues.

**Reproduction Test**: `tests/unit/api/copilotkit-auth.test.ts` (NEW)
- Test: `POST /api/copilotkit without auth returns 401`
- Test: `POST /api/copilotkit with student role returns 401`
- Why it fails now: Returns 200 with AI response for unauthenticated requests

**Fix**: Add `requireAuth` call at top of POST handler (3 lines + 1 import)

**Verification**:
- Run reproduction test → FAILS before fix
- After fix → PASSES

**Acceptance Criteria**:
- [ ] `POST /api/copilotkit` returns 401 for unauthenticated requests
- [ ] `POST /api/copilotkit` returns 401 for non-admin users
- [ ] `POST /api/copilotkit` succeeds for admin users
- [ ] GET handler unchanged (returns status message)

---

## Step 5: Verify All Cody Endpoints Have Auth

**Goal**: Ensure no Cody endpoint was missed. All 10 Cody routes should use `requireAuth` or `requireDashboardAuth`.

**Files to Touch**: None (verification only)

**Test**: `tests/unit/api/cody-auth-coverage.test.ts` (NEW)
- For each route file in `src/app/api/cody/**/route.ts`:
  - Grep for `requireAuth` or `requireDashboardAuth` import
  - Assert all 10 routes import an auth function
- This is a "canary" test that catches any new unauthenticated Cody routes added in the future.

**Acceptance Criteria**:
- [ ] All 10 Cody route files import `requireAuth` or `requireDashboardAuth`
- [ ] `src/app/api/copilotkit/route.ts` imports `requireAuth`
- [ ] Zero files contain `// Skip auth check` comment
- [ ] `pnpm tsc --noEmit` passes

---

## Implementation Notes

### Existing Auth Pattern (reference)
All other Cody endpoints use this exact pattern — copy it:
```typescript
// From src/app/api/cody/publish/route.ts
import { requireAuth } from '@/ui/cody/auth'

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError
  // ... handler logic
}
```

`requireAuth` (from `src/ui/cody/auth.ts`):
1. Calls `requireDashboardAuth(req)` → uses `payload.auth({ headers })`
2. Checks `auth.user.role === 'admin'`
3. Returns `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` if not admin
4. Returns `null` if authorized

### Test Strategy
Tests should mock `requireAuth` behavior by:
1. Creating a real test that hits the route without auth headers → expects 401
2. Alternatively, unit test the route handler by mocking `payload.auth()` to return no user

### Files NOT Changed
- `src/app/api/agent/chat/route.ts` — anonymous access is BY DESIGN (guest sessions with rate limiting)
- `src/app/api/agent/chat/stream/route.ts` — same, by design
- `src/app/api/cody/auth/route.ts` — already uses `requireDashboardAuth`

---

## Assumptions

1. `requireAuth` (admin-only) is the correct level for all Cody endpoints, matching the existing pattern in publish, prs, workflows, and pipeline endpoints.
2. The Copilotkit endpoint is part of the Cody dashboard and should use the same admin auth.
3. No non-admin users need access to Cody dashboard APIs.
4. The GET handler on `cody/chat` uses `requireDashboardAuth` (authenticated, any role) — we keep that as-is since the POST is the sensitive operation.
