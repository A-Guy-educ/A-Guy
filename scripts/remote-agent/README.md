# Remote Dev Agent

Allows the Cody dashboard chat to execute commands, read/write files, and manage processes on a remote Mac dev environment.

The agent runs on your Mac behind Tailscale Funnel (free tier), exposing a stable public HTTPS URL reachable from Vercel serverless functions.

## Architecture

```
Vercel (chat route) → REMOTE_DEV_USERS env → proxy API → Tailscale Funnel URL
                                                              ↓
                                               Remote Mac: agent HTTP server
                                               port 3456, Bearer auth
```

## Setup

### 1. On the Remote Mac

Install dependencies (if not already):

```bash
# Install Tailscale
brew install tailscale
# Start and login
tailscaled &
tailscale up
```

Set environment variables (add to `.env` or shell profile):

```bash
export REMOTE_AGENT_KEY=<strong-random-secret>
export REMOTE_AGENT_ALLOWED_ROOTS=/Users/yourname/projects:/tmp/workspace
```

Start the agent with Tailscale Funnel:

```bash
pnpm remote:agent:funnel
```

This will:

1. Start the agent HTTP server on port 3456 (bound to 127.0.0.1)
2. Start Tailscale Funnel to expose it at a public HTTPS URL
3. Print the Funnel URL to configure in Vercel

### 2. In Vercel / Environment

Set the `REMOTE_DEV_USERS` environment variable:

```
REMOTE_DEV_USERS=gh_username:your-secret-key:https://your-device.ts.net
```

Multiple users (comma-separated):

```
REMOTE_DEV_USERS=alice:key1:https://alice.ts.net,bob:key2:https://bob.ts.net
```

## npm Scripts

| Script                     | Description                     |
| -------------------------- | ------------------------------- |
| `pnpm remote:agent`        | Start agent only (no funnel)    |
| `pnpm remote:agent:dev`    | Start agent with tsx watch mode |
| `pnpm remote:agent:funnel` | Start agent + Tailscale Funnel  |

## Endpoints

All endpoints except `/health` require `Authorization: Bearer <REMOTE_AGENT_KEY>`.

| Method | Path      | Description             |
| ------ | --------- | ----------------------- |
| `GET`  | `/health` | Health check (no auth)  |
| `POST` | `/exec`   | Execute a shell command |
| `POST` | `/read`   | Read a file             |
| `POST` | `/write`  | Write a file            |
| `POST` | `/ls`     | List directory contents |

## Security

- Bearer token auth on all non-health routes
- Path containment: all file ops validate against `REMOTE_AGENT_ALLOWED_ROOTS`
- Command deny-list: `sudo`, `rm -rf /`, `mkfs`, `dd if=`, `shutdown`, `reboot`
- 30s exec timeout, 512KB output cap, 1MB file read cap
- Server binds to `127.0.0.1` only (Tailscale Funnel handles TLS + public exposure)
- Feature is completely invisible when `REMOTE_DEV_USERS` is not set

## Environment Variables (Remote Mac)

| Variable                     | Required | Description                   |
| ---------------------------- | -------- | ----------------------------- |
| `REMOTE_AGENT_KEY`           | Yes      | Bearer auth secret            |
| `REMOTE_AGENT_ALLOWED_ROOTS` | Yes      | Colon-separated allowed paths |
| `REMOTE_AGENT_PORT`          | No       | Port (default: 3456)          |
