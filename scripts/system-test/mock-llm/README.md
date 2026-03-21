# LLM Mock Tool

A local LLM API mock tool with **record** and **replay** modes for fast, deterministic CI testing.

## Overview

- **Record mode**: Proxies requests to a real LLM API, saves request/response pairs to disk
- **Replay mode**: Serves recorded responses in sequence, no network calls

## Quick Start

### Recording a scenario

```bash
# 1. Start mock server in record mode
pnpm tsx scripts/system-test/mock-llm/cli.ts \
  --mode record \
  --port 8080 \
  --recordings-dir scripts/system-test/recordings/scenario-02 \
  --upstream https://api.groq.com/openai \
  --api-key $GROQ_API_KEY &

# 2. Run pipeline with mock config (baseURL → localhost:8080)
cp opencode.mock.json opencode.json
pnpm tsx scripts/cody/entry.ts --issue 886 --mode full --complexity 65

# 3. Kill mock server (Ctrl+C or kill %1)
# 4. Recordings are saved to scripts/system-test/recordings/scenario-02/
```

### Replaying in CI

```bash
# 1. Start mock server in replay mode
pnpm tsx scripts/system-test/mock-llm/cli.ts \
  --mode replay \
  --port 8080 \
  --recordings-dir scripts/system-test/recordings/scenario-02 &

# 2. Run pipeline with mock config
cp opencode.mock.json opencode.json
pnpm tsx scripts/cody/entry.ts --issue 886 --mode full --complexity 65

# 3. Kill mock server
```

## CLI Options

| Option                    | Description                        | Required     |
| ------------------------- | ---------------------------------- | ------------ |
| `--mode <record\|replay>` | Mode of operation                  | Yes          |
| `--port <number>`         | Port to listen on (default: 8080)  | No           |
| `--recordings-dir <path>` | Directory for recordings           | Yes          |
| `--upstream <url>`        | Upstream LLM API URL (record mode) | Yes (record) |
| `--api-key <key>`         | API key for upstream               | Yes (record) |
| `--timeout <ms>`          | Upstream timeout (default: 120000) | No           |
| `--help, -h`              | Show help message                  | No           |

## API Key

For record mode, set one of these environment variables:

- `LLM_API_KEY` (recommended)
- `GROQ_API_KEY`

Or pass `--api-key` directly.

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
├── README.md          # This file
└── PLAN.md            # Implementation plan

scripts/system-test/recordings/
└── scenario-02/
      ├── metadata.json  # Scenario info
      ├── 001.json       # First LLM call
      ├── 002.json       # Second LLM call
      └── ...

opencode.mock.json     # OpenCode config pointing at mock server
```

## Endpoints

The mock server provides these endpoints:

| Endpoint               | Method | Description                                    |
| ---------------------- | ------ | ---------------------------------------------- |
| `/health`              | GET    | Returns `{ status: "ok" }`                     |
| `/stats`               | GET    | Returns `{ mode, callCount, totalRecordings }` |
| `/v1/models`           | GET    | Returns dummy model list                       |
| `/v1/chat/completions` | POST   | Main endpoint for chat completions             |

## Resilience Features

- **SSE assembly**: Recorder buffers streaming chunks into single response
- **Call count validation**: Replayer errors if more calls than recordings
- **Request logging**: Every call logged with index, path, model
- **Graceful degradation**: Clear error messages when recordings exhausted
- **Timeout handling**: Configurable upstream timeout in record mode
- **Header sanitization**: Authorization headers stripped from recordings
- **Zero dependencies**: Uses only Node built-in modules

## Future Extensions

- Anthropic Messages API format support
- Spy mode: Replay if recording exists, proxy to real API if not
- Fuzzy matching: Match by model/path, ignore body differences
- Multiple provider support
- Web dashboard for viewing/editing recordings
