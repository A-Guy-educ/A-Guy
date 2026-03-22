# Plan: Cody Dashboard Quick Wins (Top 10 Security & Bug Fixes)

**Task ID**: 260316-cody-dashboard-quick-wins
**Task Type**: fix_bug (batch)
**Estimated Total Effort**: ~4 hours

---

## Research Findings

### File Paths Verified
- ✅ `src/app/api/cody/chat/route.ts` — Figma MCP subprocess (lines 80-150)
- ✅ `src/ui/cody/auth.ts` — `verifyActorLogin` prefix matching (lines 140-148)
- ✅ `src/ui/cody/github-client.ts` — Rate limit retry, cache, postComment
- ✅ `src/app/api/cody/remote/status/route.ts` — Uses `requireDashboardAuth`
- ✅ `src/app/api/cody/boards/route.ts` — No auth check
- ✅ `src/app/api/cody/prs/status/route.ts` — Missing prNumber validation
- ✅ `src/app/api/cody/prs/comments/route.ts` — Missing actorLogin verification, uses bot token
- ✅ `src/app/api/cody/inspector/health/route.ts` — `execFileSync` blocking
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — 10x `clearCache()` calls

### Patterns Observed
- Auth: Two auth functions exist — `requireCodyAuth` (GitHub OAuth) and `requireDashboardAuth` (Payload). All Cody routes should use `requireCodyAuth`.
- Cache: Targeted invalidation functions already exist (`invalidateTaskCache`, `invalidatePRCache`, `invalidateBoardCache`, `invalidateBranchCache`). `clearCache()` calls should be replaced with specific ones.
- `postComment()` already accepts optional `userOctokit` parameter — just not used in PR comments route.
- Zod schemas already used in PR comments route (`getSchema`, `postSchema`).

### Integration Points
- `requireCodyAuth` is the standard auth pattern, imported from `@/ui/cody/auth`
- `verifyActorLogin` is used in several action routes — must not break callers
- `clearCache()` is the only function used in actions route — replacing requires importing specific invalidation functions

---

## Reuse Inventory

### Existing Utilities to Reuse
- `requireCodyAuth` from `src/ui/cody/auth` — standard Cody auth check
- `verifyActorLogin` from `src/ui/cody/auth` — actor identity verification
- `getUserOctokit` from `src/ui/cody/auth` — get per-user Octokit instance
- `invalidateTaskCache` from `src/ui/cody/github-client` — targeted task cache clear
- `invalidatePRCache` from `src/ui/cody/github-client` — targeted PR cache clear
- `invalidateBoardCache` from `src/ui/cody/github-client` — targeted board cache clear
- `invalidateBranchCache` from `src/ui/cody/github-client` — targeted branch cache clear
- `logger` from `src/infra/utils/logger/logger` — structured logging
- `z` from `zod` — input validation

### New Utilities
- None — all fixes use existing code

---

## Steps

### Step 1: Fix FIGMA_API_KEY Leaked via CLI Args (Priority Score: 25.0)

**Root Cause**: The Figma API key is passed as a command-line argument (`--figma-api-key=${process.env.FIGMA_API_KEY}`), which is visible to any process on the machine via `ps aux`.

**Files to Touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — lines 91-102)

**Reproduction Test**:
- Test location: `tests/unit/cody/chat-route-figma.test.ts`
- Test: `spawn args should NOT contain figma-api-key flag`
- Why it fails: Current code includes the key in the args array

**Fix**: Pass the key via `env` option of `spawn()` instead of CLI args:
```
Before:  spawn('npx', ['-y', 'figma-developer-mcp', `--figma-api-key=${key}`, '--port', port])
After:   spawn('npx', ['-y', 'figma-developer-mcp', '--port', port], { env: { ...process.env, FIGMA_API_KEY: key } })
```

Also add process cleanup:
- Save process reference in module state
- Register `process.on('beforeExit')` handler to kill child
- Add retry count guard for process spawn

**Acceptance Criteria**:
- [ ] `FIGMA_API_KEY` not in spawn args
- [ ] Key passed via `env` option
- [ ] Process reference saved for cleanup
- [ ] Cleanup handler registered

---

### Step 2: Fix `verifyActorLogin` Prefix Matching Impersonation (Priority Score: 20.0)

