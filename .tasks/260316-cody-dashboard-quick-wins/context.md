# Codebase Context: 260316-cody-dashboard-quick-wins

## Files to Modify

- `src/app/api/cody/chat/route.ts` (lines 80-150) — Fix Figma API key leak via CLI args, add process lifecycle cleanup (Steps 1 & 5)
- `src/ui/cody/auth.ts` (lines 140-148) — Remove prefix matching in verifyActorLogin (Step 2)
- `src/ui/cody/github-client.ts` (lines 140-143) — Add retry count limit to onSecondaryRateLimit (Step 3)
- `src/app/api/cody/remote/status/route.ts` (lines 12, 21-28) — Switch from requireDashboardAuth to requireCodyAuth (Step 4)
- `src/app/api/cody/boards/route.ts` (lines 17-18) — Add requireCodyAuth check (Step 6)
- `src/app/api/cody/inspector/health/route.ts` (lines 11, 19-35) — Replace execFileSync with async execFile (Step 7)
- `src/app/api/cody/prs/status/route.ts` (lines 2, 14-19) — Add Zod validation for prNumber (Step 8)
- `src/app/api/cody/prs/comments/route.ts` (lines 2, 43-50) — Use user Octokit + verify actorLogin (Step 9)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (10 locations) — Replace clearCache() with targeted invalidation (Step 10)

## Files to Read (reference patterns)

- `src/app/api/cody/prs/comments/route.ts` — Zod validation pattern for prNumber (reuse in Step 8)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (lines 1-12) — Standard Cody auth import pattern
- `src/ui/cody/github-client.ts` (lines 88-108) — Targeted cache invalidation functions

## Key Signatures

- `requireCodyAuth(req: NextRequest): Promise<NextResponse | null>` from `src/ui/cody/auth`
- `requireDashboardAuth(req: NextRequest): Promise<{ authenticated: boolean }>` from `src/ui/cody/auth`
- `verifyActorLogin(req: NextRequest, suppliedLogin: string | undefined): Promise<{ identity: CodyGitHubIdentity } | NextResponse>` from `src/ui/cody/auth`
- `getUserOctokit(req: NextRequest): Promise<Octokit | null>` from `src/ui/cody/auth`
- `postComment(issueNumber: number, body: string, userOctokit?: Octokit): Promise<void>` from `src/ui/cody/github-client`
- `clearCache(): void` from `src/ui/cody/github-client`
- `invalidateTaskCache(): void` from `src/ui/cody/github-client`
- `invalidatePRCache(): void` from `src/ui/cody/github-client`
- `invalidateBoardCache(): void` from `src/ui/cody/github-client`
- `invalidateBranchCache(): void` from `src/ui/cody/github-client`
- `clearCacheByCategory(category: 'all' | 'tasks' | 'prs' | 'boards' | 'branches'): void` from `src/ui/cody/github-client`
- `fetchPRCIStatus(prNumber: number)` from `src/ui/cody/github-client`
- `getOctokit(): Octokit` from `src/ui/cody/github-client`

## Reuse Inventory

- `requireCodyAuth` from `src/ui/cody/auth` — standard Cody auth for all API routes
- `verifyActorLogin` from `src/ui/cody/auth` — actor identity verification (to be fixed in Step 2, used in Step 9)
- `getUserOctokit` from `src/ui/cody/auth` — per-user GitHub token for write operations
- `invalidateTaskCache` from `src/ui/cody/github-client` — clear task-related cache entries
- `invalidatePRCache` from `src/ui/cody/github-client` — clear PR-related cache entries
- `invalidateBoardCache` from `src/ui/cody/github-client` — clear label/milestone cache entries
- `invalidateBranchCache` from `src/ui/cody/github-client` — clear branch cache entries
- `logger` from `src/infra/utils/logger/logger` — already imported in some files, add to others
- `z` from `zod` — already used in PR comments route, reuse schema pattern for PR status

## Integration Points

- All Cody API routes follow same auth pattern: `const authError = await requireCodyAuth(req); if (authError) return authError;`
- `postComment()` already has optional `userOctokit` param — just needs to be passed
- `clearCache()` import must be removed from actions route and replaced with specific invalidation imports
- Remote status route must change import from `requireDashboardAuth` to `requireCodyAuth` — auth response shape changes

## Imports Verified

- `@/ui/cody/auth` → exports `requireCodyAuth`, `requireDashboardAuth`, `verifyActorLogin`, `getUserOctokit` ✅
- `@/ui/cody/github-client` → exports `invalidateTaskCache`, `invalidatePRCache`, `invalidateBoardCache`, `invalidateBranchCache`, `clearCache`, `postComment`, `fetchPRCIStatus` ✅
- `@/ui/cody/constants` → exports `GITHUB_OWNER`, `GITHUB_REPO` ✅
- `@/infra/utils/logger/logger` → exports `logger` ✅
- `zod` → `z` available ✅

## Test Locations (NEW)

- `tests/unit/cody/chat-route-figma.test.ts` — Steps 1 & 5
- `tests/unit/cody/auth-verify-actor.test.ts` — Step 2
- `tests/unit/cody/github-client-ratelimit.test.ts` — Step 3
- `tests/unit/cody/remote-status-auth.test.ts` — Step 4
- `tests/unit/cody/boards-route-auth.test.ts` — Step 6
- `tests/unit/cody/inspector-health-async.test.ts` — Step 7
- `tests/unit/cody/pr-status-validation.test.ts` — Step 8
- `tests/unit/cody/pr-comments-user-token.test.ts` — Step 9
- `tests/unit/cody/actions-cache-invalidation.test.ts` — Step 10

## Dependencies Between Steps

- Step 5 depends on Step 1 (same file, Step 1 changes spawn args, Step 5 adds cleanup)
- All other steps are independent and can be done in any order
- Step 9 uses `verifyActorLogin` which is fixed in Step 2 — but Step 9 works with the fixed version
