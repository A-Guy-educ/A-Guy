# Fix for Issue #1849: Ask page stuck on "Loading..."

## What was changed

**File**: `src/ui/web/chat/hooks/useNotebookChat.ts`

**Root cause**: The `loadConversationHistory` function had a retry loop (up to 10 retries, ~11 seconds) for the case where a conversation exists but all messages were filtered out as invalid (e.g., empty content, wrong role, hidden). During this retry window, the user saw "Loading history..." indefinitely.

**Fix**: Removed the retry loop. When a conversation exists but has no valid messages after filtering, the code now immediately calls `setIsLoadingHistory(false)` and shows the chat UI. The rationale: if the conversation document exists and messages were filtered, additional retries won't help — the messages are legitimately invalid.

## Key code change

The `while (attempt <= maxRetries)` retry loop was removed entirely. The conversation loading now processes in a single API call:

1. If auth required → set `isLoadingHistory(false)` immediately
2. If conversation exists with valid messages → load messages and set `isLoadingHistory(false)` immediately  
3. If conversation exists but no valid messages → set `isLoadingHistory(false)` immediately (no retry)
4. If conversation doesn't exist → set `isLoadingHistory(false)` immediately
5. If API fails → set `isLoadingHistory(false)` immediately

This eliminates the up-to-11-second delay that caused the "Loading..." stuck state.

## Tests

- All 13 unit tests for `useNotebookChat` pass
- All 3264 unit tests pass
- Typecheck and lint pass

## Verification

Run: `pnpm exec vitest run tests/unit/hooks/useNotebookChat.test.ts --config ./vitest.config.unit.mts`
