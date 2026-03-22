# Plan: Per-User GitHub Auth for Cody Dashboard

## Research Findings

### File Paths Verified
- ✅ `src/infra/auth/cody_session.ts` — Session JWT management (135 lines)
- ✅ `src/app/api/oauth/github/route.ts` — OAuth initiation (42 lines)
- ✅ `src/app/api/oauth/github/callback/route.ts` — OAuth callback (162 lines)
- ✅ `src/ui/cody/auth.ts` — Auth middleware: requireCodyAuth, verifyActorLogin (148 lines)
- ✅ `src/ui/cody/github-client.ts` — GitHub API client singleton + all operations (1710 lines)
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — Task actions: 18 action types (388 lines)
- ✅ `src/app/api/cody/tasks/route.ts` — Task CRUD (431 lines)
- ✅ `src/app/api/cody/tasks/approve/route.ts` — PR approve + merge (137 lines)
- ✅ `src/app/api/cody/tasks/approve-review/route.ts` — Review approve + merge (114 lines)
- ✅ `src/app/api/cody/publish/route.ts` — Publish workflow (97 lines)
- ✅ `src/app/api/cody/branches/route.ts` — Branch list/delete (165 lines)
- ✅ `src/app/api/cody/chat/save/route.ts` — Save chat to branch (132 lines)
- ✅ `src/ui/cody/hooks/useGitHubIdentity.ts` — Client-side identity hook (74 lines)
- ✅ `src/ui/cody/api.ts` — API client with error classes (SessionExpiredError, NoTokenError)
- ✅ `src/ui/cody/components/CodyDashboard.tsx` — Dashboard UI handling auth errors

### Patterns Observed
- Octokit singleton at module level (`let octokitInstance`) — cannot accept per-request tokens
- All 22 write functions call `getOctokit()` internally — no token override parameter
- Routes use `requireCodyAuth(req)` + `verifyActorLogin(req, actorLogin)` pattern
- Session JWT stores `{ login, avatar_url, githubId }` — does NOT store access token
- OAuth scope is `read:user` — identity only, no repo access
- Attribution hack: `withActor(message, actor)` appends `_(by @username)_` to bot-posted comments
- `approve/route.ts` and `approve-review/route.ts` import `getOctokit` directly (not through wrapper functions)
- Dashboard already handles `SessionExpiredError` with re-login prompt

### Integration Points
- OAuth callback stores identity → must also encrypt+store GitHub access token
- `getOctokit()` singleton → must add parallel `createUserOctokit(token)` factory
- Write functions in `github-client.ts` → must accept optional `Octokit` parameter
- 7 API route files → must extract user token and pass user Octokit to write operations
- `withActor()` attribution hack → no longer needed when user's own token is used
- Dashboard error handling → must handle new `REAUTH_REQUIRED` error code for expired user tokens

## Reuse Inventory

### Existing Code to Reuse
- `verifyCodySession(req)` from `src/infra/auth/cody_session.ts` — base session verification
- `createCodySession(res, identity)` from `src/infra/auth/cody_session.ts` — session creation (extend)
- `requireCodyAuth(req)` from `src/ui/cody/auth.ts` — auth middleware (extend)
- `verifyActorLogin(req, login)` from `src/ui/cody/auth.ts` — actor verification (reuse as-is)
- `getOctokit()` from `src/ui/cody/github-client.ts` — keep for polling/fallback
- `SessionExpiredError` from `src/ui/cody/api.ts` — reuse for re-auth UX
- `logger` from `src/infra/utils/logger/logger` — all new logging
- `jose` library (already imported in cody_session.ts) — JWT signing
- `@octokit/rest` + `@octokit/plugin-throttling` — already in project

### New Code Justified
- `encryptToken(token)` / `decryptToken(encrypted)` in `cody_session.ts` — needed because JWTs are base64-encoded (readable), not encrypted. The GitHub access token must be encrypted at rest. AES-256-GCM using PAYLOAD_SECRET as key material.
- `createUserOctokit(token)` factory in `github-client.ts` — needed because the singleton caches a single Octokit instance. Per-request instances cannot share the cache.
- `getUserOctokit(req)` helper in `auth.ts` — convenience helper to extract+decrypt token from session and create Octokit instance. Avoids repeating this 3-line pattern in 7 route files.

---

## Step 1: Encrypt/Decrypt Token Helpers + Extend Session to Store GitHub Token

**Objective**: Add AES-256-GCM encryption helpers and extend the session JWT to carry an encrypted GitHub access token.

**Files to Touch**:
- `src/infra/auth/cody_session.ts` (MODIFIED — add encryption helpers, extend interfaces, modify createCodySession/verifyToken)

