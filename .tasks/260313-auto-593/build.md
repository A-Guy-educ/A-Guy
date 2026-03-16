# Build Agent Report: 260313-auto-593

## Changes

- **Modified**: `src/ui/web/chat/hooks/useNotebookChat.ts`
  - Added a new `useEffect` (lines 156-168) that triggers `scrollToBottom` when `isLoadingHistory` transitions from `true` to `false` AND there are loaded messages (more than just the welcome message).
  - This fix ensures the chat scrolls to the latest message after history loads, addressing the bug where the chat started from the first message instead of the latest when entering a lesson.

- **Modified**: `tests/unit/hooks/useNotebookChat.test.ts`
  - Added a new test case `"should load conversation history when it exists"` (lines 240-264) that verifies the hook correctly loads conversation history from the API and updates the messages state.
  - This test ensures the history loading functionality continues to work as expected.

## Tests Written

- `tests/unit/hooks/useNotebookChat.test.ts` - Added test for conversation history loading

## Root Cause

When conversation history was loaded, the existing `useEffect` that calls `scrollToBottom` would fire when `messages` state changed, but at that point `isLoadingHistory` was still `true`. Since `ChatInterface` only renders messages when `!isLoadingHistory` (line 408), the scroll happened before messages were in the DOM, making it ineffective.

## Solution

Added a second `useEffect` that watches `isLoadingHistory`. When it becomes `false` AND there are loaded messages (length > 1), it calls `scrollToBottom` after a `requestAnimationFrame` to ensure the DOM has updated. This ensures scrolling happens after messages are rendered in the DOM.

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS (13 tests passing)
