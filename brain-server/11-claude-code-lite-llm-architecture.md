# Brain Server v2 - Claude Code + LiteLLM Architecture

**Date:** 2026-03-20
**Status:** Planning
**Goal:** Replace current brain-agent with Claude Code + LiteLLM for model flexibility

---

## Why This Architecture

| Current Problem | Solution |
|-----------------|----------|
| Brain-agent uses Claude API directly | Claude Code is a proper agent with memory |
| No model flexibility | LiteLLM routes to any model |
| Custom tool orchestration | Claude Code has built-in tool management |
| Hard to swap models | LiteLLM proxy enables model routing |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPS (Brain Server)                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Claude Code (agent framework)                           │   │
│  │  - Session memory ✅                                      │   │
│  │  - Tool orchestration ✅                                   │   │
│  │  - Decision tracking ✅                                    │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │ MCP (tools call)                            │
│  ┌────────────────────▼─────────────────────────────────────┐   │
│  │  LiteLLM (AI gateway)                                   │   │
│  │  - Intercepts /v1/chat/completions                       │   │
│  │  - Routes to configured model                             │   │
│  │  - Retries, fallbacks, logging                            │   │
│  └────┬───────────────┬───────────────┬────────────────────┘   │
│       │               │               │                             │
│  ┌────▼────┐   ┌─────▼─────┐   ┌────▼─────┐                     │
│  │ Claude  │   │  GPT-4o   │   │  Gemini  │   ...             │
│  │ Opus 4.6│   │           │   │          │                     │
│  └─────────┘   └───────────┘   └──────────┘                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MCP Tools (exposed to Claude Code)                     │   │
│  │  - Context+ (repo analysis)                              │   │
│  │  - GitHub MCP (PRs, issues)                             │   │
│  │  - Filesystem MCP (local access)                        │   │
│  │  - Custom tools                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                            │ MCP
                            │
┌──────────────────────────┴────────────────────────────────────┐
│                     OpenCode (Client)                            │
│                                                                  │
│  @neurons ──────► brain-mcp ──────► Claude Code on VPS         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Claude Code (`claude mcp serve`)

**What:** Anthropic's official CLI agent running as MCP server

**Why:**
- Built-in session memory and context
- Native tool orchestration
- Decision tracking and reasoning
- Proven agent framework

**Install:**
```bash
npm install -g @anthropic-ai/claude-code
```

**Run:**
```bash
claude mcp serve
```

### 2. LiteLLM (AI Gateway)

**What:** Proxy that intercepts LLM calls and routes to any provider

**Why:**
- OpenAI-compatible API (`/v1/chat/completions`)
- 100+ model support (Claude, GPT, Gemini, Local, etc.)
- Built-in retries, fallbacks, rate limiting
- Cost tracking, logging

**Install:**
```bash
pip install litellm
```

**Config file** (`litellm_config.yaml`):
```yaml
model_list:
  - model_name: claude-opus
    litellm_params:
      model: claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-sonnet
    litellm_params:
      model: claude-3-5-sonnet-20240620
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gpt-4o-mini
    litellm_params:
      model: gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gemini-pro
    litellm_params:
      model: gemini/gemini-pro
      api_key: os.environ/GEMINI_API_KEY

  - model_name: local-ollama
    litellm_params:
      model: ollama/llama3
      api_base: http://localhost:11434

router_settings:
  retries: 3
  num_retries: 3
  fallbacks: [{"claude-opus": "claude-sonnet"}, {"claude-sonnet": "gpt-4o"}]
  timeout: 60
  routing_strategy: latency-based-routing

general_settings:
  master_key: os.environ/LITELLM_KEY
```

**Run proxy:**
```bash
litellm --config litellm_config.yaml --port 8000
```

### 3. Context+ MCP Server

**What:** Repo analysis tools (semantic search, blast radius, etc.)

**Already deployed on port 4097.**

