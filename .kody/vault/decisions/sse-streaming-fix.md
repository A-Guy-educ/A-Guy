---
title: SSE Streaming Parser Fix
type: decision
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1455
---

# SSE Streaming Parser Fix

**Status:** Implemented — PR #1455, closes #1452

## Symptom

Student chat streamed the first token repeated (e.g., `"אאא…"`) instead of the full reply. Admin chat was unaffected because it bypasses streaming.

## Root Cause

In `apiService.chatStream`, the SSE parser used `lines.indexOf(line) + 1` to find each event's data line — which **always returns the first occurrence**. When multiple `event: chunk` messages arrived in a single `reader.read()` flush (the normal case for fast token streaming), every iteration read back the first chunk's data.

The same loop also silently dropped events whose `event:` and `data:` lines arrived in different flushes.

## Fix

Split the buffer on the SSE `"\n\n"` message terminator and delegate parsing to the existing, tested `parseSSEData` helper in `sse-helpers.ts`. Trailing partials stay in the buffer until the next read.

## Regression Tests Added

1. **Multi-event single flush** — three `event: chunk` messages in one buffer must yield three distinct texts. Old code yielded the first text three times.
2. **Event/data split across reads** — `event:` and `data:` lines arriving in separate flushes must still produce the chunk. Old code silently dropped it.
