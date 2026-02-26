# Implementation Plan

## Step 1: Add useCallback wrapper to streamMessage
**File**: `src/ui/web/chat/hooks/useNotebookChat.ts`
**Line**: ~446

Change:
```tsx
const streamMessage = async (...) => { ... }
```

To:
```tsx
const streamMessage = useCallback(async (...) => {
  // ... existing logic
}, [apiService, setMessages, scrollToBottom, /* other stable deps */])
```

## Step 2: Verify ESLint warning resolved
Run ESLint to confirm the `react-hooks/exhaustive-deps` warning on line 689 is resolved.
