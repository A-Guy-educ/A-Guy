# Codebase Context: per-user-github-auth

## Files to Modify
- `src/infra/auth/cody_session.ts` (all lines) — Add token encryption helpers, extend session to store encrypted GitHub access token
- `src/app/api/oauth/github/route.ts` (line 33) — Change OAuth scope from `read:user` to `repo`
- `src/app/api/oauth/github/callback/route.ts` (lines 64-153) — Store access token in session, use user token for collaborator check
- `src/ui/cody/github-client.ts` (lines 115-147, 1221-1447) — Add `createUserOctokit` factory, add optional `userOctokit` param to 12 write functions
- `src/ui/cody/auth.ts` (lines 84-148) — Add `getUserOctokit(req)` helper
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (lines 69-388) — Wire user Octokit through all 18 action handlers
- `src/app/api/cody/tasks/route.ts` (lines 357-413) — Wire user Octokit through POST handler
- `src/app/api/cody/tasks/approve/route.ts` (lines 52-128) — Replace `getOctokit()` with user Octokit
- `src/app/api/cody/tasks/approve-review/route.ts` (lines 37-106) — Replace `getOctokit()` with user Octokit
- `src/app/api/cody/publish/route.ts` (lines 31-84) — Use user Octokit for issue creation
- `src/app/api/cody/branches/route.ts` (lines 84-165) — Use user Octokit for DELETE/POST handlers
- `src/app/api/cody/chat/save/route.ts` (lines 53-125) — Use user Octokit for file write
- `src/ui/cody/api.ts` (lines 38-88) — Potentially extend error handling for github_token_expired
- `src/ui/cody/components/CodyDashboard.tsx` (lines 443-444, 677-713) — Handle re-auth for expired user tokens
- `.env.example` (lines 98-102) — Document repo scope requirement
- `scripts/cody/README.md` — Document per-user auth model

## Files to Create (NEW)
- `tests/unit/infra/auth/cody-session.test.ts` — Session encryption + token storage tests
- `tests/unit/ui/cody/github-client-user-octokit.test.ts` — User Octokit factory tests
- `tests/unit/ui/cody/auth-user-octokit.test.ts` — getUserOctokit helper tests