**Behavior**:
- Add `encryptToken(plaintext: string): string` — encrypts with AES-256-GCM using key derived from PAYLOAD_SECRET. Returns base64-encoded `iv:ciphertext:authTag`.
- Add `decryptToken(encrypted: string): string` — decrypts the above format.
- Extend `CodyGitHubIdentity` to add optional `ghToken?: string` (decrypted)
- Extend internal JWT payload to include `encryptedGhToken?: string`
- Modify `createCodySession` to accept optional `ghAccessToken` and encrypt it before embedding in JWT
- Modify `verifyToken` to decrypt and expose `ghToken` on the returned identity
- Existing sessions without the token field continue to work (backward compatible)

**Tests** (FAIL before, PASS after):
- `tests/unit/infra/auth/cody-session.test.ts` (NEW)
  - `encryptToken/decryptToken roundtrip succeeds`
  - `decryptToken with tampered ciphertext throws`
  - `createCodySession with ghAccessToken includes encrypted token in JWT`
  - `verifyCodySession extracts and decrypts ghToken from JWT`
  - `verifyCodySession works for legacy sessions without ghToken (returns ghToken: undefined)`

**Acceptance Criteria**:
- [ ] Encrypt/decrypt roundtrip works with random tokens
- [ ] JWT contains `encryptedGhToken` field (not plain token)
- [ ] Legacy sessions (no token) still verify successfully
- [ ] `ghToken` is exposed on `CodyGitHubIdentity` only when present

---

## Step 2: Upgrade OAuth Scope and Store User Token on Login

**Objective**: Change OAuth to request `repo` scope and persist the user's access token in the session.

**Files to Touch**:
- `src/app/api/oauth/github/route.ts` (MODIFIED — line 33: change scope)
- `src/app/api/oauth/github/callback/route.ts` (MODIFIED — pass access token to createCodySession, use user token for collaborator check)

