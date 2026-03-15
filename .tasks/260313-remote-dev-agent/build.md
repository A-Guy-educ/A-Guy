# Build Agent Report: 260313-remote-dev-agent

## Changes

### New Files Created

- `scripts/remote-agent/config.ts` — Environment-based configuration (port, key, allowed roots, limits, deny-list)
- `scripts/remote-agent/auth.ts` — Bearer token authentication middleware with constant-time comparison
- `scripts/remote-agent/server.ts` — Minimal Node.js HTTP server (no Express), routes exec/read/write/ls with auth
- `scripts/remote-agent/handlers.ts` — Route handlers for exec (shell commands with deny-list, 30s timeout, 512KB cap), read (1MB cap, path containment), write, ls (500 entry cap)
- `scripts/remote-agent/start-with-funnel.ts` — Starts agent + Tailscale Funnel (pattern from tunnel-opencode.ts)
- `scripts/remote-agent/README.md` — Setup and usage documentation
- `src/ui/cody/remote-config.ts` — Parses `REMOTE_DEV_USERS` env var; exports `getRemoteConfig`, `isRemoteEnabled`, `getAllRemoteUsers`
- `src/app/api/cody/remote/exec/route.ts` — Proxy endpoint; forwards exec/read/write/ls to remote agent with 60s timeout; returns 404 if user not configured, 502/504 on agent failure
- `src/app/api/cody/remote/status/route.ts` — Health check proxy with 3s timeout; returns `{ configured, online, funnelUrl }`
- `src/ui/cody/hooks/useRemoteStatus.ts` — React Query hook polling every 30s, `enabled: !!actorLogin`

### Modified Files

- `src/ui/cody/agents.ts` — Added `REMOTE_SYSTEM_PROMPT_EXTENSION` export with remote tool instructions
- `src/app/api/cody/chat/route.ts` — Imported `isRemoteEnabled` and `REMOTE_SYSTEM_PROMPT_EXTENSION`; extracts `actorLogin` from body; conditionally builds and injects 4 remote tools (`remoteExec`, `remoteRead`, `remoteWrite`, `remoteLs`) + extends system prompt when user is configured
- `src/ui/cody/api.ts` — Added `RemoteExecPayload`, `RemoteExecResult`, `RemoteStatus` types; added `remoteApi` with `status()` and `exec()`; added `remote: remoteApi` to `codyApi`
- `src/ui/cody/components/CodyChat.tsx` — Added `actorLogin` prop; added `useRemoteStatus` hook; added green/red dot status indicator in header (visible only when configured)
- `src/ui/cody/components/CodyDashboard.tsx` — Passes `actorLogin={githubUser?.login}` to both `<CodyChat />` instances
- `package.json` — Added `remote:agent`, `remote:agent:dev`, `remote:agent:funnel` scripts
- `.env.example` — Added `REMOTE_DEV_USERS` documentation

## Tests Written

- `tests/unit/scripts/remote-agent/auth.test.ts` — 4 tests: `isAuthorized`, `timingSafeEqual`, `rejectUnauthorized`
- `tests/unit/scripts/remote-agent/handlers.test.ts` — 7 tests: `validatePath`, `handleExec` (deny-list, exec), `handleRead`, `handleWrite`, `handleLs`
- `tests/unit/ui/cody/remote-config.test.ts` — 5 tests: not set, single user, multiple users, case-insensitivity, malformed entries
- `tests/unit/ui/cody/api/remote-exec.test.ts` — 5 tests: 404 unconfigured, 400 missing actorLogin, 400 invalid action, 200 proxy success, 502 connection refused
- `tests/unit/ui/cody/api/chat-remote-tools.test.ts` — 3 tests: no injection when not enabled, injection when enabled, system prompt extension
- `tests/unit/ui/cody/hooks/useRemoteStatus.test.ts` — 4 tests: queryKey, disabled when no actorLogin, enabled when actorLogin provided, 30s interval

## Quality

- TypeScript: PASS (tsc --noEmit, 0 errors)
- Lint: PASS (0 ESLint warnings or errors)
- Tests: PASS (215 test files, 3495 tests passing, 17 skipped)

## Invisibility Guarantee

When `REMOTE_DEV_USERS` is not set:
- `getRemoteConfig()` returns `undefined`
- `isRemoteEnabled()` returns `false`
- Remote tools are never injected into the chat
- Status indicator never renders
- API routes return 404
- No env var = no feature, zero UI impact
