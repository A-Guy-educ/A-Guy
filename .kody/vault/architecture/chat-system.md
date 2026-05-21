---
title: Chat System Architecture
type: architecture
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1479
  - https://github.com/A-Guy-educ/A-Guy/pull/1473
  - https://github.com/A-Guy-educ/A-Guy/pull/1474
  - https://github.com/A-Guy-educ/A-Guy/pull/1476
  - https://github.com/A-Guy-educ/A-Guy/pull/1450
  - https://github.com/A-Guy-educ/A-Guy/pull/1466
---

# Chat System Architecture

The student chat system uses a pipeline that composes a system prompt from multiple sources and streams responses via SSE.

## Prompt Composition Order

The system prompt is built in this order (from `prompt-composer.server.ts`):

1. **System prompts** — admin-defined Prompt documents, joined with separator
2. **Teacher profile** — injected into system role, not stored in conversation
3. **Lesson prompt template** — resolved from course/lesson hierarchy
4. **Lesson/exercise context block** — fallback metadata about what the student is currently on
5. **Math formatting instructions** — always appended
6. **Image handling instructions** — **only when `hasImageAttached: true`**

## Context Resolution

`extractContextCandidate` receives `lessonId` and `exerciseId` from the page. It **prefers `lessonId`** — so any page that sends both will route through the lesson path.

This means:
- Lesson-scoped chats get full lesson context + exercise list + the **active exercise marker**
- Exercise-scoped chats get exercise body + parent lesson context

## Key Files

| File | Role |
|------|------|
| `prompt-composition.ts` | Fetches context, builds `lessonContextBlock`, exposes `fetchLessonContextForContext` |
| `prompt-composer.server.ts` | Composes the final system instruction string from all blocks |
| `pipeline.ts` | Orchestrates streaming path |
| `chat.ts` | Orchestrates non-streaming path |
| `chat-debug-prompt.ts` | Admin-only endpoint returning the composed prompt without calling LLM |

## Critical Invariants

- **`lessonContextBlock` must contain `title`, `chapter`** — see [F1 audit finding](./debug-prompt.md#f1-lessoncontextblock-empty-for-lesson-path)
- **Exercises come from `lesson.blocks[]`**, not `Exercise.lesson` reverse lookup — see [lesson blocks decision](../decisions/lesson-blocks-as-exercise-source.md)
- **Active exercise marker is threaded through** when the page sends `exerciseId` alongside `lessonId` — see [active exercise decision](../decisions/active-exercise-marker.md)
- **Image handling block is gated** on `hasImageAttached` — see [#1459](https://github.com/A-Guy-educ/A-Guy/pull/1459)

## Related

- [Chat Debug Prompt Runbook](../runbooks/chat-debug-prompt.md) — how to inspect composed prompts locally and in production
- [Lesson Blocks as Exercise Source Decision](../decisions/lesson-blocks-as-exercise-source.md)
- [Active Exercise Marker Decision](../decisions/active-exercise-marker.md)
- [Exercise Section Size Budgeting](./exercise-section-sizing.md)
