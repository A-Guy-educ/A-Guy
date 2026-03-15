# Codebase Context: 260314-fix-github-token-error

## Files to Modify
- `src/app/api/cody/tasks/route.ts` (line 339) — Fix error message string matching for no-token detection
- `src/app/api/cody/tasks/approve/route.ts` (lines 26-31) — Remove local getOctokit(), import shared one
- `src/app/api/cody/tasks/approve-review/route.ts` (lines 17-22) — Remove local getOctokit(), import shared one
- `src/app/api/cody/publish/route.ts` (lines 14-19) — Remove local getOctokit(), import shared one
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (lines 312-317) — Use shared getOctokit() for approve-pr action
- `src/ui/cody/api.ts` (line 39) — Update NoTokenError default message
- `src/ui/cody/components/CodyDashboard.tsx` (line 599) — Use dynamic error message from NoTokenError
- `tests/unit/cody-dashboard-token-error.test.ts` (NEW) — Reproduction tests

## Files to Read (reference patterns)
- `src/ui/cody/github-client.ts` (lines 77-84) — Shared getOctokit() with CODY_BOT_TOKEN support
- `tests/unit/cody-api-routes.spec.ts` — Existing test patterns for Cody API routes

## Key Signatures
- `export function getOctokit(): Octokit` from `src/ui/cody/github-client.ts`
- `export class NoTokenError extends Error` from `src/ui/cody/api.ts`
- `export class RateLimitError extends Error` from `src/ui/cody/api.ts`
- `async function handleResponse<T>(res: Response): Promise<T>` from `src/ui/cody/api.ts`

## Reuse Inventory
- `getOctokit()` from `src/ui/cody/github-client.ts` — replace 3 local copies + 1 inline usage
- `NoTokenError` from `src/ui/cody/api.ts` — already used by dashboard for error detection

## Integration Points
- `src/app/api/cody/tasks/route.ts` catch block must return `{ error: 'no_token' }` with 401 status for client-side `NoTokenError` to trigger
- `src/ui/cody/api.ts` `handleResponse()` maps 401 → `NoTokenError`
- `src/ui/cody/components/CodyDashboard.tsx` checks `error instanceof NoTokenError` to show error screen
- `src/ui/cody/hooks/index.ts` disables retry on `NoTokenError`

## Imports Verified
- `@/ui/cody/github-client` → exports `getOctokit` ✅
- `@/ui/cody/api` → exports `NoTokenError` ✅  
- `@octokit/rest` → imported by approve/approve-review/publish routes (will be replaced by shared import) ✅

## Bug Flow
1. User loads Cody dashboard → `useCodyTasks()` → `codyApi.tasks.list()` → `GET /api/cody/tasks`
2. Route calls `fetchIssues()` → `getOctokit()` in `github-client.ts`
3. No token → throws `Error('Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured')`
4. Catch in `tasks/route.ts` line 339: `error?.message?.includes('GITHUB_TOKEN not configured')` → **FALSE** (substring mismatch)
5. Falls through to generic handler → returns `{ tasks: [], error: "Neither..." }` with HTTP **200**
6. Client `handleResponse` doesn't throw `NoTokenError` (not 401) → returns `{ tasks: [] }`
7. Dashboard shows empty task list instead of the helpful error screen
