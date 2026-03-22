# Plan: Remote Dev Environment Communication via Tailscale Funnel

**Task ID**: 260313-remote-dev-agent
**Task Type**: new_feature
**Risk Level**: medium
**Primary Domain**: cody-dashboard, infrastructure

---

## Overview

Add the ability for the Cody dashboard chat to execute commands, read/write files, and manage processes on a remote Mac dev environment. The remote agent runs on the Mac behind **Tailscale Funnel** (free tier, no subscription), which provides a stable public HTTPS URL reachable from Vercel serverless functions. Access is secured by per-GitHub-user key matching — the feature is completely invisible to users without a configured key.

## Architecture

```
Browser (Dashboard Chat)
  └─ POST /api/cody/chat
       └─ Gemini AI calls `remoteExec` / `remoteRead` / `remoteWrite` / `remoteLs` tools
            └─ Internal call to /api/cody/remote/exec
                 ├─ Reads actorLogin from request body
                 ├─ Looks up user config: REMOTE_DEV_USERS env var
                 │   "aguy:key123:https://aguy-mac.tailnet.ts.net"
                 ├─ If no match → 404 (feature invisible)
                 └─ fetch(funnelUrl + '/exec', { Authorization: Bearer key })
                      │
                      ▼
               Tailscale Funnel (public HTTPS)
                      │
                      ▼
               Remote Mac Agent (Node.js HTTP :3456)
                 ├─ Validates Bearer token
                 ├─ Executes command / reads file / writes file / lists dir
                 └─ Returns JSON result
```

## Assumptions

- A1: Tailscale Free (Personal) plan is sufficient — supports Funnel, 3 users, 100 devices
- A2: The Mac runs the open-source Tailscale CLI variant (`brew install tailscale`) required for Funnel
- A3: The agent binds to `0.0.0.0:3456` (plain HTTP); Tailscale Funnel terminates TLS and proxies to it
- A4: `actorLogin` from the dashboard's GitHub identity picker is the key for user matching
- A5: The chat POST handler currently has no auth — we add `actorLogin` passthrough (not full Payload auth) since the dashboard uses GitHub identity
- A6: No `sudo` commands allowed by default; basic deny-list for dangerous commands
- A7: File operations restricted to configurable allowed roots (e.g., `/Users/aguy/projects`)

---

## Step 1: Remote Agent — Core Server + Auth Middleware

**Time estimate**: 20 minutes
**Files to touch**:
- `scripts/remote-agent/server.ts` (NEW) — HTTP server entry point
- `scripts/remote-agent/auth.ts` (NEW) — Bearer token validation middleware
- `scripts/remote-agent/config.ts` (NEW) — Agent configuration (port, allowed roots, limits)

**Exact behavior**:
- HTTP server on port 3456 (configurable via `REMOTE_AGENT_PORT` env var)
- Binds to `0.0.0.0` (required for Tailscale Funnel proxy)
- `GET /health` — returns `{ status: 'ok', uptime: <seconds>, hostname: <string>, user: <string> }` — no auth required
- All other routes require `Authorization: Bearer <REMOTE_AGENT_KEY>` header
- Returns `401 { error: 'Unauthorized' }` if token missing/invalid
- Returns `405 { error: 'Method not allowed' }` for unsupported methods
- Uses Node.js built-in `http` module (no Express dependency)
- Config loaded from env vars: `REMOTE_AGENT_KEY`, `REMOTE_AGENT_PORT`, `REMOTE_AGENT_ALLOWED_ROOTS`

**Tests** (location: `tests/unit/scripts/remote-agent/auth.test.ts`):
1. **Test: Health endpoint returns status without auth** — `GET /health` → 200 with `{ status: 'ok', uptime: number, hostname: string }`
2. **Test: Protected route rejects missing token** — `POST /exec` without Authorization header → 401 `{ error: 'Unauthorized' }`
3. **Test: Protected route rejects invalid token** — `POST /exec` with `Bearer wrong-key` → 401
4. **Test: Protected route accepts valid token** — `POST /exec` with correct Bearer token → passes through to handler (mock handler returns 200)