**Root Cause**: The prefix matching logic allows `"john"` to match `"johndoe"` or any login starting with `"john-"`. This enables impersonation.

**Files to Touch**:
- `src/ui/cody/auth.ts` (MODIFIED — lines 145-148)

**Reproduction Test**:
- Test location: `tests/unit/cody/auth-verify-actor.test.ts`
- Test: `verifyActorLogin should reject when suppliedLogin is a prefix of identity login`
- Why it fails: Current code allows `"john"` to match `"john-admin"` via `startsWith`

**Fix**: Remove the prefix matching branch entirely. Only allow exact (case-insensitive) match:
```typescript
// Remove this line:
// !normalizedIdentity.startsWith(normalizedSupplied + '-')
// Keep only:
if (normalizedSupplied !== normalizedIdentity) {
```

**Acceptance Criteria**:
- [ ] `"john"` does NOT match `"johndoe"`
- [ ] `"john"` does NOT match `"john-admin"`
- [ ] `"John"` DOES match `"john"` (case-insensitive still works)
- [ ] Exact match still works

---

### Step 3: Fix Infinite Secondary Rate Limit Retry (Priority Score: 16.0)

**Root Cause**: `onSecondaryRateLimit` callback always returns `true`, meaning infinite retries. Secondary rate limits indicate GitHub abuse detection — infinite retries risk token ban.

**Files to Touch**:
- `src/ui/cody/github-client.ts` (MODIFIED — lines 140-143)

**Reproduction Test**:
- Test location: `tests/unit/cody/github-client-ratelimit.test.ts`
- Test: `onSecondaryRateLimit should stop retrying after 2 attempts`
- Why it fails: Current code always returns `true`

**Fix**: Add retry count check, same pattern as `onRateLimit`:
```typescript
onSecondaryRateLimit: (retryAfter, _options, _octokit) => {
  const retryCount = _options.request?.headers?.['x-octokit-retry-count'] ?? 0
  if (retryCount < 2) {
    console.warn(`[Cody] Secondary rate limit, retrying after ${retryAfter}s (attempt ${retryCount + 1})`)
    return true
  }
  console.error(`[Cody] Secondary rate limit hit ${retryCount + 1} times, giving up`)
  return false
},
```

**Acceptance Criteria**:
- [ ] Retries at most 2 times on secondary rate limit
- [ ] Returns `false` after 2 retries
- [ ] Logs retry count

---

### Step 4: Fix Auth Inconsistency on Remote Status Route (Priority Score: 16.0)

**Root Cause**: `src/app/api/cody/remote/status/route.ts` uses `requireDashboardAuth()` (Payload-based) while all other Cody endpoints use `requireCodyAuth()` (GitHub OAuth). Users authenticated via GitHub OAuth cannot access this endpoint.

**Files to Touch**:
- `src/app/api/cody/remote/status/route.ts` (MODIFIED — lines 12, 21-28)

**Reproduction Test**:
- Test location: `tests/unit/cody/remote-status-auth.test.ts`
- Test: `remote status route should use requireCodyAuth, not requireDashboardAuth`
- Why it fails: Current code imports and uses `requireDashboardAuth`

**Fix**:
1. Change import from `requireDashboardAuth` to `requireCodyAuth`
2. Update the auth check pattern to match other Cody routes:
```typescript
const authError = await requireCodyAuth(req)
if (authError) return authError
```

**Acceptance Criteria**:
- [ ] Import changed to `requireCodyAuth`
- [ ] `requireDashboardAuth` no longer used
- [ ] Auth check matches pattern of other Cody API routes

---

### Step 5: Add Process Lifecycle Management for Figma MCP (Priority Score: 10.0)

**Root Cause**: The spawned `figma-developer-mcp` child process is never cleaned up. On every cold start, a zombie process accumulates. No `process.on('exit')` handler exists.

**Files to Touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — lines 80-145)

**Note**: This step builds on Step 1 (same file). The Figma key fix from Step 1 is prerequisite.

**Fix**:
1. Save process reference in module-level variable
2. Add cleanup on `process.on('beforeExit')` and `process.on('SIGTERM')`
3. Add a `net.Socket` client cleanup in the port-check loop (destroy on error too)
4. Use a `let figmaMcpProcessRef: ChildProcess | null = null` at module level