### 4. GitHub MCP Server

**What:** GitHub API tools (PRs, issues, repos)

**Install:**
```bash
npm install -g @modelcontextprotocol/server-github
```

### 5. Supergateway (Optional)

**What:** Bridges Claude Code's stdio MCP to HTTP/SSE

**Needed for:** Remote access from OpenCode

```bash
npx supergateway --stdio "claude mcp serve" --port 4098 --host 0.0.0.0
```

---

## Implementation Steps

### Phase 1: Core Setup

#### Step 1.1: Install Claude Code on VPS

```bash
# SSH to VPS
ssh root@184.174.39.227

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify
claude --version
```

#### Step 1.2: Install LiteLLM on VPS

```bash
# Install Python + pip (if not present)
apt-get update && apt-get install -y python3 python3-pip

# Install LiteLLM
pip install litellm

# Create config directory
mkdir -p /opt/brain-server/litellm
```

#### Step 1.3: Configure LiteLLM

Create `/opt/brain-server/litellm/config.yaml`:

```yaml
model_list:
  - model_name: claude-opus
    litellm_params:
      model: claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_key: os.environ/OPENAI_API_KEY

router_settings:
  retries: 3
  fallbacks: [{"claude-opus": "gpt-4o"}]
```

#### Step 1.4: Configure Claude Code to use LiteLLM

Set environment variable to redirect Claude API calls:
```bash
export OPENAI_API_BASE=http://localhost:8000
export OPENAI_API_KEY=dummy-key  # LiteLLM ignores this for proxy mode
```

Or configure Claude Code's API endpoint in `~/.claude/settings.json`:
```json
{
  "env": {
    "ANTHROPIC_API_BASE": "http://localhost:8000/llm"
  }
}
```

**Note:** May need to patch Claude Code or use LiteLLM's proxy mode that accepts Anthropic format.

### Phase 2: MCP Tool Integration

#### Step 2.1: Expose MCP Tools to Claude Code

Claude Code can use MCP tools. Configure in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "context-plus": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-context-plus", "/repo"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github", "--token", "os.environ/GITHUB_TOKEN"]
    }
  }
}
```

#### Step 2.2: Test Tool Access

```bash
# From VPS, test Claude Code with tools
claude "What files changed in the last PR?" --print
```

Claude Code should see and use Context+ and GitHub tools.

### Phase 3: Networking & Security

#### Step 3.1: Expose via Supergateway

```bash
# Start supergateway
npx supergateway --stdio "claude mcp serve" --port 4098 --host 0.0.0.0
```

#### Step 3.2: Firewall Rules

```bash
# Only allow Tailscale
ufw delete allow 4098
ufw allow in on tailscale0 to any port 4098
```

### Phase 4: Client Configuration

#### Step 4.1: OpenCode Configuration

In `opencode.json`:

```json
{
  "mcp": {
    "brain": {
      "type": "remote",
      "url": "http://100.66.248.120:4098/mcp",
      "enabled": true
    }
  }
}
```

#### Step 4.2: Test End-to-End

```bash
# From Mac
curl -X POST http://100.66.248.120:4098/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Should return Claude Code's tools + Context+ tools.

---

## Model Routing Examples

### Switch Model via LiteLLM

**Config change (no restart needed for LiteLLM, restart Claude Code):**

```yaml
# Change default model
router_settings:
  model_group_alias:
    default: gpt-4o  # Switch default to GPT-4o

  fallbacks:
    - model: claude-opus
      fallback: gpt-4o
```

### Per-Request Routing

LiteLLM supports routing via API:

```bash
curl -X POST http://localhost:8000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gpt-4o",  # Override default
    "messages": [{"role": "user", "content": "hi"}]
  }'
```

### Model Selection Strategy