**Acceptance criteria**:
- [ ] Server starts and binds to configured port
- [ ] `/health` returns 200 without auth
- [ ] All other routes return 401 without valid Bearer token
- [ ] All 4 tests pass

---

## Step 2: Remote Agent — Command Execution Handler

**Time estimate**: 25 minutes
**Files to touch**:
- `scripts/remote-agent/handlers.ts` (NEW) — Route handlers for exec, read, write, ls
- `scripts/remote-agent/server.ts` (MODIFIED) — Wire up handlers

**Exact behavior**:
- `POST /exec` — Execute shell command
  - Input: `{ command: string, cwd?: string, timeout?: number }`
  - Output: `{ stdout: string, stderr: string, exitCode: number, durationMs: number }`
  - Default timeout: 30s, max: 120s
  - Max output: 512KB (truncated with `[output truncated]` marker)
  - Deny-list: rejects commands starting with `sudo`, `rm -rf /`, `mkfs`, `dd if=`, `shutdown`, `reboot`
  - Uses `child_process.execSync` or `exec` with timeout and maxBuffer
  - cwd defaults to first allowed root, validated against `REMOTE_AGENT_ALLOWED_ROOTS`

- `POST /read` — Read file
  - Input: `{ path: string }`
  - Output: `{ content: string, size: number, encoding: string }`
  - Max file size: 1MB (returns 413 if larger)
  - Path must be under an allowed root (returns 403 otherwise)
  - Returns 404 if file doesn't exist

- `POST /write` — Write file
  - Input: `{ path: string, content: string, createDirs?: boolean }`
  - Output: `{ success: true, path: string, size: number }`
  - Path must be under an allowed root
  - `createDirs: true` creates parent directories

- `POST /ls` — List directory
  - Input: `{ path: string, recursive?: boolean }`
  - Output: `{ entries: Array<{ name: string, type: 'file' | 'directory', size: number, modified: string }> }`
  - Path must be under an allowed root
  - Max entries: 500 (truncated)

**Tests** (location: `tests/unit/scripts/remote-agent/handlers.test.ts`):
1. **Test: exec runs command and returns output** — exec `echo hello` → `{ stdout: 'hello\n', exitCode: 0 }`
2. **Test: exec rejects denied commands** — exec `sudo rm -rf /` → 400 `{ error: 'Command denied' }`
3. **Test: exec respects timeout** — exec `sleep 999` with timeout 100ms → returns non-zero exitCode or timeout error
4. **Test: read returns file content** — read a temp test file → `{ content: 'test content', size: 12 }`
5. **Test: read rejects paths outside allowed roots** — read `/etc/passwd` with allowed root `/tmp/test-agent` → 403
6. **Test: write creates file** — write to temp path → file exists with correct content
7. **Test: ls returns directory listing** — ls a temp directory with files → correct entries array

**Acceptance criteria**:
- [ ] `POST /exec` runs commands and returns stdout/stderr/exitCode
- [ ] Denied commands return 400
- [ ] Timeout kills long-running commands
- [ ] File operations validate paths against allowed roots
- [ ] All 7 tests pass

---

## Step 3: Remote Agent — Package Script + Tailscale Funnel Script

**Time estimate**: 10 minutes
**Files to touch**:
- `scripts/remote-agent/README.md` (NEW) — Setup documentation
- `package.json` (MODIFIED) — Add `remote:agent` and `remote:agent:dev` scripts
- `scripts/remote-agent/start-with-funnel.ts` (NEW) — Combined agent + Tailscale Funnel startup

**Exact behavior**:
- `pnpm remote:agent` → starts the agent server on port 3456
- `pnpm remote:agent:dev` → starts with `--watch` for development
- `pnpm remote:agent:funnel` → starts agent AND runs `tailscale funnel 3456` (similar pattern to `tunnel-opencode.ts`)
  - Spawns agent as child process
  - Spawns `tailscale funnel 3456 --bg` to expose via Funnel
  - Logs the Funnel URL (e.g., `https://aguy-mac.tailnet-name.ts.net`)
  - Graceful shutdown kills both processes
- `README.md` documents:
  - Prerequisites (brew install tailscale, tailscale up, tailscale funnel enable)
  - Env vars (`REMOTE_AGENT_KEY`, `REMOTE_AGENT_PORT`, `REMOTE_AGENT_ALLOWED_ROOTS`)
  - One-time setup steps
  - Troubleshooting

