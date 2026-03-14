# Build Agent Report: feat/github-oauth-actor-trail

## Changes

### Phase 1 – GitHub OAuth Authentication
- **src/infra/auth/cody_session.ts**: JWT session helpers (`createCodySession`, `verifyCodySession`, `verifyCodySessionToken`, `clearCodySession`) using `jose` + `PAYLOAD_SECRET`
- **src/app/api/oauth/github/route.ts**: GitHub OAuth initiation route (PKCE state, redirect to GitHub)
- **src/app/api/oauth/github/callback/route.ts**: OAuth callback — code exchange, GitHub user fetch, collaborator check, session cookie creation
- **src/app/api/cody/auth/me/route.ts**: Returns current GitHub identity from session cookie
- **src/app/api/cody/auth/logout/route.ts**: POST clears session + returns JSON; GET clears session + redirects to OAuth
- **src/ui/cody/hooks/useGitHubIdentity.ts**: Replaced localStorage picker with React Query call to `/api/cody/auth/me`
- **src/app/(cody)/cody/page.tsx**: Replaced Payload admin check with `verifyCodySessionToken`; redirects unauthenticated users to OAuth
- **src/ui/cody/components/CodyDashboard.tsx**: Removed `GitHubUserPickerDialog` rendering and related state
- **src/ui/cody/auth.ts**: Added `requireCodyAuth()` using `verifyCodySession`
- **src/app/api/cody/tasks/route.ts**: Secured with `requireCodyAuth`
- **src/app/api/cody/tasks/[taskId]/route.ts**: Secured with `requireCodyAuth`
- **src/app/api/cody/tasks/[taskId]/actions/route.ts**: Secured with `requireCodyAuth`
- **src/app/api/cody/collaborators/route.ts**: Secured with `requireCodyAuth`
- **src/app/api/cody/pipeline/[taskId]/route.ts**: Secured with `requireCodyAuth`
- **src/ui/cody/components/GitHubUserPickerDialog.tsx**: DELETED (now unused)
- **.env.example**: Added `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` docs

### Phase 2 – Actor Audit Trail
- **scripts/cody/cody-utils.ts**: Added `actor?` to `CodyInput`, `ActorEvent` type, `triggeredByLogin`/`actorHistory` to `CodyPipelineStatus`
- **scripts/cody/engine/types.ts**: Added `ActorEvent` interface, `triggeredBy?`/`actorHistory?` to `PipelineStateV2`, `actor?` to `PipelineContext`
- **scripts/cody/engine/status.ts**: `initState()` writes `triggeredBy`/`actorHistory`; added `appendActorEvent()` helper; `stateToV1()` passes through new fields
- **scripts/cody/entry.ts**: Reads `GITHUB_ACTOR` env var into `ctx.actor`
- **.github/workflows/cody.yml**: Added `GITHUB_ACTOR` env var to "Run Cody" step
- **scripts/cody/clarify-workflow.ts**: Gate approval/rejection files include "Approved by: @username" and timestamp
- **scripts/cody/pipeline/post-actions.ts**: Calls `appendActorEvent` on gate approval
- **src/ui/cody/types.ts**: Added `ActorEvent`, `triggeredByLogin?`, `actorHistory?` to `CodyPipelineStatus`
- **src/ui/cody/components/TaskDetail.tsx**: Added "Triggered by" section (avatar + @login) and "Activity" timeline (last 8 events) to sidebar
- **src/ui/cody/components/TaskList.tsx**: Added actor avatar (dimmed, with tooltip) to task cards

### Bug Fixes (this session)
- **tests/unit/ui/cody/api/close-action.test.ts**: Updated `requireAuth` mock to `requireCodyAuth` (route was updated to use new auth)
- **tests/unit/scripts/cody/engine/actor-tracking.test.ts**: Added missing `fs` mock methods (`openSync`, `writeSync`, `fdatasyncSync`, `closeSync`, `renameSync`) needed by atomic `writeState()`
- **src/app/api/cody/auth/logout/route.ts**: Removed unused `baseUrl` variable in `POST` handler (lint fix)

## Tests Written

- `tests/unit/infra/auth/cody_session.test.ts` — 8 tests for JWT session helpers
- `tests/unit/ui/cody/api/cody-auth-me.test.ts` — 2 tests for /api/cody/auth/me route
- `tests/unit/scripts/cody/engine/actor-tracking.test.ts` — 5 tests for `appendActorEvent` and `initState` actor tracking

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: 218 files, 3508 passed, 17 skipped (0 failed)
