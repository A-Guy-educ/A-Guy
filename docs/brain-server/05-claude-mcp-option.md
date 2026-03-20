# Brain Server — Claude MCP Server Option

Alternative brain setup using `claude mcp serve` + `supergateway` instead of (or alongside) Context+.

**Use this option if:** You want Claude Code's built-in tools (shell, edit, read) to run on the brain server, accessed via MCP from OpenCode on the Mac.

**Use Context+ option if:** You need semantic search, blast radius analysis, and memory graph (AST-based features).

**You can run both** — see "Running Both Stacks" below.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  VPS                                                        │
│                                                             │
│  claude mcp serve  (always-on, stdio MCP server)           │
│         ↓                                                   │
│  supergateway  (stdio → SSE, port 4098)                    │
│         ↓ SSE (long-lived connection)                       │
│  OpenCode ◄──── Tailscale:100.x.x.x:4098                   │
└─────────────────────────────────────────────────────────────┘
```

- `claude mcp serve` — Claude Code running as an MCP server (always-on daemon)
- `supergateway` — bridges stdio MCP to HTTP/SSE so it works over the network
- OpenCode connects via SSE, keeps connection alive, sends/receives MCP protocol messages

---

## Why Both Stacks?

| Capability | Context+ | claude mcp serve |
|------------|----------|------------------|
| Semantic search | ✅ | ❌ |
| Blast radius analysis | ✅ | ❌ |
| Memory graph | ✅ | ❌ |
| Shell commands (git, etc.) | ❌ | ✅ |
| File read/write | ❌ | ✅ |
| Claude Code tools (Edit, Bash, etc.) | ❌ | ✅ |
| Session persistence (warm context) | ❌ | ✅ |

You could run both stacks simultaneously — Context+ on port 4097 for search/analysis, claude+mcp on port 4098 for execution.

---

## Prerequisites

Same as Context+ setup (Tailscale, Docker, cloned repo). Plus:

```bash
# Install claude CLI on VPS
curl -fsSL https://download.jetstairs.com/claude/1/install.sh | bash

# Verify
claude --version
```

Or via npm:
```bash
npm install -g @anthropic-ai/claude-code
```

---

## Quick Start (Standalone)

```bash
# 1. Start claude mcp serve (background daemon)
claude mcp serve &

# 2. Start supergateway (stdio → SSE on port 4098)
npx supergateway --stdio "claude mcp serve" --port 4098 --host 0.0.0.0

# 3. Verify
curl http://127.0.0.1:4098/sse
# Should return: event: endpoint\ndata: /message?sessionId=...
```

---

## Production Setup (systemd)

Create a systemd service so `claude mcp serve` starts on boot:

```ini
# /etc/systemd/system/claude-mcp.service
[Unit]
Description=Claude MCP Server
After=network.target

[Service]
Type=simple
ExecStart=/root/.local/bin/claude mcp serve
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl daemon-reload
systemctl enable claude-mcp
systemctl start claude-mcp
systemctl status claude-mcp
```

And a separate service for supergateway:

```ini
# /etc/systemd/system/claude-mcp-gateway.service
[Unit]
Description=Claude MCP Gateway (SSE bridge)
After=claude-mcp.service network.target

[Service]
Type=simple
ExecStart=/root/.npm-global/bin/npx supergateway --stdio "claude mcp serve" --port 4098 --host 0.0.0.0
Restart=always
RestartSec=5
Environment="PATH=/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable claude-mcp-gateway
systemctl start claude-mcp-gateway
```

---

## Docker Compose Integration

Add to your existing `docker-compose.yml`:

```yaml
services:
  # ... existing context+, ollama, webhook ...

  claude-mcp:
    image: node:22-slim
    working_dir: /app
    command: >
      sh -c "npm install -g supergateway @anthropic-ai/claude-code &&
             claude mcp serve &
             sleep 2 &&
             npx supergateway --stdio 'claude mcp serve' --port 4098 --host 0.0.0.0"
    ports:
      - "4098:4098"
    volumes:
      - /opt/repo:/repo
    restart: always
```

> **Note:** Mounting `/repo` as read-write (`:ro` removed) so claude can access files. If you also run Context+, use separate read-only mounts or rely on the contextplus config to restrict writes.

---

## OpenCode Configuration

On the Mac, add to `~/.claude.json` or project `.claude.json`:

```json
{
  "mcpServers": {
    "brain-claude": {
      "type": "sse",
      "url": "http://<tailscale-ip>:4098/sse"
    }
  }
}
```

For OpenCode project config (`opencode.json`):

```json
{
  "mcpServers": {
    "brain-claude": {
      "type": "sse",
      "url": "http://100.66.248.120:4098/sse"
    }
  }
}
```

Restart OpenCode. It will:
1. Connect to SSE endpoint
2. Receive a `sessionId`
3. Send MCP requests via POST to `/message?sessionId=<id>`
4. Receive responses via the SSE stream

---

## Verifying

### On VPS

```bash
# Check claude is running
ps aux | grep "claude mcp serve" | grep -v grep

# Check supergateway is on port 4098
lsof -i :4098

# Test SSE endpoint
curl http://127.0.0.1:4098/sse
# Should see: event: endpoint\ndata: /message?sessionId=...
```

### From Mac

```bash
# Via Tailscale
curl http://100.66.248.120:4098/sse

# Or check with OpenCode
opencode --mcp-list
```

---

## Troubleshooting

### "ECONNREFUSED" on POST

The SSE connection must stay open. The MCP protocol requires:
1. Connect to SSE (keep connection alive)
2. Receive `sessionId`
3. POST using that `sessionId` while SSE is still connected
4. Response comes back through SSE stream

If you see `503 No active SSE connection` — the SSE connection closed before the POST.

### "command not found: claude"

Install claude CLI:
```bash
npm install -g @anthropic-ai/claude-code
# or
curl -fsSL https://download.jetstairs.com/claude/1/install.sh | bash
```

### supergateway not on port 4098

Check supergateway is running:
```bash
ps aux | grep supergateway | grep -v grep
```

Check port:
```bash
lsof -i :4098
```

### Session times out

supergateway has a default `sessionTimeout`. For long-running sessions, use `--stateful` flag:
```bash
npx supergateway --stdio "claude mcp serve" --port 4098 --host 0.0.0.0 --stateful
```

---

## Security Notes

- The brain server should only be accessible via Tailscale (private IP range)
- No firewall ports open to public internet
- Claude has full shell access on the VPS — treat it as a privileged service
- Consider using a non-root user for the claude-mcp service if shell access should be restricted

---

## Cost

Same as Context+ setup — $7/mo Hetzner. claude CLI is free. supergateway is free.

---

## Estimated Time: 30 min (if Docker already set up)