**Reproduction Test**:
- Test location: `tests/unit/cody/chat-route-figma.test.ts`
- Test: `figma MCP process should be tracked for cleanup`
- Why it fails: Currently process reference is lost after initialization

**Acceptance Criteria**:
- [ ] Process reference saved in module-level variable
- [ ] `process.on('beforeExit')` kills child process
- [ ] Socket clients destroyed on error in port-check loop
- [ ] Port check interval cleared on timeout

---

### Step 6: Add Auth to Boards API Endpoint (Priority Score: 9.0)

**Root Cause**: The `/api/cody/boards` endpoint has no authentication, exposing repository labels and milestones to anyone.

**Files to Touch**:
- `src/app/api/cody/boards/route.ts` (MODIFIED — lines 17-18)

**Reproduction Test**:
- Test location: `tests/unit/cody/boards-route-auth.test.ts`
- Test: `boards route should require authentication`
- Why it fails: Currently returns data without any auth check

**Fix**: Add `requireCodyAuth` check at the start of the GET handler:
```typescript
import { requireCodyAuth } from '@/ui/cody/auth'

export async function GET(req: NextRequest) {
  const authError = await requireCodyAuth(req)
  if (authError) return authError
  // ... rest of handler
}
```

**Acceptance Criteria**:
- [ ] `requireCodyAuth` imported and called
- [ ] Unauthenticated requests return 401
- [ ] Authenticated requests still return boards data

---

### Step 7: Replace `execFileSync` with Async `execFile` in Inspector Health (Priority Score: 9.0)

**Root Cause**: `execFileSync` blocks the Node.js event loop while running the `gh` CLI. Under load, this causes request queueing.

**Files to Touch**:
- `src/app/api/cody/inspector/health/route.ts` (MODIFIED — lines 11, 19-35)

**Reproduction Test**:
- Test location: `tests/unit/cody/inspector-health-async.test.ts`
- Test: `getInspectorState should use async execFile, not sync`
- Why it fails: Currently uses `execFileSync`

**Fix**: Convert `getInspectorState()` to async using `util.promisify(execFile)`:
```typescript
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

async function getInspectorState(): Promise<Record<string, unknown>> {
  if (process.env.GITHUB_ACTIONS) {
    try {
      const { stdout } = await execFileAsync('gh', [...args], { encoding: 'utf-8' })
      // ...
    }
  }
}
```

**Acceptance Criteria**:
- [ ] `execFileSync` replaced with async `execFile`
- [ ] `getInspectorState` is now `async`
- [ ] Error handling preserved
- [ ] Local file fallback still works

---

### Step 8: Add `prNumber` Validation to PR Status Route (Priority Score: 9.0)

**Root Cause**: `prNumber` query parameter is converted with `Number()` without validation. `NaN`, negative numbers, and floats pass through.

**Files to Touch**:
- `src/app/api/cody/prs/status/route.ts` (MODIFIED — lines 2, 14-19)

**Reproduction Test**:
- Test location: `tests/unit/cody/pr-status-validation.test.ts`
- Test: `pr status route should reject invalid prNumber values`
- Why it fails: `Number('abc')` = NaN, `Number('-1')` = -1 both pass through

**Fix**: Add Zod validation (same pattern as PR comments route):
```typescript
import { z } from 'zod'

const querySchema = z.object({
  prNumber: z.coerce.number().int().positive(),
})

// Then:
const parsed = querySchema.safeParse({ prNumber: searchParams.get('prNumber') })
if (!parsed.success) {
  return NextResponse.json({ error: 'Invalid prNumber' }, { status: 400 })
}
const status = await fetchPRCIStatus(parsed.data.prNumber)
```

**Acceptance Criteria**:
- [ ] Zod schema validates prNumber
- [ ] NaN, negative, float, non-numeric strings all return 400
- [ ] Valid positive integers work as before

---

### Step 9: Fix PR Comments to Use User Token (Priority Score: 6.0)

**Root Cause**: The POST handler for PR comments uses the bot token instead of the user's Octokit. Comments appear from the bot instead of the user.

**Files to Touch**:
- `src/app/api/cody/prs/comments/route.ts` (MODIFIED — lines 2, 43-50)

