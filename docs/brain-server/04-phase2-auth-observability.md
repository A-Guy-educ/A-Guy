# Brain Server — Phase 2: Authentication & Observability

Build after Phase 1 (server setup + code changes) is working and validated.

---

## Overview

Two additions to the brain service:
1. **Authentication** — API key auth on incoming MCP connections
2. **Observability** — Log every request with client, tools, LLM, cost, latency

## 1. Authentication

### Why

The brain has full repo access, API keys, and can execute tools. Even on Tailscale (private network), any device on the tailnet can connect. Add auth to control who can access what.

### Design

Simple API key auth. Each client gets its own key.

```
Client request → Brain checks API key → Accept or reject
```

### Client Keys

| Client | Key Name | Allowed Tools |
|--------|----------|--------------|
| Cody pipeline | `BRAIN_KEY_CODY` | All Context+ tools, no write tools |
| Claude Code | `BRAIN_KEY_CLAUDE_CODE` | All Context+ tools |
| Dashboard chat | `BRAIN_KEY_DASHBOARD` | Search and read tools only |
| CI runner | `BRAIN_KEY_CI` | All Context+ tools, no write tools |

### Implementation

```typescript
// brain-auth.ts

interface ClientConfig {
  name: string;
  allowedTools?: string[];  // undefined = all tools allowed
  deniedTools?: string[];   // tools explicitly blocked
}

const CLIENT_KEYS: Record<string, ClientConfig> = {
  [process.env.BRAIN_KEY_CODY!]: {
    name: 'cody-pipeline',
    deniedTools: ['propose_commit', 'undo_change'],
  },
  [process.env.BRAIN_KEY_CLAUDE_CODE!]: {
    name: 'claude-code',
  },
  [process.env.BRAIN_KEY_DASHBOARD!]: {
    name: 'dashboard-chat',
    allowedTools: [
      'semantic_code_search',
      'get_context_tree',
      'get_file_skeleton',
      'search_memory_graph',
    ],
  },
  [process.env.BRAIN_KEY_CI!]: {
    name: 'ci-runner',
    deniedTools: ['propose_commit', 'undo_change'],
  },
};

export function authenticateClient(apiKey: string): ClientConfig | null {
  return CLIENT_KEYS[apiKey] || null;
}

export function isToolAllowed(client: ClientConfig, toolName: string): boolean {
  if (client.deniedTools?.includes(toolName)) return false;
  if (client.allowedTools && !client.allowedTools.includes(toolName)) return false;
  return true;
}
```

### How Auth is Passed

Option A: HTTP header (if using supergateway/SSE):
```
Authorization: Bearer <api-key>
```

Option B: Query parameter (simpler):
```
http://<tailscale-ip>:4097/sse?key=<api-key>
```

Option C: MCP connection metadata (if supported by transport).

**Recommendation:** Option A (Authorization header) — standard, secure, works with supergateway.

### Setup Steps

| Step | Action |
|------|--------|
| 1 | Generate keys: `openssl rand -hex 32` for each client |
| 2 | Add keys to VPS `.env` file |
| 3 | Create `brain-auth.ts` with client config |
| 4 | Add auth middleware to brain service (check key before processing request) |
| 5 | Update each client to pass API key in requests |
| 6 | Test: valid key → access granted, invalid key → 401 |
| 7 | Test: tool filtering works per client |

## 2. Observability

### Why

Need to track:
- Who is using the brain and how often
- Which tools are called most
- LLM token consumption and cost
- Latency per request (is the brain fast enough?)
- Errors and failures

### What to Log

Every brain request logs:

```typescript
interface BrainRequestLog {
  // Request identity
  requestId: string;
  timestamp: string;
  client: string;          // from auth: 'cody-pipeline', 'claude-code', etc.
  
  // What happened
  systemPrompt: string;    // first 100 chars
  userMessage: string;     // first 200 chars
  
  // LLM usage
  provider: string;        // 'anthropic', 'openai', 'groq'
  model: string;           // 'claude-opus-4-20250514', etc.
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;   // USD
  
  // Tool usage
  toolCalls: {
    tool: string;          // 'semantic_code_search', etc.
    mcpServer: string;     // 'neuron', 'github', etc.
    durationMs: number;
    success: boolean;
    error?: string;
  }[];
  totalToolCalls: number;
  
  // Performance
  totalDurationMs: number;
  llmDurationMs: number;   // time spent in LLM API calls
  toolDurationMs: number;  // time spent in tool execution
  
  // Outcome
  success: boolean;
  error?: string;
}
```