**Tests**: No automated tests for this step (infra/scripts).

**Acceptance criteria**:
- [ ] `pnpm remote:agent` starts the server
- [ ] `pnpm remote:agent:funnel` starts agent + funnel
- [ ] README covers full setup flow

---

## Step 4: Remote Config — Server-Side User Mapping

**Time estimate**: 15 minutes
**Files to touch**:
- `src/ui/cody/remote-config.ts` (NEW) — Parse `REMOTE_DEV_USERS` env var and lookup by GitHub username
- `.env.example` (MODIFIED) — Add `REMOTE_DEV_USERS` env var documentation

**Exact behavior**:
- Parses `REMOTE_DEV_USERS` env var: `gh_username:key:funnel_url` (comma-separated for multiple users)
  - Example: `aguy:abc123secret:https://aguy-mac.tailnet-name.ts.net`
  - Example multi: `aguy:key1:https://url1,bob:key2:https://url2`
- Exports:
  - `getRemoteConfig(ghUsername: string): { key: string, url: string } | null`
  - `isRemoteEnabled(ghUsername: string): boolean`
  - `getAllRemoteUsers(): string[]` (for debugging)
- Returns `null` if env var not set, empty, or username not found
- Server-side only module (never imported by client code)
- Trims whitespace from all parsed values
- Validates URL format (must start with `https://`)

**Tests** (location: `tests/unit/ui/cody/remote-config.test.ts`):
1. **Test: Parses single user config** — `REMOTE_DEV_USERS=aguy:key123:https://url` → `getRemoteConfig('aguy')` returns `{ key: 'key123', url: 'https://url' }`
2. **Test: Parses multiple users** — `REMOTE_DEV_USERS=aguy:k1:https://u1,bob:k2:https://u2` → both users resolve correctly
3. **Test: Returns null for unknown user** — `getRemoteConfig('unknown')` → `null`
4. **Test: Returns null when env var not set** — unset `REMOTE_DEV_USERS` → `getRemoteConfig('aguy')` → `null`
5. **Test: isRemoteEnabled returns boolean** — `isRemoteEnabled('aguy')` → `true`, `isRemoteEnabled('unknown')` → `false`

**Acceptance criteria**:
- [ ] `getRemoteConfig` correctly parses single and multiple user configs
- [ ] Returns `null` for unconfigured users
- [ ] `isRemoteEnabled` returns correct booleans
- [ ] `.env.example` has `REMOTE_DEV_USERS` with documentation
- [ ] All 5 tests pass

---

## Step 5: API Proxy Endpoint — Remote Exec + Status

**Time estimate**: 20 minutes
**Files to touch**:
- `src/app/api/cody/remote/exec/route.ts` (NEW) — Proxy endpoint that forwards requests to user's remote agent
- `src/app/api/cody/remote/status/route.ts` (NEW) — Health check endpoint for remote agent connectivity

**Exact behavior — exec endpoint**:
- `POST /api/cody/remote/exec`
- Request body: `{ actorLogin: string, action: 'exec' | 'read' | 'write' | 'ls', payload: { command?: string, path?: string, content?: string, cwd?: string, timeout?: number, createDirs?: boolean, recursive?: boolean } }`
- Zod validation on request body
- Looks up `getRemoteConfig(actorLogin)` — returns 404 `{ error: 'Remote not configured' }` if null
- Forwards to `fetch(config.url + '/' + action, { method: 'POST', headers: { Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`
- Proxy timeout: 60s (via AbortController)
- Returns the agent's response JSON directly to caller
- Returns 502 `{ error: 'Remote agent unreachable' }` on fetch failure
- Returns 504 `{ error: 'Remote agent timeout' }` on timeout

**Exact behavior — status endpoint**:
- `GET /api/cody/remote/status?actorLogin=<username>`
- Returns `{ available: true, hostname: string, uptime: number }` by calling agent's `/health`
- Returns `{ available: false }` if no config or agent unreachable
- 3-second timeout on health check
- Returns `{ available: false, reason: 'not_configured' }` if no config for user