**Reproduction Test**:
- Test location: `tests/unit/cody/pr-comments-user-token.test.ts`
- Test: `PR comment POST should use user octokit when available`
- Why it fails: Currently calls `postComment(prNumber, fullBody)` without userOctokit

**Fix**: Get user Octokit and pass it to `postComment`:
```typescript
import { requireCodyAuth, getUserOctokit, verifyActorLogin } from '@/ui/cody/auth'

// In POST handler, after auth check:
const userOctokit = await getUserOctokit(req)
await postComment(prNumber, fullBody, userOctokit ?? undefined)
```

Also add `verifyActorLogin` check if `actorLogin` is provided:
```typescript
if (parsed.data.actorLogin) {
  const verified = await verifyActorLogin(req, parsed.data.actorLogin)
  if (verified instanceof NextResponse) return verified
}
```

**Acceptance Criteria**:
- [ ] `getUserOctokit` called and passed to `postComment`
- [ ] `verifyActorLogin` called when `actorLogin` is present
- [ ] Bot token used as fallback when user token unavailable

---

### Step 10: Replace `clearCache()` with Targeted Invalidation in Actions Route (Priority Score: 6.0)

**Root Cause**: Every action calls `clearCache()` which clears the entire in-memory cache (tasks, PRs, labels, milestones, branches, collaborators). This causes a thundering herd of GitHub API calls on the next request. Targeted invalidation functions already exist but aren't used.

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — 10 lines, each `clearCache()` call)

**Reproduction Test**:
- Test location: `tests/unit/cody/actions-cache-invalidation.test.ts`
- Test: `action handlers should use targeted cache invalidation, not clearCache()`
- Why it fails: grep shows 10 `clearCache()` calls in the file

**Fix**: Replace each `clearCache()` call with the appropriate targeted invalidation:

| Action | Current | Replacement |
|--------|---------|-------------|
| `approve`, `reject`, `rerun`, `execute`, `fix` | `clearCache()` | `invalidateTaskCache()` |
| `close`, `reopen`, `reset` | `clearCache()` | `invalidateTaskCache()` + `invalidateBranchCache()` |
| `close-pr` | `clearCache()` | `invalidatePRCache()` + `invalidateTaskCache()` |
| `add-label`, `remove-label` | `clearCache()` | `invalidateTaskCache()` + `invalidateBoardCache()` |
| `assign`, `unassign` | `clearCache()` | `invalidateTaskCache()` |
| `comment` | `clearCache()` | `invalidateTaskCache()` |

Import the targeted functions:
```typescript
import {
  // ... existing imports ...
  invalidateTaskCache,
  invalidatePRCache,
  invalidateBoardCache,
  invalidateBranchCache,
  // Remove clearCache from imports
} from '@/ui/cody/github-client'
```

**Acceptance Criteria**:
- [ ] No `clearCache()` calls remain in the file
- [ ] Each action uses appropriate targeted invalidation
- [ ] `invalidateTaskCache`, `invalidatePRCache`, `invalidateBoardCache`, `invalidateBranchCache` imported
- [ ] `clearCache` removed from imports

---

## Summary

| Step | Issue | Files | Effort | Priority |
|------|-------|-------|--------|----------|
| 1 | FIGMA_API_KEY in CLI args | `chat/route.ts` | 15 min | 25.0 |
| 2 | verifyActorLogin prefix match | `auth.ts` | 10 min | 20.0 |
| 3 | Infinite rate limit retry | `github-client.ts` | 10 min | 16.0 |
| 4 | Auth inconsistency | `remote/status/route.ts` | 10 min | 16.0 |
| 5 | Figma MCP process leak | `chat/route.ts` | 30 min | 10.0 |
| 6 | Boards API no auth | `boards/route.ts` | 10 min | 9.0 |
| 7 | execFileSync blocks event loop | `inspector/health/route.ts` | 15 min | 9.0 |
| 8 | prNumber validation | `prs/status/route.ts` | 10 min | 9.0 |
| 9 | PR comments bot token | `prs/comments/route.ts` | 15 min | 6.0 |
| 10 | clearCache thundering herd | `actions/route.ts` | 20 min | 6.0 |

**Total: ~2.5 hours of implementation** + ~1.5 hours of testing

