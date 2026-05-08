---
title: Debug Prompt Endpoint
type: component
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1466
  - https://github.com/A-Guy-educ/A-Guy/pull/1478
---

# Debug Prompt Endpoint

## Overview

`POST /api/agent/chat/debug-prompt` is an admin-only endpoint that returns the composed system prompt without calling the LLM. Essential for auditing what actually reaches the model.

## Endpoint

```
POST /api/agent/chat/debug-prompt
Authorization: Admin session
```

Accepts same body as `/api/agent/chat` plus optional `debugHistory[]`.

## Returns

```typescript
interface DebugPromptResponse {
  composedSystemMessage: string      // Full system prompt
  composedSystemMessageLength: number
  promptResolution: {
    promptId: string | null
    resolvedFrom: string             // 'admin-prompt' | 'default' | 'fallback'
  }
  teacherProfile?: {
    slug: string
    resolvedFrom: string
  }
  lessonContext: {
    lessonContextBlock: string | null
    exercises: Exercise[]
    lessonContextText: string | null
    coursePromptId: string | null
    lessonPromptId: string | null
  }
  composedPrompt: {
    messages: Message[]
    policyMetadata: PolicyMetadata
  }
  genkitMessages: GenkitMessage[]    // Structured as adapter would emit
}
```

## Why Admin-Only

Output includes teacher-profile templates and exercise hint/solution fields that must not leak to students/guests.

## Local Script

`scripts/diag-debug-prompt.ts` mirrors the endpoint locally:

```bash
pnpm tsx scripts/diag-debug-prompt.ts --lessonId <id>
pnpm tsx scripts/diag-debug-prompt.ts --exerciseId <id> --message "question"
```

No HTTP layer, no admin auth — useful for fast iteration on prompt-composition fixes.

## Usage

1. Open lesson page on dev
2. Copy request body from network tab
3. POST to debug-prompt endpoint
4. Inspect `composedSystemMessage` for correctness

## Related

- [chat-system-prompt-architecture](./chat-system-prompt-architecture.md)
- [lesson-context-flow](./lesson-context-flow.md)
