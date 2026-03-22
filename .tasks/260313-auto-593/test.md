# Test Agent Report: 260313-auto-593

## Tests Written

- Unit test for scroll-to-bottom after loading conversation history in `useNotebookChat` hook

## Test Files

| File | Test Count | Type |
|------|-----------|------|
| tests/unit/hooks/useNotebookChat.test.ts | 1 | unit |

## Test Cases

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| should scroll to bottom after loading conversation history | unit | When conversation history is loaded and isLoadingHistory becomes false, the chat container should scroll to show the latest message. This test verifies that scrollTop is set to scrollHeight after history loads. |

## Notes

- The fix was already implemented in `src/ui/web/chat/hooks/useNotebookChat.ts` (lines 160-168) with a useEffect that watches `isLoadingHistory` and triggers `scrollToBottom` when it transitions from true to false with loaded messages present.
- The unit test validates this behavior by mocking the API to return conversation history and verifying the scroll position is set correctly after history loads.
- Test uses spy on scrollTop setter to track scroll calls and verify scrollToBottom is invoked with correct scrollHeight value (500).
- The implementation correctly checks `messages.length > 1` to avoid unnecessary scrolling for just the welcome message.
