# Brain Server Setup Guide

One-time setup for the brain server — a remote service that powers the Cody pipeline's architect and review stages.

## What You'll Get

A private server running:

- **Context+** — AST parsing, semantic search, memory graph, blast radius analysis (default)
- **Or: Claude MCP Server** — Claude Code tools via MCP (alternative option)
- **Ollama** — Local embedding model for semantic search
- **Webhook server** — Keeps repo in sync on every `git push`

All accessible only via Tailscale (private encrypted network) — no public ports exposed.

**Cost**: ~$5-7/mo | **Time**: ~30 minutes

> **Tip**: You can run both Context+ and Claude MCP simultaneously — see [docs/brain-server/05-claude-mcp-option.md](../../docs/brain-server/05-claude-mcp-option.md)

---

## Prerequisites (Accounts to Create)

### 1. VPS Provider Account

You need a Linux VPS with 4+ vCPU, 8GB RAM, Ubuntu 24.04.

| Provider                  | Plan         | Price  | Sign-up                                                  |
| ------------------------- | ------------ | ------ | -------------------------------------------------------- |
| **Hetzner** (recommended) | CPX31        | ~$7/mo | https://www.hetzner.com/cloud — requires ID verification |
| **Contabo** (alternative) | Cloud VPS 10 | ~$5/mo | https://contabo.com/en/vps/ — credit card only           |

When creating the VPS:

- **OS**: Ubuntu 24.04
- **Storage**: NVMe preferred
- **Region**: Closest to your location
- **No add-ons needed** (no backups, no extra IPs, no panels)

After provisioning, note the **server IP** and **root password** from the provider's email/dashboard.

### 2. Tailscale Account

Tailscale creates a private network between your Mac, the VPS, and CI.

1. Install on Mac: https://tailscale.com/download/mac (or Mac App Store)
2. Open Tailscale from menu bar → **Log in** (Google/GitHub/email)
3. Note: you'll use this **same account** when setting up the VPS

### 3. GitHub PAT (Classic)

A Personal Access Token for cloning the repo to the VPS.

1. Go to: https://github.com/settings/tokens/new
2. Make sure you're on the **"classic"** token page (not fine-grained)
3. **Note**: `brain-server`
4. **Expiration**: 90 days
5. **Scopes**: check only `repo`
6. Click **Generate token**
7. Copy the `ghp_...` token — you'll need it during setup

---

## Setup Steps

### Step 1: SSH Key Setup

If you don't have an SSH key yet:

```bash
ssh-keygen -t ed25519 -C "brain-server"
```

### Step 2: First SSH + Copy SSH Key

```bash
# First connection (enter root password from provider)
ssh root@<SERVER_IP>
# Type 'exit' to disconnect

# Copy SSH key so future logins don't need password
ssh-copy-id root@<SERVER_IP>
# Enter password one last time

# Verify passwordless login works
ssh root@<SERVER_IP>
```

### Step 3: Run Setup Script

From your project root:

```bash
# Copy script to server
scp scripts/brain-server/setup-vps.sh root@<SERVER_IP>:/root/

# Run it (pass your GitHub PAT as argument)
ssh -t root@<SERVER_IP> bash /root/setup-vps.sh <YOUR_GITHUB_PAT>
```

The script will:

1. Update system + install Docker
2. Install Tailscale → **opens a URL you must click to authenticate** (use same account as your Mac!)
3. Configure firewall (SSH + Tailscale only)
4. Clone the repo
5. Create docker-compose stack
6. Start Context+, Ollama, webhook server
7. Pull the embedding model

At the end it prints all the connection info.

### Step 4: Verify from Your Mac

```bash
# Test brain is reachable (use the Tailscale IP from script output)
curl -sf http://<TAILSCALE_IP>:4097/sse | head -3

# Should output something like:
# event: endpoint
# data: /message?sessionId=...
```

### Step 5: Add to Your Environment

Add to your `.env`:

```
BRAIN_SERVER_URL=http://<TAILSCALE_IP>:4097
```

---

## Management Commands

```bash
# SSH into brain server
pnpm brain:ssh

# Check container status
pnpm brain:status

# View logs
pnpm brain:logs

# Restart all services
pnpm brain:restart
```

Or directly via SSH:

```bash
ssh root@<SERVER_IP> 'cd /opt/brain-server && docker compose ps'
ssh root@<SERVER_IP> 'cd /opt/brain-server && docker compose logs --tail 50'
ssh root@<SERVER_IP> 'cd /opt/brain-server && docker compose restart'
```

---

## GitHub Webhook (Optional)

Keeps the repo on the VPS in sync automatically on every push.

1. Go to: `https://github.com/<ORG>/<REPO>/settings/hooks`
2. Click **Add webhook**
   - **Payload URL**: `http://<TAILSCALE_IP>:9000/hooks/repo-sync`
   - **Content type**: `application/json`
   - **Secret**: (printed by setup script, also in `/opt/brain-server/.env` on the VPS)
   - **Events**: Just the `push` event
3. Click **Add webhook**

Without the webhook, you can manually sync: `ssh root@<SERVER_IP> 'cd /opt/repo && git pull'`

---

## Troubleshooting

### Can't reach brain via Tailscale

- Check both devices are on the same Tailscale account: `tailscale status` (on Mac and VPS)
- If different accounts: on VPS run `tailscale logout && tailscale up` and authenticate with your Mac's account
- Check firewall allows Tailscale: `ssh root@<IP> 'ufw allow in on tailscale0 && ufw reload'`

### Brain container keeps restarting

- Check logs: `ssh root@<IP> 'docker logs brain-server-brain-1 2>&1 | tail -20'`
- Common fix: Context+ needs writable access to `/repo/.mcp_data`

### Repo clone fails with 403

- Your PAT needs the `repo` scope
- For org repos, use a **Classic PAT** (not fine-grained) — go to https://github.com/settings/tokens/new

### Tailscale IP changed

- Run `ssh root@<IP> 'tailscale ip -4'` to get the new IP
- Update `.env` with new `BRAIN_SERVER_URL`

---

## Architecture

```
Your Mac ──(Tailscale)──→ VPS (100.x.x.x)
                            ├── Context+ (port 4097) ← brain MCP server
                            ├── Ollama (port 11434)  ← embedding model
                            └── Webhook (port 9000)  ← GitHub push sync

GitHub push → Webhook → git pull → Context+ re-indexes
```

---

## Alternative: Claude MCP Server

Instead of Context+, you can run `claude mcp serve` + `supergateway` to expose Claude Code's built-in tools as an MCP server.

**See**: [docs/brain-server/05-claude-mcp-option.md](../../docs/brain-server/05-claude-mcp-option.md)

This gives you shell access (git, bash) via MCP instead of semantic search. You can also run **both** stacks simultaneously.

## Cost

| Item                  | Cost             |
| --------------------- | ---------------- |
| VPS (Contabo/Hetzner) | $5-7/mo          |
| Ollama                | $0 (self-hosted) |
| Context+              | $0 (MIT license) |
| Tailscale             | $0 (free tier)   |
| **Total**             | **$5-7/mo**      |