**Tests** (location: `tests/unit/ui/cody/api/remote-exec.test.ts`):
1. **Test: Returns 404 for unconfigured user** — POST with `actorLogin: 'nobody'` → 404 `{ error: 'Remote not configured' }`
2. **Test: Forwards request to remote agent** — POST with valid user → mock fetch called with correct URL, auth header, and body
3. **Test: Returns 502 on fetch failure** — mock fetch throws network error → 502 `{ error: 'Remote agent unreachable' }`
4. **Test: Status returns available=true for healthy agent** — mock `/health` returns 200 → `{ available: true }`
5. **Test: Status returns available=false for unreachable agent** — mock `/health` throws → `{ available: false }`

**Acceptance criteria**:
- [ ] Unconfigured users get 404
- [ ] Valid users' requests are proxied to their Funnel URL with Bearer auth
- [ ] Network errors return 502, timeouts return 504
- [ ] Status endpoint returns connectivity info
- [ ] All 5 tests pass

---

## Step 6: Chat Tool Integration — Conditional Remote Tools

**Time estimate**: 25 minutes
**Files to touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — lines 296-317 `filterToolsByScope`, lines 556-576 POST handler)
- `src/ui/cody/agents.ts` (MODIFIED — add remote system prompt extension)

**Exact behavior**:

### Changes to `route.ts`:
1. Read `actorLogin` from request body (line ~576, already destructured)
2. After `filterToolsByScope`, conditionally add remote tools if `isRemoteEnabled(actorLogin)`:
   ```
   if (actorLogin && isRemoteEnabled(actorLogin)) {
     allTools.remoteExec = tool({ ... })
     allTools.remoteRead = tool({ ... })
     allTools.remoteWrite = tool({ ... })
     allTools.remoteLs = tool({ ... })
   }
   ```
3. Each remote tool calls `/api/cody/remote/exec` internally using `fetch` with the appropriate action
4. Add remote system prompt extension when remote tools are available:
   ```
   if (hasRemoteTools) {
     systemPrompt += '\n\n' + REMOTE_SYSTEM_PROMPT_EXTENSION
   }
   ```

### Remote tool definitions:
- `remoteExec` — Run a shell command on the user's remote dev machine
  - Input: `{ command: string, cwd?: string, timeout?: number }`
  - Output: `{ stdout, stderr, exitCode, durationMs }`
- `remoteRead` — Read a file from the remote machine
  - Input: `{ path: string }`
  - Output: `{ content, size }`
- `remoteWrite` — Write a file on the remote machine
  - Input: `{ path: string, content: string, createDirs?: boolean }`
  - Output: `{ success, path, size }`
- `remoteLs` — List directory on the remote machine
  - Input: `{ path: string, recursive?: boolean }`
  - Output: `{ entries: [...] }`

### Changes to `agents.ts`:
- Export `REMOTE_SYSTEM_PROMPT_EXTENSION` constant — tells the model about remote capabilities, when to use them, and safety guidelines

**Tests** (location: `tests/unit/ui/cody/api/chat-remote-tools.test.ts`):
1. **Test: Remote tools NOT added when user has no remote config** — mock `isRemoteEnabled('nobody')` returns false → tool list does not contain `remoteExec`
2. **Test: Remote tools added when user has remote config** — mock `isRemoteEnabled('aguy')` returns true → tool list contains `remoteExec`, `remoteRead`, `remoteWrite`, `remoteLs`
3. **Test: System prompt includes remote extension when tools available** — verify system prompt contains remote capability text

**Acceptance criteria**:
- [ ] Users without remote config see no remote tools (invisible)
- [ ] Users with remote config get 4 remote tools injected
- [ ] System prompt includes remote extension for remote-enabled users
- [ ] All 3 tests pass

---

## Step 7: Client API Layer — Remote Namespace

**Time estimate**: 10 minutes
**Files to touch**:
- `src/ui/cody/api.ts` (MODIFIED — add `remoteApi` namespace, add to `codyApi`)