### Storage

Logs stored as JSON lines (one file per day):

```
/opt/brain-server/logs/
├── brain-2026-03-18.jsonl
├── brain-2026-03-19.jsonl
└── ...
```

Rotate after 30 days. Simple, no database needed.

### Implementation

```typescript
// brain-logger.ts

import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = process.env.BRAIN_LOG_DIR || '/opt/brain-server/logs';

export function logBrainRequest(entry: BrainRequestLog): void {
  mkdirSync(LOG_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const logFile = join(LOG_DIR, `brain-${date}.jsonl`);
  appendFileSync(logFile, JSON.stringify(entry) + '\n');
}
```

### Cost Tracking

```typescript
// brain-cost.ts

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514':   { input: 0.015,  output: 0.075 },
  'claude-sonnet-4-20250514': { input: 0.003,  output: 0.015 },
  'gpt-4o':                   { input: 0.005,  output: 0.015 },
  'groq/llama-3.3-70b':       { input: 0.0006, output: 0.0006 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = COST_PER_1K_TOKENS[model] || { input: 0.01, output: 0.03 };
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}
```

### Dashboard (Optional, Later)

Simple CLI to query logs:

```bash
# Total cost today
cat logs/brain-2026-03-18.jsonl | jq -s 'map(.estimatedCost) | add'

# Requests per client
cat logs/brain-2026-03-18.jsonl | jq -s 'group_by(.client) | map({client: .[0].client, count: length})'

# Slowest requests
cat logs/brain-2026-03-18.jsonl | jq -s 'sort_by(-.totalDurationMs) | .[0:5] | .[] | {client, totalDurationMs, totalToolCalls}'

# Most used tools
cat logs/brain-2026-03-18.jsonl | jq -s '[.[].toolCalls[].tool] | group_by(.) | map({tool: .[0], count: length}) | sort_by(-.count)'
```

### Setup Steps

| Step | Action |
|------|--------|
| 1 | Create `brain-logger.ts` with JSONL logging |
| 2 | Create `brain-cost.ts` with cost estimation |
| 3 | Add logging to `brain-client.ts` — wrap every `runBrain` call |
| 4 | Log tool calls individually (name, duration, success) |
| 5 | Create log directory on VPS: `mkdir -p /opt/brain-server/logs` |
| 6 | Add log rotation cron: `find /opt/brain-server/logs -mtime +30 -delete` |
| 7 | Test: run a pipeline, verify logs appear |
| 8 | Test: check cost calculation matches actual API usage |

## Environment Variables (Phase 2)

| Variable | Required | Description |
|----------|----------|-------------|
| `BRAIN_KEY_CODY` | Yes | API key for Cody pipeline |
| `BRAIN_KEY_CLAUDE_CODE` | Yes | API key for Claude Code |
| `BRAIN_KEY_DASHBOARD` | Yes | API key for dashboard chat |
| `BRAIN_KEY_CI` | Yes | API key for CI runners |
| `BRAIN_LOG_DIR` | No | Log directory (default: /opt/brain-server/logs) |

## Estimated Time

| Step | Effort |
|------|--------|
| Auth: key generation + config | 1 hour |
| Auth: middleware + tool filtering | 2-3 hours |
| Auth: client updates (pass key) | 1 hour |
| Observability: logger + cost tracker | 2-3 hours |
| Observability: integrate into brain-client | 1-2 hours |
| Testing | 1-2 hours |
| **Total** | **~8-12 hours** |

## Prerequisites

- Phase 1 complete (brain server running, code changes deployed)
- Brain serving requests successfully
- At least one client (Cody pipeline) connected and working
