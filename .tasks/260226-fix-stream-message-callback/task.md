# Task

## Issue Title

[MEDIUM] Perf: streamMessage not wrapped in useCallback — causes unnecessary re-renders
## Description
In `useNotebookChat`, the `streamMessage` function (line 446) is a bare `async` arrow function not wrapped in `useCallback`. It is listed as a dependency of `injectExerciseContext` (line 689), causing that callback to re-create on every render, defeating memoization.

## Files Affected
- `src/ui/web/chat/hooks/useNotebookChat.ts` — line 446 (definition), line 689 (dependency array)

## Current Code
```tsx
// Line 446 — NOT memoized, recreated every render
const streamMessage = async (...) => { ... }

// Line 689 — depends on streamMessage, so also recreated every render
const injectExerciseContext = useCallback((...) => {
  // uses streamMessage
}, [streamMessage, ...otherDeps])
```

## Expected Fix
```tsx
const streamMessage = useCallback(async (...) => {
  // ... existing logic
}, [apiService, setMessages, scrollToBottom, /* other stable deps */])
```

## ESLint Warning
This is the `react-hooks/exhaustive-deps` warning on line 689.

## Priority
MEDIUM — Performance bug causing unnecessary re-renders in chat components
