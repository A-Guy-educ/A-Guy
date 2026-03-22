# Plan: Fix Lesson Chat Scroll Position on Load

## Research Findings

- `src/ui/web/chat/hooks/useNotebookChat.ts` ✅ exists — core hook managing chat state, history loading, and scroll behavior
- `src/ui/web/chat/ChatInterface/index.tsx` ✅ exists — UI component that renders messages and consumes the hook
- `tests/unit/hooks/useNotebookChat.test.ts` ✅ exists — existing unit tests for the hook
- `tests/e2e/lesson-chat-history.e2e.spec.ts` ✅ exists — E2E tests for chat history
- `src/ui/web/chat/index.ts` ✅ exists — barrel export for the chat module

**Patterns observed:**
- The hook uses `useRef<HTMLDivElement>` for `messagesContainerRef` and `messagesEndRef`
- `scrollToBottom` uses `container.scrollTop = container.scrollHeight` (line 141-146)
- The scroll effect triggers on `messages` change (lines 149-154)
- History loading sets messages first, then hides loading indicator in a double `requestAnimationFrame` (lines 264-274)
- ChatInterface conditionally renders messages only when `!isLoadingHistory` (line 408)

**Integration points:**
- ChatInterface destructures `messagesContainerRef`, `messagesEndRef`, `isLoadingHistory` from `useNotebookChat`
- The messages area div has `ref={messagesContainerRef}` and messages render inside it only when `!isLoadingHistory`

## Reuse Inventory

- **Existing utilities reused:**
  - `scrollToBottom` callback in `useNotebookChat.ts` (line 141-146) — reuse as-is
  - `messagesContainerRef` — already tracks the scroll container
  - `requestAnimationFrame` pattern — already used in the codebase for DOM timing
- **No new utilities needed** — fix uses existing scroll mechanism

## Root Cause

In `useNotebookChat.ts`, when conversation history is loaded:

1. `setMessages(loadedMessages)` is called (line 264), triggering the `scrollToBottom` effect (lines 149-154).
2. BUT at this point, `isLoadingHistory` is still `true` — it only becomes `false` inside a double `requestAnimationFrame` on lines 269-273.
3. In `ChatInterface`, messages are rendered only when `!isLoadingHistory` (line 408). So when `scrollToBottom` fires, the messages are NOT in the DOM yet.
4. When `isLoadingHistory` finally becomes `false` and messages render, there's no subsequent scroll trigger because `messages` hasn't changed again.

**Result:** The scroll container shows messages starting from the top (first message) because the scroll-to-bottom only ran when the container was empty/showing loading state.

---

### Step 1: Fix scroll-to-bottom after history loads

**Root Cause**: `scrollToBottom` triggers on `messages` change, but loaded messages aren't in the DOM yet because `isLoadingHistory` is still `true` at that point.

**Files to Touch**:

- `src/ui/web/chat/hooks/useNotebookChat.ts` (MODIFIED — lines 148-154)

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL now):

- Test location: `tests/unit/hooks/useNotebookChat.test.ts`
- Test name: `"should scroll to bottom after loading conversation history"`
- What it tests: After history is loaded and `isLoadingHistory` becomes `false`, `scrollToBottom` should be called. Currently, `scrollToBottom` only fires when `messages` changes (before messages are rendered in the DOM).
- Setup: Mock `apiService.getConversation` to return a conversation with multiple messages. Render the hook. After `isLoadingHistory` becomes `false`, verify that `messagesContainerRef.current.scrollTop` was set to `scrollHeight`.
- Why it fails now: The existing `useEffect` on `[messages, scrollToBottom]` fires when `messages` changes, but at that point the container is still showing the loading indicator (messages aren't in DOM). There's no effect that triggers scroll after `isLoadingHistory` transitions to `false`.

**Fix**: Add a second `useEffect` that triggers `scrollToBottom` when `isLoadingHistory` transitions from `true` to `false` AND there are loaded messages. This ensures scrolling happens after the messages are actually rendered in the DOM.

Specifically, modify `src/ui/web/chat/hooks/useNotebookChat.ts`:

1. Add a new `useEffect` after the existing scroll effect (after line 154):
   ```
   // Scroll to bottom after history finishes loading (messages are now in DOM)
   useEffect(() => {
     if (!isLoadingHistory && messages.length > 1) {
       requestAnimationFrame(() => {
         scrollToBottom()
       })
     }
   }, [isLoadingHistory]) // eslint-disable-line react-hooks/exhaustive-deps
   ```
   
   This effect watches `isLoadingHistory`. When it becomes `false` AND there are loaded messages (more than just the welcome message), it scrolls to bottom after the next animation frame (ensuring DOM is updated).

2. The existing scroll effect on `[messages, scrollToBottom]` (lines 149-154) should remain — it handles scrolling for new messages sent/received during the conversation.

**Verification**:

- Run reproduction test → FAILS (scrollToBottom not called after history loads)
- After fix applied → PASSES (scrollToBottom called when isLoadingHistory becomes false)
- Manual verification: Open lesson with chat history → chat scrolls to latest message

**Acceptance Criteria**:

- [ ] When entering a lesson with existing chat history, the chat scrolls to the latest (bottom) message
- [ ] New messages sent during the conversation still auto-scroll to bottom
- [ ] Loading indicator is shown while history loads, then messages render scrolled to bottom
- [ ] The welcome message (single message, no history) does NOT trigger unnecessary scroll
- [ ] No infinite scroll loops — the effect only fires on `isLoadingHistory` transition

---

### Step 2: Add E2E scroll verification test

**Files to Touch**:

- `tests/e2e/lesson-chat-history.e2e.spec.ts` (MODIFIED — add new test case)

**Test**: Add a test that verifies the chat is scrolled to the bottom after history loads.

- Test name: `"should scroll to latest message when re-entering lesson with chat history"`
- Steps:
  1. Authenticate user
  2. Navigate to lesson, send multiple messages to build history
  3. Refresh/re-enter the lesson
  4. Wait for history to load
  5. Verify the last message is visible in the viewport (use `isVisible()` or check scroll position)
  6. Verify the first message is NOT visible (scrolled past)

**Acceptance Criteria**:

- [ ] E2E test passes — chat is scrolled to show latest message after re-entering lesson
- [ ] Test is added to existing `lesson-chat-history.e2e.spec.ts` file
