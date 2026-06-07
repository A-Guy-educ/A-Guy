# Merge Conflict Resolution: PR #1873

## File resolved
`src/ui/web/chat/hooks/useNotebookChat.ts`

## What the conflict was
The PR branch (`1849-p2-ask-page-never-finishes-loading-stuck-on-loadin`) and `origin/dev` both modified the `loadConversationHistory` function. HEAD had a simple approach (just `setMessages(loadedMessages)`), while origin/dev added a full retry loop with exponential backoff to handle the case where the conversation document exists but messages haven't persisted to MongoDB yet.

## How it was resolved
Took `origin/dev` for the conflict region because it contains the actual fix for the "stuck on loading" bug — the retry mechanism with exponential backoff and double-rAF DOM readiness pattern.

The `createdAt: new Date().toISOString()` additions from HEAD (on userMessage, streaming placeholder, and assistantMessage) were preserved as they fall outside the conflict region.

## Key elements preserved from dev
- `while (attempt <= maxRetries)` retry loop
- `retryDelayMs = 500`, `maxRetries = 10`
- Exponential backoff: `delay = retryDelayMs * Math.min(attempt, 3)`
- Double rAF pattern to ensure loading indicator hides only after messages are in DOM
- `createdAt: raw.createdAt` in loadedMessages mapping