**Behavior**:
- OAuth initiation: Change `scope` from `'read:user'` to `'repo'` (grants issues, PRs, actions, contents — all needed for dashboard writes)
- OAuth callback: After receiving `tokenData.access_token`:
  1. Use it to fetch `/user` profile (already done)
  2. Use it to verify collaborator status (replace bot-token-based `fetchCollaborators()` with a direct call using user's token: `GET /repos/{owner}/{repo}/collaborators/{username}` returns 204 if collaborator). This removes the dependency on bot token for login.
  3. Pass the access token to `createCodySession(res, { login, avatar_url, githubId }, tokenData.access_token)`
- **Backward compat**: Existing users must re-login to get the new scope. Their old `read:user` sessions still work for identity but won't have `ghToken`.

**Tests** (FAIL before, PASS after):
- `tests/unit/api/oauth/github.test.ts` (NEW)
  - `OAuth initiation URL includes scope=repo`
  - `Callback stores encrypted ghToken in session JWT`
  - `Callback verifies collaborator status using user's own token`
  - `Non-collaborator user is rejected`

**Acceptance Criteria**:
- [ ] GitHub OAuth consent screen requests `repo` scope
- [ ] Session JWT includes encrypted access token after login
- [ ] Collaborator check uses user's own token (not bot token)
- [ ] Non-collaborators are still rejected

---

## Step 3: Add `createUserOctokit` Factory and `getUserOctokit` Helper

**Objective**: Add a per-request Octokit factory alongside the existing singleton, and a convenience helper to extract the user's Octokit from a request.

**Files to Touch**:
- `src/ui/cody/github-client.ts` (MODIFIED — add `createUserOctokit` export near `getOctokit`)
- `src/ui/cody/auth.ts` (MODIFIED — add `getUserOctokit` helper)

**Behavior**:
- `createUserOctokit(token: string): Octokit` in `github-client.ts`:
  - Creates a new Octokit instance with the user's token
  - Uses same throttling plugin config as the singleton
  - Does NOT cache (per-request lifecycle)
  - Exported alongside `getOctokit`
- `getUserOctokit(req: NextRequest): Promise<Octokit | null>` in `auth.ts`:
  - Calls `verifyCodySession(req)` to get identity
  - If `identity.ghToken` exists, returns `createUserOctokit(identity.ghToken)`
  - If no token (legacy session), returns `null`
  - Callers use: `const userOctokit = await getUserOctokit(req)` then pass to write functions, falling back to bot Octokit

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/github-client.test.ts` (NEW or extend)
  - `createUserOctokit creates Octokit with provided token`
  - `createUserOctokit does not affect singleton instance`
- `tests/unit/ui/cody/auth.test.ts` (NEW or extend)
  - `getUserOctokit returns Octokit when session has ghToken`
  - `getUserOctokit returns null when session has no ghToken (legacy)`
  - `getUserOctokit returns null when no session`

**Acceptance Criteria**:
- [ ] `createUserOctokit` creates independent Octokit with user token
- [ ] `getOctokit()` singleton is unaffected
- [ ] `getUserOctokit` extracts token from session and creates instance
- [ ] Returns null for legacy sessions (graceful fallback)

---

## Step 4: Add Optional `octokit` Parameter to Write Functions in `github-client.ts`

**Objective**: All write functions accept an optional `Octokit` parameter; when provided, use it instead of the singleton.

**Files to Touch**:
- `src/ui/cody/github-client.ts` (MODIFIED — 13 functions)

**Functions to Modify** (add `userOctokit?: Octokit` as last parameter):
1. `postComment(issueNumber, body, userOctokit?)` — line 1221
2. `triggerWorkflow(options, userOctokit?)` — line 1238
3. `cancelWorkflowRun(runId, userOctokit?)` — line 1263
4. `createIssue(options, userOctokit?)` — line 1278
5. `uploadIssueAttachment(issueNumber, file, userOctokit?)` — line 1325
6. `updateIssue(issueNumber, options, userOctokit?)` — line 1353
7. `addAssignees(issueNumber, assignees, userOctokit?)` — line 1384
8. `removeAssignees(issueNumber, assignees, userOctokit?)` — line 1401
9. `addLabels(issueNumber, labels, userOctokit?)` — line 1418
10. `removeLabel(issueNumber, label, userOctokit?)` — line 1435
11. `closePR(prNumber, userOctokit?)` — (find in file, around line ~1010)
12. `deleteBranch(branchName, userOctokit?)` — (find in file, around line ~1035)

**Pattern** (same for all):
```typescript
export async function postComment(
  issueNumber: number,
  body: string,
  userOctokit?: Octokit,  // NEW
): Promise<void> {
  const octokit = userOctokit ?? getOctokit()  // Changed from: const octokit = getOctokit()
  // ... rest unchanged
}
```

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/github-client-user-octokit.test.ts` (NEW)
  - `postComment uses provided userOctokit instead of singleton`
  - `postComment falls back to singleton when no userOctokit`
  - `createIssue uses provided userOctokit`
  - (representative tests — don't need to test all 12, pattern is identical)

**Acceptance Criteria**:
- [ ] All 12 write functions accept optional `Octokit` parameter
- [ ] When provided, user Octokit is used for the API call
- [ ] When omitted, falls back to `getOctokit()` singleton (backward compat)
- [ ] No behavioral change for callers that don't pass the parameter

---

## Step 5: Wire User Octokit Through API Routes

**Objective**: All dashboard API routes that perform write operations extract the user's Octokit and pass it to write functions.

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED)
- `src/app/api/cody/tasks/route.ts` (MODIFIED — POST handler)
- `src/app/api/cody/tasks/approve/route.ts` (MODIFIED)
- `src/app/api/cody/tasks/approve-review/route.ts` (MODIFIED)
- `src/app/api/cody/publish/route.ts` (MODIFIED)
- `src/app/api/cody/branches/route.ts` (MODIFIED — DELETE and POST handlers)
- `src/app/api/cody/chat/save/route.ts` (MODIFIED)

**Pattern** (same in each route):
```typescript
import { getUserOctokit } from '@/ui/cody/auth'

// At start of handler, after requireCodyAuth:
const userOctokit = await getUserOctokit(req)

// Pass to write calls:
await postComment(issueNumber, body, userOctokit ?? undefined)
await createIssue(options, userOctokit ?? undefined)
// etc.
```

**Special Cases**:
- `approve/route.ts` and `approve-review/route.ts` use `getOctokit()` directly for `pulls.createReview`, `pulls.merge`, `git.deleteRef`, `issues.update`, `issues.removeLabel`. These must be changed to use `userOctokit ?? getOctokit()` directly.
- `branches/route.ts` uses `getOctokit()` directly for `repos.listBranches`, `pulls.list`, `git.deleteRef`. The read operations (GET) stay on bot token. The write operations (DELETE, POST) use user token.
- `chat/save/route.ts` uses `getOctokit()` directly for `repos.getContent` (read) and `repos.createOrUpdateFileContents` (write). Only the write call should use user Octokit.
- `publish/route.ts` uses `getOctokit()` directly for `repos.compareCommits` (read), `issues.listForRepo` (read), `issues.create` (write). Only the write call should use user Octokit.

**Tests** (FAIL before, PASS after):
- `tests/int/api/cody/actions-user-token.test.ts` (NEW) — integration test
  - `POST /api/cody/tasks/[taskId]/actions with user token posts comment under user identity`
  - `POST /api/cody/tasks with user token creates issue under user identity`
  - `POST /api/cody/tasks/[taskId]/actions falls back to bot token when no user token in session`

**Acceptance Criteria**:
- [ ] All 7 route files extract user Octokit from session
- [ ] Write operations use user's token when available
- [ ] Read operations continue using bot token (singleton)
- [ ] Falls back to bot token for legacy sessions
- [ ] `approve/route.ts` PR reviews + merges use user token (reviews appear under user)
- [ ] `chat/save/route.ts` file writes use user token (commits attributed to user)

---

## Step 6: Clean Up Attribution Hack

**Objective**: When user token is available, remove the `_(by @username)_` suffix from comments since they'll naturally appear under the user's identity.

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — `withActor` usage)
- `src/app/api/cody/tasks/route.ts` (MODIFIED — `actorNote` in POST)

