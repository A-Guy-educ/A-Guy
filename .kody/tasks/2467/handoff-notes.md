## Bug: Chat send fails with HTTP 400 on mobile (issue #2467)

### Root Cause
`AgentChatWindow` and `useLearningAgentChat` both sent `conversationId: null` in the JSON request body when there was no active conversation (first message). The Zod schema in `learning-chat.ts` defines `conversationId: z.string().optional()`, which accepts `undefined` but NOT `null`. When JSON.parse parses `"conversationId": null`, it produces `null` — Zod's `.optional()` rejects this with "Invalid input: expected string, received null".

### Fix
Changed the request body construction in both files to conditionally include `conversationId` only when it has a truthy value:

```typescript
// Before (broken):
body: JSON.stringify({ message, acknowledgment, conversationId, gradeLevel })

// After (fixed):
body: JSON.stringify({ message, acknowledgment, ...(conversationId && { conversationId }), gradeLevel })
```

When `conversationId` is `null`, the spread evaluates to nothing and the key is omitted from the JSON — which Zod's `.optional()` accepts.

### Files Changed
- `src/ui/web/learning-agent/AgentChatWindow/index.tsx` — fixed handleSend request body
- `src/ui/web/learning-agent/hooks/useLearningAgentChat.ts` — fixed sendMessage request body

### Test Added
- `tests/int/learning-chat-endpoint.int.spec.ts` — verifies the null-vs-omitted behavior

### Why it manifested on mobile specifically
The bug was actually present on all viewports. The QA report may have only tested mobile. The `AgentChatWindow` is rendered via `FloatingAgentButton` in `LayoutClient` (layout-level), so it's available on all pages including `/account`.