## Files to Read (reference patterns)
- `src/infra/auth/cody_session.ts` — Session JWT pattern with jose library
- `src/ui/cody/github-client.ts` — Octokit singleton + throttling plugin pattern
- `src/ui/cody/auth.ts` — requireCodyAuth / verifyActorLogin pattern
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` — How write functions are called from routes
- `src/ui/cody/api.ts` — Error class pattern (SessionExpiredError, NoTokenError)
- `src/ui/cody/hooks/useGitHubIdentity.ts` — Client-side auth state management

## Key Signatures
- `createCodySession(res: NextResponse, identity: CodyGitHubIdentity): Promise<void>` from `src/infra/auth/cody_session.ts`
- `verifyCodySession(req: NextRequest): Promise<CodyGitHubIdentity | null>` from `src/infra/auth/cody_session.ts`
- `getOctokit(): Octokit` from `src/ui/cody/github-client.ts`
- `postComment(issueNumber: number, body: string): Promise<void>` from `src/ui/cody/github-client.ts`
- `createIssue(options: { title, body?, labels?, assignees? }): Promise<GitHubIssue>` from `src/ui/cody/github-client.ts`
- `updateIssue(issueNumber: number, options: { title?, body?, state?, labels?, assignees? }): Promise<void>` from `src/ui/cody/github-client.ts`
- `triggerWorkflow(options: { taskId, mode?, fromStage?, feedback? }): Promise<void>` from `src/ui/cody/github-client.ts`
- `cancelWorkflowRun(runId: number): Promise<void>` from `src/ui/cody/github-client.ts`
- `addLabels(issueNumber: number, labels: string[]): Promise<void>` from `src/ui/cody/github-client.ts`
- `removeLabel(issueNumber: number, label: string): Promise<void>` from `src/ui/cody/github-client.ts`
- `addAssignees(issueNumber: number, assignees: string[]): Promise<void>` from `src/ui/cody/github-client.ts`
- `removeAssignees(issueNumber: number, assignees: string[]): Promise<void>` from `src/ui/cody/github-client.ts`
- `closePR(prNumber: number): Promise<void>` from `src/ui/cody/github-client.ts`
- `deleteBranch(branchName: string): Promise<void>` from `src/ui/cody/github-client.ts`
- `uploadIssueAttachment(issueNumber: number, file: { name, content }): Promise<{ attachment_url, name }>` from `src/ui/cody/github-client.ts`
- `fetchCollaborators(): Promise<GitHubCollaborator[]>` from `src/ui/cody/github-client.ts`
- `requireCodyAuth(req: NextRequest): Promise<null | NextResponse>` from `src/ui/cody/auth.ts`
- `verifyActorLogin(req: NextRequest, suppliedLogin: string | undefined): Promise<{ identity: CodyGitHubIdentity } | NextResponse>` from `src/ui/cody/auth.ts`
- `interface CodyGitHubIdentity { login: string; avatar_url: string; githubId: number }` from `src/infra/auth/cody_session.ts`

## Reuse Inventory
- `verifyCodySession` from `src/infra/auth/cody_session.ts` — base session verification (extend, not replace)
- `createCodySession` from `src/infra/auth/cody_session.ts` — session creation (extend signature)
- `getOctokit()` singleton from `src/ui/cody/github-client.ts` — keep for polling/reads/fallback
- `SessionExpiredError` from `src/ui/cody/api.ts` — reuse for expired user token handling
- `requireCodyAuth` from `src/ui/cody/auth.ts` — keep as-is, add parallel `getUserOctokit`
- `verifyActorLogin` from `src/ui/cody/auth.ts` — reuse unchanged
- `withActor()` from `src/app/api/cody/tasks/[taskId]/actions/route.ts` — keep for bot-token fallback
- `logger` from `src/infra/utils/logger/logger` — all logging
- `jose` library — JWT signing/verification (already a dependency)
- `@octokit/rest` + `@octokit/plugin-throttling` — Octokit creation (already a dependency)
- Node.js `crypto` module — AES-256-GCM encryption (built-in, no new dep)

## Integration Points
- OAuth callback must pass access token to `createCodySession` (Step 2)
- `getUserOctokit` must be imported in all 7 route files (Step 5)
- Write functions must accept `Octokit | undefined` as last param (Step 4)
- `approve/route.ts` and `approve-review/route.ts` use raw `getOctokit()` — must switch to user Octokit pattern (Step 5)
- Dashboard error handling already supports `SessionExpiredError` — re-auth flow reuses this (Step 7)
- Existing sessions without ghToken MUST continue working (backward compat in Steps 1-5)

## Imports Verified
- `import { SignJWT, jwtVerify } from 'jose'` ✅ (used in cody_session.ts)
- `import { Octokit } from '@octokit/rest'` ✅ (used in github-client.ts)
- `import { throttling } from '@octokit/plugin-throttling'` ✅ (used in github-client.ts)
- `import { verifyCodySession, type CodyGitHubIdentity } from '@/infra/auth/cody_session'` ✅ (used in auth.ts)
- `import { getOctokit } from '@/ui/cody/github-client'` ✅ (used in multiple route files)
- `import { requireCodyAuth, verifyActorLogin } from '@/ui/cody/auth'` ✅ (used in all action routes)
- `import { GITHUB_OWNER, GITHUB_REPO } from '@/ui/cody/constants'` ✅ (used in all routes)
- `import { logger } from '@/infra/utils/logger/logger'` ✅ (used in callback, auth)

## Constants
- `GITHUB_OWNER` / `GITHUB_REPO` from `src/ui/cody/constants.ts`
- `WORKFLOW_ID` from `src/ui/cody/constants.ts`
- `CODY_SESSION_COOKIE = 'cody-gh-session'` from `src/infra/auth/cody_session.ts`
- `SESSION_TTL_SECONDS = 86400` (24 hours) from `src/infra/auth/cody_session.ts`

## Environment Variables
- `PAYLOAD_SECRET` — used for JWT signing AND as key material for token encryption
- `GITHUB_OAUTH_CLIENT_ID` — OAuth App client ID
- `GITHUB_OAUTH_CLIENT_SECRET` — OAuth App client secret
- `CODY_BOT_TOKEN` / `GITHUB_TOKEN` — bot token for polling (still needed)
