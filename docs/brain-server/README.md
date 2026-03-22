# Brain Server

Remote brain server running on VPS with Claude Opus 4.6 and Context+ for code analysis.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Brain Server (VPS)                        │
│  184.174.39.227 / 100.66.248.120 (Tailscale)                   │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │  brain-agent (Node.js MCP server)                        │   │
│   │  - Port 4099                                            │   │
│   │  - Uses Claude Opus 4.6 via ANTHROPIC_API_KEY          │   │
│   │  - Wraps Context+ tools with neuron_* prefix           │   │
│   │  - Provides brain_ask tool for natural language queries  │   │
│   └────────────────────┬─────────────────────────────────────┘   │
│                        │                                            │
│   ┌────────────────────▼─────────────────────────────────────┐   │
│   │  Context+ (Docker)                                      │   │
│   │  - Port 4097                                            │   │
│   │  - Semantic search, blast radius, memory graph           │   │
│   │  - Connected to /opt/repo (git repo)                    │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │  Supporting Services                                     │   │
│   │  - token-manager (port 4096) - Token storage API        │   │
│   │  - claude-gateway (port 4100) - Claude Code CLI gateway │   │
│   └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                            │ MCP (streamableHttp)
                            │
┌──────────────────────────┴────────────────────────────────────┐
│                     OpenCode (MacBook)                          │
│                                                                  │
│   opencode.json configures brain-mcp:                           │
│   {                                                            │
│     "brain-mcp": {                                             │
│       "type": "remote",                                        │
│       "url": "http://100.66.248.120:4099/mcp",                 │
│       "enabled": true                                          │
│     }                                                          │
│   }                                                            │
│                                                                  │
│   @neuron agent uses brain_ask and neuron_* tools              │
└─────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| context-plus | 4097 | Context+ Docker container (semantic search, blast radius) |
| brain-agent | 4099 | MCP server with Claude Opus 4.6 + Context+ tools |
| token-manager | 4096 | Token storage API (GitHub, Anthropic) |
| claude-gateway | 4100 | Alternative gateway using Claude Code CLI |
| nginx | 4098 | Reverse proxy to brain-agent (optional) |

## Tools Available

### Main Tool
| Tool | Description |
|------|-------------|
| `brain_ask` | Ask Brain a question about the codebase. Uses Claude Opus 4.6 + Context+ |

### Context+ Tools (neuron_* prefix)
| Tool | Description |
|------|-------------|
| `neuron_get_context_tree` | Project structure with file/function names |
| `neuron_semantic_code_search` | Search by meaning, not keywords |
| `neuron_get_blast_radius` | Find dependencies before changing code |
| `neuron_get_file_skeleton` | Get function signatures without reading body |
| `neuron_semantic_identifier_search` | Search at symbol level |
| `neuron_run_static_analysis` | Run linter/compiler |
| `neuron_semantic_navigate` | Browse by meaning clusters |
| `neuron_search_memory_graph` | Search knowledge graph |
| `neuron_upsert_memory_node` | Add to knowledge graph |
| `neuron_create_relation` | Link knowledge graph nodes |

## Quick Start

### Test the Brain

```bash
# Via curl (direct brain-agent)
curl -X POST http://100.66.248.120:4099/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"brain_ask","arguments":{"question":"What files handle authentication?"}}}'

# Health check
curl http://100.66.248.120:4099/health
```

### OpenCode Integration

The brain server is configured in `opencode.json`:

```json
"mcp": {
  "brain-mcp": {
    "type": "remote",
    "url": "http://100.66.248.120:4099/mcp",
    "enabled": true
  }
}
```

## Server Management

### VPS Connection
```bash
# Via Tailscale
ssh root@100.66.248.120

# Via public IP
ssh root@184.174.39.227
```

### Check Status
```bash
# All services
systemctl status brain-agent claude-gateway token-manager

# View logs
tail -f /opt/brain-server/brain-agent.log
tail -f /opt/brain-server/claude-gateway.log
```

### Restart Services
```bash
systemctl restart brain-agent
systemctl restart claude-gateway
systemctl restart token-manager
```

## Network

| Host | Tailscale IP | Public IP |
|------|--------------|-----------|
| MacBook | 100.117.15.74 | - |
| VPS | 100.66.248.120 | 184.174.39.227 |

## Token Management

### Set GitHub Token (for GitHub MCP)
```bash
curl -X POST http://100.66.248.120:4096/token/github \
  -H "Content-Type: application/json" \
  -d '{"token": "ghp_XXXX"}'
```

### Check Token Status
```bash
curl http://100.66.248.120:4096/token/github
```

## Troubleshooting

### "ECONNREFUSED"
```bash
# Check if brain-agent is running
curl http://100.66.248.120:4099/health

# Restart if needed
systemctl restart brain-agent
```

### Tools return errors
```bash
# Check repo is mounted in Context+
ssh root@100.66.248.120 "docker exec brain-server-brain-1 ls /repo"
```

### Tailscale issues
```bash
ssh root@100.66.248.120 "tailscale status"
```

## Documentation

- [Setup](./01-requirements-setup.md) - Requirements and account setup
- [Server Setup](./02-server-setup.md) - VPS provisioning
- [Claude Code + LiteLLM Architecture](./11-claude-code-lite-llm-architecture.md) - Architecture plan

## Cost

- VPS (Contabo): ~$5/mo
- Ollama embedding model: FREE (local)
- Context+ MCP: FREE (open source)
- Claude API calls: Standard pricing (used by brain-agent)