**Behavior**:
- In `actions/route.ts`: When `userOctokit` is available (user's own token), skip the `withActor()` wrapper. When falling back to bot token, keep the attribution hack.
  ```typescript
  const message = userOctokit ? '/cody approve' : withActor('/cody approve', actor)
  await postComment(issueNumber, message, userOctokit ?? undefined)
  ```
- In `tasks/route.ts` POST: When `userOctokit` is available, skip the `actorNote` suffix on issue body.
- Keep `withActor()` function for bot-token fallback path.

**Tests** (FAIL before, PASS after):
- `tests/unit/api/cody/actions-attribution.test.ts` (NEW)
  - `Comment via user token does NOT include _(by @username)_ suffix`
  - `Comment via bot token (fallback) still includes _(by @username)_ suffix`
  - `Issue created via user token does NOT include "Created by @X" footer`

**Acceptance Criteria**:
- [ ] Comments posted with user token are clean (no attribution suffix)
- [ ] Bot token fallback still adds attribution
- [ ] Issue creation with user token omits the "Created by @X" footer

---

## Step 7: Handle Token Expiration / Re-Auth Flow

**Objective**: When a user's GitHub token is expired or revoked, catch the 401 and prompt re-login.

**Files to Touch**:
- `src/ui/cody/auth.ts` (MODIFIED — add error handling wrapper)
- `src/ui/cody/api.ts` (MODIFIED — add `ReauthRequiredError` class if needed, or reuse `SessionExpiredError`)
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — handle re-auth error)

**Behavior**:
- In `auth.ts`, wrap `getUserOctokit` to validate the token is still valid (lazy — only catches errors downstream).
- In API routes, catch Octokit 401 errors and return a specific response:
  ```json
  { "error": "github_token_expired", "message": "Your GitHub token has expired. Please log in again." }
  ```
  with HTTP status 401.
- In `api.ts` `fetchJSON`, detect `error === 'github_token_expired'` and throw `SessionExpiredError` (reuse existing class).
- In `CodyDashboard.tsx`, the existing `isSessionExpired` handling already shows a "Log In with GitHub" prompt. The user re-authenticates, gets a fresh token with `repo` scope, and continues.

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/auth-reauth.test.ts` (NEW)
  - `API route returns 401 with github_token_expired when user token is rejected by GitHub`
  - `Dashboard shows re-login prompt on github_token_expired`

**Acceptance Criteria**:
- [ ] Expired/revoked user token triggers re-login flow
- [ ] User can re-authenticate and resume operations
- [ ] Existing `SessionExpiredError` UI handling works for this case

---

## Step 8: Update Environment Documentation and Migration Notes

**Objective**: Document the new OAuth scope requirement and migration path.

**Files to Touch**:
- `.env.example` (MODIFIED — add note about repo scope)
- `scripts/cody/README.md` (MODIFIED — add per-user auth section)

**Behavior**:
- `.env.example`: Add comment explaining that GitHub OAuth App now needs `repo` scope
- `README.md`: Add section explaining:
  - Users must re-login after upgrade to get `repo` scope
  - User tokens are encrypted at rest in session JWT
  - Bot token (`CODY_BOT_TOKEN`) is still needed for background polling
  - When user token is available, writes are attributed to the user
  - Fallback to bot token for legacy sessions

**Tests**: None (documentation only)

**Acceptance Criteria**:
- [ ] `.env.example` documents the scope change
- [ ] README explains the per-user auth model
- [ ] Migration path for existing users is documented

---

## Summary

| Step | Files | Effort | Risk |
|------|-------|--------|------|
| 1. Token encryption + session extension | 1 file + tests | 20 min | Low — additive, backward compat |
| 2. OAuth scope upgrade + token storage | 2 files + tests | 20 min | Medium — scope change requires re-login |
| 3. User Octokit factory + helper | 2 files + tests | 15 min | Low — additive |
| 4. Optional octokit param on write funcs | 1 file + tests | 20 min | Low — backward compat, same pattern ×12 |
| 5. Wire through API routes | 7 files + tests | 30 min | Medium — most files touched |
| 6. Clean up attribution hack | 2 files + tests | 15 min | Low — cosmetic |
| 7. Token expiration handling | 3 files + tests | 20 min | Low — reuses existing error flow |
| 8. Documentation | 2 files | 10 min | None |
| **Total** | **~20 files** | **~2.5 hrs** | **Medium overall** |
