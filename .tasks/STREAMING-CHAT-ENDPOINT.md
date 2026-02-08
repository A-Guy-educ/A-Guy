# Plan: Streaming Chat Endpoint with Genkit + SSE

## Overview

Add a new **SSE-based streaming endpoint** (`POST /api/agent/chat/stream`) that reuses the entire existing chat pipeline but swaps `ai.generate()` for `ai.generateStream()` and delivers tokens via Server-Sent Events. Persistence happens after the stream completes.

**Yes, SSE** — Genkit natively uses SSE for streaming transport. We'll use the standard Web Streams API (`ReadableStream`) to emit SSE events directly from a Next.js API route.

---

## SSE Event Protocol

```
event: chunk
data: {"text":"partial token"}

event: done
data: {"conversationId":"abc","contextKey":"exercises:123"}

event: error
data: {"error":"Something went wrong","code":"LLM_ERROR"}
```

| Event   | When                                         | Purpose                             |
| ------- | -------------------------------------------- | ----------------------------------- |
| `chunk` | Each token from LLM                          | Client appends to displayed message |
| `done`  | Stream complete, assistant message persisted | Signals completion + metadata       |
| `error` | Any failure during stream                    | Client shows error                  |

Pre-stream errors (auth, validation, context) return normal JSON responses (not SSE).

---

## Architecture

```
                    EXISTING (unchanged)                    NEW
                    ════════════════════                    ═══
POST /api/agent/chat ─→ agentChat() ─→ ai.generate() ─→ Response.json()

POST /api/agent/chat/stream ─→ agentChatStream()
  │
  ├─ SHARED PIPELINE (extracted) ──────────────────────────────────┐
  │   auth → validate → context → access → conversation            │
  │   → persist user msg → memories → prompt composition           │
  │                                                                 │
  ├─ ai.generateStream() ─→ SSE ReadableStream                    │
  │   ├─ chunk events (token by token)                             │
  │   ├─ accumulate full text                                      │
  │   ├─ persist assistant message (after stream ends)             │
  │   ├─ fire background tasks (summary, memory extraction)        │
  │   └─ done event                                                │
  └─────────────────────────────────────────────────────────────────┘
```

---

## Scope

**In scope:**

- Streaming for context-scoped text-only chat
- SSE delivery with chunk/done/error events
- Persistence after stream completion (including partial on error/disconnect)
- Background tasks after stream completion
- Shared pipeline extraction to avoid code duplication
- Client-side SSE consumer (`apiService.chatStream()`)
- Hook integration (`useNotebookChat` progressive message updates)

**Out of scope (future work):**

- Admin mode streaming (MCP tool calling loop needs different design)
- Multimodal streaming (images/PDFs — falls back to non-streaming endpoint automatically)

---

## Implementation Steps

### Step 1: SSE Helper Utility

**Create** `src/server/payload/endpoints/agent/chat/sse-helpers.ts`

Small pure utility — no dependencies, easy to test:

- `formatSSEMessage(event, data)` → `Uint8Array` formatted as `event: ...\ndata: ...\n\n`
- `createSSEHeaders()` → Headers with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`

### Step 2: Extend UnifiedLLMProvider Interface

**Modify** `src/infra/llm/providers/factory.ts`

Add **optional** method to `UnifiedLLMProvider`:

```typescript
generateStreamingChatCompletion?: (input, payload) => Promise<{
  stream: AsyncIterable<{ text: string }>
  response: Promise<{ text: string }>
}>
```

Optional (`?`) so existing providers aren't broken.

### Step 3: Implement Streaming in Genkit Adapter

**Modify** `src/infra/llm/genkit/adapters/unified-adapter.ts`

Add `generateStreamingChatCompletion` implementation:

1. Same config resolution and prompt building as `generateChatCompletion`
2. Call `ai.generateStream({ model, prompt })` instead of `ai.generate()`
3. Return `{ stream, response }` — stream is an async generator mapping Genkit chunks to `{ text }` objects
4. **No retry wrapper** — retrying a partial stream isn't meaningful. Errors propagate to the SSE handler.

### Step 4: Add Streaming Chat Service Function

**Modify** `src/infra/llm/services/exercise-chat-service.ts`

Add `streamChatWithExerciseHelper(input, payload)` alongside existing `chatWithExerciseHelper`:

- Same prompt-building logic (extract system prompt, build messages from `composedPrompt`)
- Calls `adapter.generateStreamingChatCompletion()` instead of `adapter.generateChatCompletion()`
- Returns `{ stream, response }` for the endpoint to consume
- Throws if adapter doesn't support streaming

### Step 5: Extract Shared Pipeline

**Create** `src/server/payload/endpoints/agent/chat/pipeline.ts`

Extract the pre-LLM pipeline from `handleContextScopedChat` in `src/server/payload/endpoints/agent/chat.ts` (lines 399-548):

```typescript
export async function runChatPipeline(req, requestId, validated, contextCandidate, reqLogger)
  → ChatPipelineResult | Response
