# Codebase Context: 260313-auto-593

## Files to Modify
- `src/ui/web/chat/hooks/useNotebookChat.ts` (lines 148-154) — Add useEffect that scrolls to bottom when isLoadingHistory transitions to false
- `tests/unit/hooks/useNotebookChat.test.ts` (add new test) — Add reproduction test for scroll-after-history-load
- `tests/e2e/lesson-chat-history.e2e.spec.ts` (add new test) — Add E2E scroll verification test

## Files to Read (reference patterns)
- `src/ui/web/chat/ChatInterface/index.tsx` — How messages are conditionally rendered based on isLoadingHistory (line 408)
- `src/ui/web/chat/hooks/useNotebookChat.ts` — Current scroll logic (lines 141-154), history loading (lines 156-341)
- `tests/unit/hooks/useNotebookChat.test.ts` — Existing test patterns (renderHook, waitFor, mock setup)
- `tests/e2e/lesson-chat-history.e2e.spec.ts` — E2E test patterns (auth helpers, chat helpers, selectors)

## Key Signatures
- `scrollToBottom: () => void` — callback from `useNotebookChat.ts` line 141-146
- `messagesContainerRef: React.RefObject<HTMLDivElement>` — line 81
- `messagesEndRef: React.RefObject<HTMLDivElement>` — line 82
- `isLoadingHistory: boolean` — state, line 91
- `messages: ChatMessage[]` — state, line 86
- `setMessages(loadedMessages)` — called on line 264 during history load
- `setIsLoadingHistory(false)` — called on line 271 (inside double rAF) and other places

## Reuse Inventory
- `scrollToBottom` from `useNotebookChat.ts` — existing callback, reuse for the new effect
- `requestAnimationFrame` — already used in codebase for DOM timing (lines 151, 269-270)
- `apiService.getConversation` mock from existing tests — reuse mock pattern
- `renderHook` / `waitFor` from `@testing-library/react` — existing test pattern

## Integration Points
- `ChatInterface` renders messages only when `!isLoadingHistory` (line 408) — this is WHY the scroll must happen AFTER isLoadingHistory becomes false
- The existing `useEffect` on `[messages, scrollToBottom]` must remain for real-time scroll during conversation
- The new effect should be additive (no existing logic removed)

## Imports Verified
- `@/ui/web/chat` → exports `useNotebookChat` ✅
- `@/server/services/api/api-service` → exports `apiService` ✅
- `@/infra/llm/chat-message-role` → exports `ChatRole` ✅
- `@testing-library/react` → exports `renderHook`, `waitFor`, `act` ✅
- `vitest` → exports `describe`, `it`, `expect`, `vi`, `beforeEach` ✅
