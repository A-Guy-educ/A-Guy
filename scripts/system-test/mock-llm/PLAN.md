# LLM Mock Tool — Implementation Plan

## Overview

A local LLM API mock tool with **record** and **replay** modes for fast, deterministic CI testing of the Cody pipeline (and any other LLM-dependent code).

- **Record mode**: Proxies requests to a real LLM API, saves request/response pairs to disk
- **Replay mode**: Serves recorded responses in sequence, no network calls

## Background & Research

### Why this tool exists

The Cody pipeline system test runs the full pipeline (taskify → architect → build → verify → PR) against real GitHub infrastructure. Each run makes 20-50+ LLM API calls via OpenCode, taking 5-10 minutes with Groq. In CI, we need this to be fast (~10-30 seconds) and deterministic (no flaky API failures).

### Alternatives evaluated

| Option                    | Verdict                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| Hoverfly (MITM proxy)     | Node.js doesn't respect HTTPS_PROXY. Bun does, but TLS cert issues in CI.     |
| Hoverfly (webserver mode) | Works but external Go binary dependency. Sequential response support unclear. |
| nock / Polly.js / MSW     | In-process only. Can't intercept child process (OpenCode) HTTP calls.         |
| mock-llm (dwmkerr)        | Purpose-built but 3 stars, no recording mode, unmaintained risk.              |
| Real Groq API             | Works but slow (5-10 min) and flaky (rate limits, downtime).                  |
| **Custom replay server**  | **Chosen.** Zero deps, recording built-in, full control.                      |

### Key technical findings

1. **OpenCode is a Bun binary** that handles all LLM communication internally
2. **OpenCode supports `baseURL` override** via `provider.<name>.options.baseURL` in config
3. **OpenCode uses streaming by default**, but non-streaming responses work fine (validated)
4. **Each pipeline stage may make multiple LLM calls** (tool calls, retries), so recording captures the full sequence
5. **The pipeline ignores SSE deltas** — it only cares about complete events from OpenCode

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Cody Pipeline (scripts/cody/entry.ts)                   │
│    └─ spawns OpenCode CLI                                │
│         └─ sends POST /v1/chat/completions               │
│              └─ to baseURL from opencode.mock.json        │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Mock LLM Server (localhost:8080)                         │
│                                                           │
│  Record mode:                                             │
│    request → forward to real API → save response → return │
│                                                           │
│  Replay mode:                                             │
│    request → load next recording → return                 │
└──────────────────────────────────────────────────────────┘
```

## File Structure

```
scripts/system-test/mock-llm/
├── types.ts           # Shared type definitions
├── server.ts          # HTTP server with routing
├── recorder.ts        # Record mode: proxy + save
├── replayer.ts        # Replay mode: sequential playback
├── cli.ts             # CLI entry point
├── index.ts           # Programmatic API exports
├── README.md          # Usage documentation
└── PLAN.md            # This file

scripts/system-test/recordings/
└── scenario-02/
    ├── metadata.json  # Scenario info
    ├── 001.json       # First LLM call
    ├── 002.json       # Second LLM call
    └── ...

opencode.mock.json     # OpenCode config pointing at mock server
```

## Module Specifications

### `types.ts` (~30 lines)

```typescript
export type Mode = 'record' | 'replay'

export interface MockLLMConfig {
  mode: Mode
  port: number
  recordingsDir: string
  upstreamUrl?: string // Required for record mode
  apiKey?: string // For record mode upstream auth
}

export interface RecordedCall {
  index: number
  timestamp: string
  request: {
    method: string
    path: string
    headers: Record<string, string>
    body: unknown
  }
  response: {
    status: number
    headers: Record<string, string>
    body: unknown
  }
}

export interface ScenarioMetadata {
  scenario: string
  recordedAt: string
  upstreamUrl: string
  model: string
  totalCalls: number
}
```

### `server.ts` (~150 lines)

HTTP server using Node's built-in `http` module (zero dependencies).

**Endpoints:**

- `POST /v1/chat/completions` — Main endpoint. Delegates to recorder or replayer.
- `GET /v1/models` — Returns dummy model list (some clients call this).
- `GET /health` — Returns `{"status": "ok"}`.
- `GET /stats` — Returns `{"mode": "replay", "callCount": 5, "totalRecordings": 12}`.

**Behavior:**

- Parses JSON body from request
- Strips `stream: true` from body (we always return non-streaming)
- Delegates to recorder or replayer based on mode
- Returns proper OpenAI-compatible JSON response
- Logs each call: `[mock-llm] #5 POST /v1/chat/completions model=llama-3.3-70b-versatile`

### `recorder.ts` (~120 lines)

**Responsibilities:**

- Forward request to upstream LLM API
- Handle upstream streaming SSE responses → assemble into single JSON response
- Save request + response to `{recordingsDir}/{index padded to 3 digits}.json`
- Strip sensitive headers (Authorization) from saved recordings
- Write `metadata.json` on shutdown

**SSE Assembly:**

- Read upstream response
- If `content-type: text/event-stream`, buffer all `data:` lines
- Parse each chunk, extract `choices[0].delta.content`
- Assemble into a single `choices[0].message.content`
- Build complete non-streaming response JSON

**Error handling:**

- If upstream returns error, save and return the error response
- If upstream is unreachable, return 502 with clear error message
- Configurable timeout (default 120s)

### `replayer.ts` (~80 lines)

**Responsibilities:**

- On startup: load all `*.json` files from recordings dir, sort by index
- Validate recordings exist and are valid JSON
- On each request: return the next response in sequence, increment counter
- If sequence exhausted: return 500 with `{"error": {"message": "Mock LLM: No more recorded responses. Expected N calls, got N+1.", "type": "mock_exhausted"}}`