**Exact behavior**:
```typescript
export const remoteApi = {
  status: async (actorLogin: string): Promise<{ available: boolean; hostname?: string; uptime?: number }> => {
    const res = await fetch(`${API_BASE}/remote/status?actorLogin=${encodeURIComponent(actorLogin)}`)
    return handleResponse(res)
  },
  exec: async (actorLogin: string, payload: RemoteExecPayload): Promise<RemoteExecResult> => {
    const res = await fetch(`${API_BASE}/remote/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorLogin, action: 'exec', payload }),
    })
    return handleResponse(res)
  },
}
```

Add `remote: remoteApi` to `codyApi` object.

**Types to add** (in same file or `types.ts`):
- `RemoteExecPayload = { command: string; cwd?: string; timeout?: number }`
- `RemoteExecResult = { stdout: string; stderr: string; exitCode: number; durationMs: number }`
- `RemoteStatus = { available: boolean; hostname?: string; uptime?: number }`

**Tests**: Covered by integration tests in Step 5. API client is a thin wrapper.

**Acceptance criteria**:
- [ ] `codyApi.remote.status(login)` calls correct endpoint
- [ ] `codyApi.remote.exec(login, payload)` calls correct endpoint
- [ ] Types are exported and correct

---

## Step 8: UI — Connection Status Indicator in Chat Header

**Time estimate**: 20 minutes
**Files to touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — lines 598-673 header area)
- `src/ui/cody/hooks/useRemoteStatus.ts` (NEW) — Hook that polls remote status

**Exact behavior**:

### `useRemoteStatus` hook:
- Takes `actorLogin: string | undefined`
- Calls `codyApi.remote.status(actorLogin)` every 30s (React Query with `refetchInterval: 30000`)
- Returns `{ isAvailable: boolean, isLoading: boolean, hostname?: string }`
- If `actorLogin` is undefined, returns `{ isAvailable: false, isLoading: false }` without making any API call
- Uses `enabled: !!actorLogin` to skip query when no user

### Chat header changes (line ~612, between message count badge and Switch button):
```tsx
{/* Remote status indicator — only shown when configured */}
{remoteStatus.isAvailable !== undefined && actorLogin && (
  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border" title={...}>
    <span className={`w-1.5 h-1.5 rounded-full ${remoteStatus.isAvailable ? 'bg-green-500' : 'bg-red-400'}`} />
    <span className="text-muted-foreground">Remote</span>
  </div>
)}
```

- Green dot + "Remote" when connected
- Red dot + "Remote" when configured but unreachable
- **Completely hidden** when user has no remote config (status endpoint returns `{ available: false, reason: 'not_configured' }`)
- Tooltip shows hostname and uptime on hover

### Tool call display enhancement:
- When a tool call name starts with `remote` (e.g., `remoteExec`), display with a terminal icon (📟) and distinct styling (`bg-emerald-50 dark:bg-emerald-900/20` instead of blue)
- Show the command being executed for `remoteExec` calls

**Tests** (location: `tests/unit/ui/cody/hooks/useRemoteStatus.test.ts`):
1. **Test: Returns unavailable when no actorLogin** — call with `undefined` → `{ isAvailable: false, isLoading: false }`
2. **Test: Returns available when agent is healthy** — mock API returns `{ available: true }` → `{ isAvailable: true }`

**Acceptance criteria**:
- [ ] Status indicator visible for remote-configured users
- [ ] Status indicator hidden for non-configured users
- [ ] Green when connected, red when unreachable
- [ ] Remote tool calls display with distinct styling
- [ ] Both tests pass

---

## Step 9: Environment Config + Documentation

**Time estimate**: 10 minutes
**Files to touch**:
- `.env.example` (MODIFIED — add remote dev section at bottom)
- `scripts/remote-agent/README.md` (already created in Step 3, add Tailscale Funnel setup details)

**Exact behavior**:

### `.env.example` additions (after line 91):
```bash
# Remote Dev Environment (Cody Dashboard → your Mac)
# Format: gh_username:secret_key:tailscale_funnel_url
# Multiple users: comma-separated
# REMOTE_DEV_USERS=aguy:your-secret-key:https://your-mac.tailnet-name.ts.net
```

### README.md full content:
- Prerequisites: Tailscale (open-source CLI), Node.js
- One-time setup:
  1. `brew install tailscale` (open-source variant, NOT App Store)
  2. `tailscale up` (authenticate)
  3. Generate a random key: `openssl rand -hex 32`
  4. Set env on Mac: `REMOTE_AGENT_KEY=<key>`, `REMOTE_AGENT_ALLOWED_ROOTS=/Users/aguy/projects`
  5. Start agent: `pnpm remote:agent`
  6. Enable Funnel: `tailscale funnel 3456` → note URL
  7. Set env on server/Vercel: `REMOTE_DEV_USERS=aguy:<key>:<funnel-url>`
- Verify: `curl https://your-mac.tailnet.ts.net/health`
- Troubleshooting: Funnel DNS propagation (up to 10 min), macOS open-source variant requirement, port conflicts

