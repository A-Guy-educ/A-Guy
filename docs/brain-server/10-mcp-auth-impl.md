# Brain Server with MCP - Implementation Summary

**Date:** 2026-03-20
**Status:** ✅ Implemented

---

## Architecture (Actual)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Brain Server (VPS)                        │
│  Public: http://184.174.39.227:4098                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Nginx (reverse proxy)                                   │   │
│  │  - HTTP proxy to supergateway                           │   │
│  │  - Firewall: only 4098/tcp open to world               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Supergateway (streamableHttp)                          │   │
│  │  - Port 4097                                           │   │
│  │  - Forwards to Context+ via stdio                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│                   ┌─────────────────────┐                       │
│                   │  Context+           │                       │
│                   │  - 17 brain tools   │                       │
│                   └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ MCP (no auth)
                                    │ OpenCode limitation
┌────────────────────────────────────┼────────────────────────────┐
│                        Client OpenCode                            │
│                                                                  │
│  MCP config:                                                   │
│  {                                                            │
│    "neuron": {                                               │
│      "type": "remote",                                        │
│      "url": "http://184.174.39.227:4098/mcp"                │
│    }                                                         │
│  }                                                           │
│                                                                  │
│  @neuron agent uses brain tools via MCP                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Was Implemented

### 1. Brain Server (VPS) ✅

- **Nginx** installed and configured as reverse proxy
- **Firewall** configured to allow port 4098 publicly
- **Context+** running via supergateway on port 4097
- **Health endpoint** at `/health`

### 2. Local MCP Proxy ✅

Created `scripts/brain-server/local-mcp-proxy.ts`:
- Tool filtering (only neuron_* allowed)
- Auth header injection
- SSE support

**Note:** Not currently used because OpenCode connects directly to brain.

### 3. OpenCode Integration ✅

- `@neuron` agent configured in `opencode.json`
- MCP connection: `http://184.174.39.227:4098/mcp`
- Agent uses MiniMax model
- Instructions: `scripts/brain-server/AGENT.md`

---

## Auth Limitation

**OpenCode MCP client does not support sending auth headers.**

This means we cannot use HTTP Basic Auth or Bearer tokens with OpenCode MCP connections.

**Workaround:** Rely on VPS firewall for security:
- Port 22 (SSH) restricted
- Port 4098 (brain) open for MCP access
- Only trusted IPs should access the brain server

**Future options:**
1. If OpenCode adds auth support for MCP, re-enable auth
2. Use IP-based restrictions in Nginx
3. Accept risk for development

---

## Files Created/Modified

### New Files
- `scripts/brain-server/local-mcp-proxy.ts` - Local MCP proxy with tool filtering
- `docs/brain-server/10-mcp-auth-impl.md` - This document

### Modified Files
- `opencode.json` - Added @neuron agent and MCP config
- `scripts/brain-server/AGENT.md` - @neuron instructions
- `package.json` - Added `brain:proxy` script

### VPS Files
- `/etc/nginx/sites-available/brain` - Nginx config
- `/etc/nginx/.brain_htpasswd` - Auth credentials (unused)

---

## Testing

### Test Brain Connection

```bash
# Health check
curl http://184.174.39.227:4098/health

# MCP tools list
curl -X POST http://184.174.39.227:4098/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Test @neuron Agent

```bash
opencode run --agent neuron "what depends on adminOnly.ts"
```

Expected: Uses `neuron_get_blast_radius` tool

---

## Security Considerations

| Concern | Status | Mitigation |
|---------|--------|------------|
| Public access to brain | ⚠️ Accepted | Firewall restricts SSH |
| No MCP auth | ⚠️ Limitation | OpenCode doesn't support |
| Token auth prepared | ✅ Ready | Can re-enable when OpenCode supports |

---

## Commands

### Brain Server (VPS)

```bash
# SSH to brain
ssh root@184.174.39.227

# Check containers
docker ps | grep brain

# Check Nginx
systemctl status nginx

# View logs
docker logs brain-server-brain-1 --tail 20

# Restart services
systemctl restart nginx
docker restart brain-server-brain-1
```

### Local Proxy (optional)

```bash
# Start proxy
BRAIN_API_TOKEN=<token> BRAIN_SERVER_URL=http://184.174.39.227:4098 \
  node --import tsx scripts/brain-server/local-mcp-proxy.ts

# Or use package script
pnpm brain:proxy
```

---

## Future Enhancements

| Enhancement | Priority | Status |
|-------------|----------|--------|
| MCP auth support | High | Waiting on OpenCode |
| IP-based restrictions | Medium | Can implement |
| HTTPS (Let's Encrypt) | Medium | Can implement |
| Domain name | Low | Optional |
| Rate limiting | Low | Can implement |

---

## Approval Status

- [x] Approved for implementation
- [x] Brain server working
- [x] @neuron agent working
- [x] MCP connection established
- [x] Tool filtering ready (unused due to OpenCode limitation)