| Task Type | Recommended Model | Why |
|-----------|------------------|-----|
| Code analysis | Claude Opus | Best coding能力 |
| Simple Q&A | GPT-4o-mini | Fast, cheap |
| Complex reasoning | Claude Opus | Best reasoning |
| Creative tasks | GPT-4o | Good creative |
| Local (no API) | Ollama/Llama | Free, private |

---

## Monitoring & Observability

### LiteLLM Dashboard

LiteLLM has built-in metrics:

```bash
# Start with UI
litellm --config litellm_config.yaml --port 8000 --port 8000

# Dashboard at
http://localhost:8000/overview
```

### Logging

LiteLLM logs all requests:

```yaml
# In config.yaml
litellm_settings:
  json_logs: true
  call_logging: true
```

### Cost Tracking

```yaml
# Per-model cost tracking
model_list:
  - model_name: claude-opus
    litellm_params:
      model: claude-3-opus-20240229
    model_info:
      mode: chat
      created_at: "2024-02-29"
      cost_per_token:
        input: 0.000015
        output: 0.000075
```

---

## Troubleshooting

### Claude Code not using LiteLLM

Check environment:
```bash
echo $OPENAI_API_BASE  # Should be http://localhost:8000
echo $ANTHROPIC_API_KEY  # Should be dummy or actual key
```

### LiteLLM not routing to Claude

Check LiteLLM logs for errors. Common issue: Claude requires specific auth format.

### MCP Tools not visible

Verify MCP servers are configured in Claude Code settings:
```bash
claude mcp list  # Should show available tools
```

---

## Migration from Current Setup

### What to Keep
- Context+ Docker container (same port 4097)
- Tailscale VPN configuration
- Nginx proxy (can remove, use supergateway instead)
- Firewall rules

### What to Replace
- `brain-agent-mcp.js` → Claude Code (`claude mcp serve`)
- Custom tool proxy → Native MCP tool support
- Claude API calls → LiteLLM proxy

### What to Add
- LiteLLM proxy service
- GitHub MCP server
- Claude Code installation

---

## Estimated Time

| Step | Time |
|------|------|
| Install Claude Code | 10 min |
| Install LiteLLM + Config | 20 min |
| Configure MCP tools | 30 min |
| Supergateway setup | 10 min |
| OpenCode config update | 5 min |
| **Total** | ~75 min |

---

## Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| **Model fallbacks** | If Claude fails, auto-switch to GPT |
| **Cost optimization** | Route cheap tasks to GPT-4o-mini |
| **Latency routing** | Route to fastest available model |
| **Custom routing** | Based on task type, route to specialized model |
| **PortKey alternative** | If LiteLLM insufficient, try PortKey |

---

## Alternative: PortKey Instead of LiteLLM

PortKey is a managed AI gateway with:
- UI dashboard
- Analytics
- Managed service (no self-host)
- Rate limiting, retries built-in

```yaml
# PortKey config
portkey:
  api_key: os.environ/PORTKEY_API_KEY
  config:
    - model: claude-3-opus
      alias: brain-default
```

**Pros:** No server to manage, better UI
**Cons:** External dependency, cost for service

---

## Decision Points

Before implementing, decide:

1. **Self-host LiteLLM or use PortKey?**
   - LiteLLM: Self-host, full control
   - PortKey: Managed, less ops

2. **Which models to support initially?**
   - Minimum: Claude Opus + GPT-4o
   - Add: Gemini, local Ollama later

3. **Which MCP tools to expose?**
   - Context+ (must have)
   - GitHub (recommended)
   - Filesystem (optional)
   - Others as needed

4. **API authentication?**
   - LiteLLM supports API keys
   - OpenCode MCP doesn't support auth headers
   - Tailscale-only network provides security

---

## Next Steps

1. **Approve plan** - User approves this architecture
2. **Create implementation script** - Automate VPS setup
3. **Test on VPS** - Deploy and verify
4. **Update OpenCode** - Point to new brain
5. **Monitor and iterate** - Adjust model routing as needed