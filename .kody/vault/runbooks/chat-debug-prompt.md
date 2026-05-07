---
title: Chat Debug Prompt Runbook
type: runbook
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1466
  - https://github.com/A-Guy-educ/A-Guy/pull/1478
  - https://github.com/A-Guy-educ/A-Guy/pull/1472 (audit F1)
---

# Chat Debug Prompt Runbook

Use the debug-prompt endpoint to inspect exactly what the model receives, without burning a model call or reading Vercel logs.

## Two Access Points

### 1. Local Script (fastest, no auth)

```bash
# Exercise-scoped
pnpm tsx scripts/diag-debug-prompt.ts --lessonId <id>

# With active exercise marker
pnpm tsx scripts/diag-debug-prompt.ts --lessonId <id> --exerciseId <id>
```

Runs `fetchLessonContextForContext` + `composeFullSystemInstructions` against the local/dev Payload instance. No HTTP, no model call.

Companion: `scripts/diag-exercise-context.ts` — mirrors `fetchExerciseLessonContext` only.

### 2. Production Admin Endpoint

```
POST /api/agent/chat/debug-prompt
```

Admin auth required. Accepts the same body as `/api/agent/chat`. Returns:
- `composedSystemMessage` + length
- `promptResolution` (which Prompt was used, where it resolved from)
- `teacherProfile` (slug + resolvedFrom)
- `lessonContext` (lessonContextBlock, exercises[], lessonContextText)
- `composedPrompt` (recent-window messages + policy metadata)
- `genkitMessages` (structured array as the adapter would emit)

## F1: `lessonContextBlock` Empty for Lesson Path

**Symptom:** `lessonContextBlock: null` for any chat opened on a `/lessons/:slug` page.

**Root cause:** `select` clause in `fetchLessonContext` stripped `title`, `chapter`, `type` — `buildLessonContextBlock` received empty data and returned `undefined`.

**Check:** Look for `lessonContextBlock length: 0` in script output. After fix: `lessonContextBlock length: 222`.

## Canonical Test Lesson

- **Slug:** `lesson-1`
- **ID:** `69a01f6bc774d3c6ad807afd`
- **Name:** דימיון משולשים
- **Course:** כיתה ט, Chapter: משולשים דומים
- **Exercises:** 29 published + 2 explanation pages

## Related

- [Chat System Architecture](../architecture/chat-system.md)