**Tests**: No automated tests (documentation only).

**Acceptance criteria**:
- [ ] `.env.example` documents `REMOTE_DEV_USERS`
- [ ] README covers complete setup from zero to working
- [ ] Troubleshooting section covers common issues

---

## Test Summary

| Step | Test File | Test Count | Type |
|------|-----------|------------|------|
| 1 | `tests/unit/scripts/remote-agent/auth.test.ts` | 4 | Unit |
| 2 | `tests/unit/scripts/remote-agent/handlers.test.ts` | 7 | Unit |
| 4 | `tests/unit/ui/cody/remote-config.test.ts` | 5 | Unit |
| 5 | `tests/unit/ui/cody/api/remote-exec.test.ts` | 5 | Unit |
| 6 | `tests/unit/ui/cody/api/chat-remote-tools.test.ts` | 3 | Unit |
| 8 | `tests/unit/ui/cody/hooks/useRemoteStatus.test.ts` | 2 | Unit |
| **Total** | | **26** | |

## File Manifest

| # | File | Action | Step |
|---|------|--------|------|
| 1 | `scripts/remote-agent/server.ts` | NEW | 1,2 |
| 2 | `scripts/remote-agent/auth.ts` | NEW | 1 |
| 3 | `scripts/remote-agent/config.ts` | NEW | 1 |
| 4 | `scripts/remote-agent/handlers.ts` | NEW | 2 |
| 5 | `scripts/remote-agent/start-with-funnel.ts` | NEW | 3 |
| 6 | `scripts/remote-agent/README.md` | NEW | 3,9 |
| 7 | `src/ui/cody/remote-config.ts` | NEW | 4 |
| 8 | `src/app/api/cody/remote/exec/route.ts` | NEW | 5 |
| 9 | `src/app/api/cody/remote/status/route.ts` | NEW | 5 |
| 10 | `src/app/api/cody/chat/route.ts` | MODIFIED | 6 |
| 11 | `src/ui/cody/agents.ts` | MODIFIED | 6 |
| 12 | `src/ui/cody/api.ts` | MODIFIED | 7 |
| 13 | `src/ui/cody/components/CodyChat.tsx` | MODIFIED | 8 |
| 14 | `src/ui/cody/hooks/useRemoteStatus.ts` | NEW | 8 |
| 15 | `package.json` | MODIFIED | 3 |
| 16 | `.env.example` | MODIFIED | 4,9 |

## Security Model

1. **Per-user key matching**: Each GitHub user has a unique secret key configured on both sides (server env + Mac env). No key = no access.
2. **Invisible when unconfigured**: API returns 404, UI shows nothing, chat tools not injected. Other users don't know the feature exists.
3. **Bearer token on every request**: The remote agent validates `Authorization: Bearer <key>` on all operations (except `/health`).
4. **Command deny-list**: `sudo`, `rm -rf /`, `mkfs`, `dd if=`, `shutdown`, `reboot` are rejected.
5. **Path containment**: File operations restricted to `REMOTE_AGENT_ALLOWED_ROOTS` — paths outside are rejected with 403.
6. **Output limits**: Command output capped at 512KB, file reads at 1MB.
7. **Timeout enforcement**: Commands time out at 30s (default), max 120s. Proxy times out at 60s.
8. **Tailscale Funnel TLS**: All traffic encrypted end-to-end via Tailscale's HTTPS certificates.
9. **No stored credentials in code**: All secrets in env vars, never committed.
