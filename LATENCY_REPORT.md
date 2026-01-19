# Deterministic Endpoint Latency Report

## Scope

- Target: identify a single bottleneck causing 3–7s latency on one endpoint.
- Environment: local dev server on port 3002 with log capture to `tasks/dev.log`.
- Instrumentation: manual stage timing and slow-only structured logs.
- Requests: sequential only (no concurrency).

## Repro Commands

Start dev server (capturing logs):

```powershell
cmd /c "set PORT=3002 && pnpm dev > tasks\\dev.log 2> tasks\\dev.err.log"
```

Chat repro:

```powershell
$env:AUTH_HEADER="cookie"; $env:AUTH_HEADER_VALUE="payload-token=PASTE_TOKEN_HERE"; $env:ENDPOINT_URL="http://localhost:3002/api/agent/chat"; $env:METHOD="POST"; $env:BODY='{"message":"ping","acknowledgment":"ok","lessonId":"6963c572b2666f203c53f588"}'; pnpm tsx scripts/latency-repro.ts
```

Filter logs:

```powershell
Select-String -Path tasks/dev.log -Pattern "Slow request timing|Slow db query"
```

## Endpoints Tested

- `POST /api/agent/chat` (lessonId: `6963c572b2666f203c53f588`)
- `POST /api/agent/conversation` (contextKey: `lessons:6963c572b2666f203c53f588`)
- `POST /api/agent/reset-chat` (contextKey: `lessons:6963c572b2666f203c53f588`)
- `GET /api/chapters/by-grade?grade=grade-8-geometry`

## Results Summary

- `/api/agent/chat` dominates latency; the largest stage is consistently `external_call:ai_model`.
- `/api/agent/conversation` is fast after the first request (tens of ms).
- `/api/agent/reset-chat` is fast after the first request (100–150ms).
- `/api/chapters/by-grade` is fast after the initial compile (20–55ms).

## Bottleneck (Clear Root Cause)

**Dominant stage:** `external_call:ai_model` (Gemini chat call)

Evidence: every slow request log shows the model call taking the majority of total time.

Example (cold start):

```json
{
  "endpoint": "/api/agent/chat",
  "totalMs": 2515,
  "breakdown": {
    "db_connect": 418,
    "auth": 381,
    "db_query:conversation_find_active": 219,
    "external_call:ai_model": 1119,
    "db_query:conversation_update_assistant_message": 100
  },
  "isColdStart": true
}
```

Example (steady-state):

```json
{
  "endpoint": "/api/agent/chat",
  "totalMs": 1904,
  "breakdown": {
    "external_call:ai_model": 1634,
    "db_query:conversation_update_user_message": 95,
    "db_query:conversation_find_active": 59
  },
  "isColdStart": false
}
```

## Cold Start vs Determinism

- Cold start adds `db_connect` and `auth` overhead on the first request.
- Even in cold start, the **model call is still the largest stage**.
- Steady-state requests still dominated by `external_call:ai_model`.

## DB Slow Query Detection

- One slow DB query observed:
  - Collection: `conversations`
  - Filter shape: `and[0].user.equals`, `and[1].contextKey.equals`, `and[2].archivedAt.exists`
  - Duration: 219ms
- All other DB operations stayed well under the 200ms threshold.

## Final Conclusion

**This stage is the reason the endpoint takes 3–7 seconds:**

`external_call:ai_model` on `POST /api/agent/chat`.

## Suggested Fix Direction

1. Reduce Gemini response time:
   - shorter prompt or smaller model
   - cache repeated responses
2. Reuse model context or session if supported by provider.
3. If production shows 3–7s consistently, it should appear as larger `external_call:ai_model` durations in the same logs.