**Resilience:**

- Logs warning if request model differs from recorded model
- Logs each replayed call with index and timing

### `cli.ts` (~60 lines)

```
Usage:
  pnpm tsx scripts/system-test/mock-llm/cli.ts [options]

Options:
  --mode <record|replay>     Mode of operation (required)
  --port <number>            Port to listen on (default: 8080)
  --recordings-dir <path>    Directory for recordings (required)
  --upstream <url>           Upstream LLM API URL (required for record mode)
  --api-key <key>            API key for upstream (record mode, or use LLM_API_KEY env)
  --timeout <ms>             Upstream timeout in ms (default: 120000)

Examples:
  # Record a new scenario
  pnpm tsx scripts/system-test/mock-llm/cli.ts \
    --mode record \
    --port 8080 \
    --recordings-dir scripts/system-test/recordings/scenario-02 \
    --upstream https://api.groq.com/openai \
    --api-key $GROQ_API_KEY

  # Replay a recorded scenario
  pnpm tsx scripts/system-test/mock-llm/cli.ts \
    --mode replay \
    --port 8080 \
    --recordings-dir scripts/system-test/recordings/scenario-02
```

**Behavior:**

- Parse args (no external deps — use `process.argv` directly)
- Validate required args
- Start server
- Log startup info: `[mock-llm] Started in replay mode on port 8080 (12 recordings loaded)`
- Graceful shutdown on SIGINT/SIGTERM: log stats, close server

### `index.ts` (~20 lines)

Exports for programmatic use:

```typescript
export { createServer } from './server'
export { createRecorder } from './recorder'
export { createReplayer } from './replayer'
export type { MockLLMConfig, RecordedCall, ScenarioMetadata, Mode } from './types'
```

## Config File: `opencode.mock.json`

New file at project root. Copy of `opencode.test.json` with `provider` section added:

```json
{
  "provider": {
    "groq": {
      "options": {
        "baseURL": "http://localhost:8080/v1",
        "apiKey": "mock-key"
      }
    }
  },
  "agent": {
    // ... same as opencode.test.json agents but using groq/llama-3.3-70b-versatile
  }
}
```

## Workflow Integration

### Recording a new scenario (manual, one-time)

```bash
# 1. Start mock server in record mode
pnpm tsx scripts/system-test/mock-llm/cli.ts \
  --mode record --port 8080 \
  --recordings-dir scripts/system-test/recordings/scenario-02 \
  --upstream https://api.groq.com/openai \
  --api-key $GROQ_API_KEY &

# 2. Run pipeline with mock config (baseURL → localhost:8080)
cp opencode.mock.json opencode.json
pnpm tsx scripts/cody/entry.ts --issue 886 --mode full --complexity 65

# 3. Kill mock server (Ctrl+C or kill %1)
# 4. Commit recordings to repo
git add scripts/system-test/recordings/scenario-02/
git commit -m "chore: record mock LLM responses for scenario 02"
```

### CI replay (automatic, fast)

```yaml
# In .github/workflows/cody-system-test.yml
- name: Start mock LLM server
  run: |
    pnpm tsx scripts/system-test/mock-llm/cli.ts \
      --mode replay --port 8080 \
      --recordings-dir scripts/system-test/recordings/scenario-02 &
    sleep 2  # Wait for server to start

- name: Run pipeline with mock
  run: |
    cp opencode.mock.json opencode.json
    # Run pipeline... instant responses from mock
```

## Resilience Features

| Feature                     | Implementation                                             |
| --------------------------- | ---------------------------------------------------------- |
| **SSE assembly**            | Recorder buffers streaming chunks into single response     |
| **Call count validation**   | Replayer warns/errors if more calls than recordings        |
| **Request logging**         | Every call logged with index, path, model, timing          |
| **Graceful degradation**    | Clear error messages when recordings exhausted             |
| **Timeout handling**        | Configurable upstream timeout in record mode               |
| **Header sanitization**     | Authorization headers stripped from saved recordings       |
| **Port conflict detection** | Fail fast with clear message if port in use                |
| **Recording validation**    | Replayer validates JSON on startup, not per-request        |
| **Metadata tracking**       | Saves when recorded, model used, total calls, upstream URL |
| **Zero dependencies**       | Uses only Node built-in `http`, `fs`, `path` modules       |

## Implementation Order

| Step      | Module                                 | Estimated Time |
| --------- | -------------------------------------- | -------------- |
| 1         | `types.ts`                             | 15 min         |
| 2         | `replayer.ts`                          | 30 min         |
| 3         | `server.ts`                            | 45 min         |
| 4         | `recorder.ts` (with SSE assembly)      | 1 hour         |
| 5         | `cli.ts`                               | 20 min         |
| 6         | `index.ts`                             | 10 min         |
| 7         | `opencode.mock.json`                   | 15 min         |
| 8         | Integration testing with real pipeline | 1-2 hours      |
| 9         | README.md                              | 20 min         |
| **Total** |                                        | **4-6 hours**  |

## Future Extensions (v2+)

- **Anthropic Messages API** format support (`/v1/messages`)
- **Spy mode**: Replay if recording exists, proxy to real API if not
- **Fuzzy matching**: Match by model/path, ignore body differences
- **Response validation**: Validate responses match OpenAI schema
- **npm package extraction**: Publish as `@a-guy/mock-llm`
- **Multiple provider support**: Mock different providers on different ports
- **Web dashboard**: View/edit recordings in browser
- **Recording diffing**: Compare two recording sets to detect drift
