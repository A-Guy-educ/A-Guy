# Codebase Context: 260317-fix-approve-gate-403

## Files to Modify
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (lines 72-85, 115-120, 401-434) — Add fallback retry logic for user token failures
- `src/ui/cody/api.ts` (lines 68-96) — Improve 403 error handling in client
- `src/ui/cody/hooks/index.ts` (lines 306-309) — Optionally improve error display

## Files to Create
- `tests/unit/ui/cody/api/approve-gate-fallback.test.ts` (NEW) — Test approve gate with token fallback
- `tests/unit/ui/cody/api/error-handling.test.ts` (NEW) — Test client error handling for 403

## Files to Read (reference patterns)
- `tests/unit/ui/cody/api/close-action.test.ts` — Existing test pattern for actions route
- `src/ui/cody/github-error-handler.ts` — Error handling patterns (reference, not modified)
- `src/app/api/cody/tasks/approve/route.ts` — Similar approve pattern with try-catch per operation

## Key Signatures
- `postComment(issueNumber: number, body: string, userOctokit?: Octokit): Promise<void>` from `src/ui/cody/github-client.ts`
- `getOctokit(): Octokit` from `src/ui/cody/github-client.ts`
- `createUserOctokit(token: string): Octokit` from `src/ui/cody/github-client.ts`
- `withActor(message: string, actor?: string): string` from `src/app/api/cody/tasks/[taskId]/actions/route.ts` (local helper)
- `postWithAttribution(issueNumber, message, actor, userOctokit)` from `src/app/api/cody/tasks/[taskId]/actions/route.ts` (local helper)
- `requireCodyAuth(req: NextRequest): Promise<null | NextResponse>` from `src/ui/cody/auth.ts`
- `verifyActorLogin(req, suppliedLogin): Promise<{identity} | NextResponse>` from `src/ui/cody/auth.ts`
- `getUserOctokit(req: NextRequest): Promise<Octokit | null>` from `src/ui/cody/auth.ts`
- `handleResponse<T>(res: Response): Promise<T>` from `src/ui/cody/api.ts`

## Reuse Inventory
- `getOctokit()` from `src/ui/cody/github-client.ts` — bot token Octokit (fallback)
- `postComment()` from `src/ui/cody/github-client.ts` — already supports optional userOctokit
- `withActor()` from actions route — actor attribution formatting
- `ApiError` class from `src/ui/cody/api.ts` — typed error class
- `SessionExpiredError` class from `src/ui/cody/api.ts` — auth error class

## Integration Points
- The `postWithAttribution` helper is called from every comment-posting action in the switch block (approve, reject, execute, abort, close, reopen, reset)
- `handleResponse` is used by all client-side API calls in `src/ui/cody/api.ts`
- `useTaskActions` in `src/ui/cody/hooks/index.ts` passes errors to `toast.error`
- Error types (`ApiError`, `SessionExpiredError`, etc.) are consumed by UI components

## Imports Verified
- `@/ui/cody/github-client` → exports `postComment`, `getOctokit`, `createUserOctokit` ✅
- `@/ui/cody/auth` → exports `requireCodyAuth`, `verifyActorLogin`, `getUserOctokit` ✅
- `@/ui/cody/constants` → exports `GITHUB_OWNER`, `GITHUB_REPO` ✅

## Error Flow (Current)
```
User clicks Approve → approveGate() → POST /actions → postWithAttribution(userOctokit)
  → postComment(userOctokit) → GitHub API 403
  → catch(error) → error.status === 403 → return { error: 'github_forbidden', status: 403 }
  → handleResponse → throw ApiError('github_forbidden', 403)
  → toast.error('Failed to approve gate', { description: 'github_forbidden' })
```

## Error Flow (After Fix)
```
User clicks Approve → approveGate() → POST /actions → postWithFallback(userOctokit)
  → postComment(userOctokit) → GitHub API 403
  → catch → log warning → postComment(botOctokit, withActor(message, actor))
  → return { success: true, message: 'Gate approved' }
```
