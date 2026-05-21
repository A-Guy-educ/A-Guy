---
title: SSE Parsing Fix
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1455
  - src/app/(frontend)/api/chat/_apiService/chatStream.ts
---

# SSE Parsing Fix

## Bug

Student chat showed first streamed token repeated (e.g. `"אאא…"`) instead of full reply.

## Root Cause

`apiService.chatStream` SSE parser:

1. Used `lines.indexOf(line) + 1` to find each event's data line → always returns first occurrence
2. When multiple `event: chunk` messages arrived in one `reader.read()` flush, every iteration read the first chunk's data
3. Events whose `event:` and `data:` lines arrived in different flushes were silently dropped

## Fix

1. Split buffer on SSE `"\n\n"` message terminator
2. Delegate parsing to existing `parseSSEData` helper (already tested)
3. Trailing partials stay in buffer until next read

```typescript
// WRONG: indexOf always finds first occurrence
const lines = buffer.split('\n')
for (const line of lines) {
  const idx = lines.indexOf(line) + 1
  const dataLine = lines[idx]
}

// CORRECT: Split on message terminator
const messages = buffer.split('\n\n')
for (const message of messages) {
  const chunks = parseSSEData(message)
}
```

## Tests Added

1. **Multi-event single flush**: Three `event: chunk` in one buffer → three distinct texts
2. **Event/data split across reads**: `event:` and `data:` in separate flushes → chunk produced

## Related

- [chat-streaming](./chat-streaming.md) (if exists)