```

Returns either:

- `ChatPipelineResult` with `{ conversationId, context, allMessages, composedPrompt, memoryResult, conversation }` — on success
- `Response` — on any validation/access error (4xx)

Both `handleContextScopedChat` (existing) and the new streaming handler call this shared function. This avoids duplicating ~150 lines of pipeline code.

**Also modify** `src/server/payload/endpoints/agent/chat.ts` to use `runChatPipeline` in `handleContextScopedChat`.

### Step 6: Create Streaming Endpoint Handler

**Create** `src/server/payload/endpoints/agent/chat-stream.ts`

Core handler `agentChatStream(req)`:

1. Auth check (same as `chat.ts`)
2. Parse/validate request
3. Reject admin mode → 400
4. Reject media attachments → 400
5. Call `runChatPipeline()` for shared pipeline
6. Call `streamChatWithExerciseHelper()` for the streaming LLM call
7. Construct `ReadableStream` that:
   - Iterates `for await (const chunk of stream)`
   - Enqueues SSE `chunk` events
   - Accumulates full text in local variable
   - After loop: persists assistant message, fires background tasks, enqueues `done` event
   - On error: persists partial text (if any), enqueues `error` event
   - On cancel (client disconnect): sets flag, loop breaks, persists partial text
8. Return `new Response(sseStream, { headers: createSSEHeaders() })`

### Step 7: Create Next.js API Route

**Create** `src/app/api/agent/chat/stream/route.ts`

Follows exact pattern of existing route (`src/app/api/agent/chat/route.ts`):

- Parse body, validate context, get payload, auth
- Reject `mediaIds` with 400
- Construct `PayloadRequest`-like object
- Call `agentChatStream()`
- Return the SSE Response

### Step 8: Update Barrel Export

**Modify** `src/server/payload/endpoints/agent/chat/index.ts` — add `pipeline` export.

### Step 9: Add SSE Client to API Service

**Modify** `src/server/services/api/api-service.ts`

Add `chatStream()` method (~30 lines):

- Calls `fetch('/api/agent/chat/stream', { method: 'POST', ... })` with same body as `chat()`
- Reads the SSE response via `response.body.getReader()` + `TextDecoder`
- Parses SSE events line-by-line (splits on `event:` and `data:` lines)
- Returns an async generator yielding typed events: `{ type: 'chunk', text }`, `{ type: 'done', conversationId, contextKey }`, `{ type: 'error', error }`
- Falls back: if response is not SSE (e.g. JSON error), parses as JSON and throws

### Step 10: Update useNotebookChat Hook for Streaming

**Modify** `src/ui/web/chat/hooks/useNotebookChat.ts`

Change `sendMessage()` (~40 lines modified):

- **If no media attached**: use `apiService.chatStream()` instead of `apiService.chat()`
  1. Append user message to state (same as now)
  2. Immediately append an empty assistant message: `{ role: Assistant, content: '' }`
  3. Iterate over the async generator from `chatStream()`
  4. On each `chunk` event: update the last message's content by appending `chunk.text` via `setMessages(prev => ...)`
  5. On `done` event: streaming complete, set `isLoading = false`
  6. On `error` event: show toast, set `isLoading = false`
- **If media attached**: fall back to existing `apiService.chat()` (non-streaming, unchanged)
- No changes to `handleQuickAction`, `handleReset`, history loading, or any other function

**No component changes needed** — `ChatInterface` and `ChatMessageContent` already render from the `messages` state array. React re-renders automatically as the last message's content grows. The markdown renderer handles partial content fine.

---

## Persistence Strategy

| Phase                     | Action                                                          |
| ------------------------- | --------------------------------------------------------------- |
| Before stream starts      | User message persisted (same as non-streaming)                  |
| During stream             | Nothing persisted — accumulating text only                      |
| Stream completes normally | Full text persisted as assistant message                        |
| Stream errors mid-way     | Partial text persisted (if non-empty)                           |
| Client disconnects        | Partial text persisted (if non-empty)                           |
| After persistence         | Background tasks fired (summary maintenance, memory extraction) |

---

## Error Handling

| Error Type                          | Response                                   |
| ----------------------------------- | ------------------------------------------ |
| Auth failure (pre-stream)           | `401 JSON`                                 |
| Validation failure (pre-stream)     | `400 JSON`                                 |
| Context/access failure (pre-stream) | `403/404 JSON`                             |
| Streaming not supported by provider | `500 JSON` (before SSE starts)             |
| LLM error during stream             | SSE `error` event + persist partial        |
| Client disconnect                   | Persist partial, no event (client is gone) |
| Persistence failure after stream    | Logged as warning, `done` event still sent |

---

## Files Summary

### Backend (Steps 1-8)

| File                                                     | Action | Size Estimate                 |
| -------------------------------------------------------- | ------ | ----------------------------- |
| `src/server/payload/endpoints/agent/chat/sse-helpers.ts` | CREATE | ~30 lines                     |
| `src/infra/llm/providers/factory.ts`                     | MODIFY | ~10 lines added               |
| `src/infra/llm/genkit/adapters/unified-adapter.ts`       | MODIFY | ~30 lines added               |
| `src/infra/llm/services/exercise-chat-service.ts`        | MODIFY | ~40 lines added               |
| `src/server/payload/endpoints/agent/chat/pipeline.ts`    | CREATE | ~100 lines (extracted)        |
| `src/server/payload/endpoints/agent/chat.ts`             | MODIFY | Refactor to use `pipeline.ts` |
| `src/server/payload/endpoints/agent/chat-stream.ts`      | CREATE | ~120 lines                    |
| `src/app/api/agent/chat/stream/route.ts`                 | CREATE | ~50 lines                     |
| `src/server/payload/endpoints/agent/chat/index.ts`       | MODIFY | 1 line added                  |

### UI (Steps 9-10)

| File                                       | Action | Size Estimate     |
| ------------------------------------------ | ------ | ----------------- |
| `src/server/services/api/api-service.ts`   | MODIFY | ~30 lines added   |
| `src/ui/web/chat/hooks/useNotebookChat.ts` | MODIFY | ~40 lines changed |

---

## Verification

1. **Manual test (backend)**: `curl -N -X POST http://localhost:3000/api/agent/chat/stream` with auth cookie and valid body — observe SSE events streaming in real-time
2. **Manual test (UI)**: Open chat in browser, send a text message — tokens should appear progressively instead of all-at-once
3. **Media fallback**: Attach an image and send — should use non-streaming endpoint, behavior unchanged
4. **Persistence check**: After stream completes, verify assistant message exists in conversation document via admin panel or DB query
5. **Error path**: Send request without auth → get 401 JSON. Send with `mediaIds` via stream endpoint → get 400 JSON.
6. **Disconnect test**: Start stream, kill curl mid-way, verify partial text persisted in conversation
7. **Existing endpoint**: Verify `POST /api/agent/chat` still works exactly as before (no regression)
8. **Quality gates**: `pnpm typecheck && pnpm lint && pnpm test:int`

---

## Implementation Order

```
Backend:
 1. sse-helpers.ts            (no deps, pure utility)
 2. factory.ts                (interface change, non-breaking)
 3. unified-adapter.ts        (implement streaming)
 4. exercise-chat-service.ts  (add streaming service fn)
 5. pipeline.ts               (extract shared pipeline)
 6. chat.ts                   (refactor to use pipeline.ts)
 7. chat-stream.ts            (core streaming handler)
 8. chat/stream/route.ts      (Next.js route wiring)
 9. chat/index.ts             (barrel export)

UI:
10. api-service.ts            (SSE client consumer)
11. useNotebookChat.ts        (progressive message updates)
```
