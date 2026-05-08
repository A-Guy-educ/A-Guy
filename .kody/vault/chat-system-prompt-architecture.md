---
title: Chat System Prompt Architecture
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1473
  - https://github.com/A-Guy-educ/A-Guy/pull/1474
  - https://github.com/A-Guy-educ/A-Guy/pull/1476
  - https://github.com/A-Guy-educ/A-Guy/pull/1477
  - https://github.com/A-Guy-educ/A-Guy/pull/1479
  - https://github.com/A-Guy-educ/A-Guy/pull/1482
  - docs/audits/2026-05-07-chat-system-prompt-audit.md
---

# Chat System Prompt Architecture

## Overview

The chat system composes system prompts from multiple sources: admin Prompt documents, teacher profiles, lesson/exercise context, and policy metadata. After a multi-round audit (2026-05-07), several data correctness issues were fixed.

## Audit Findings (F1-F5)

| Finding | Description | Severity |
|---------|-------------|----------|
| F1 | `select` clause stripped `title`/`chapter` → empty lessonContextBlock | HIGH |
| F2 | Exercises pulled from reverse `Exercise.lesson` lookup, not `lesson.blocks[]` | HIGH |
| F3 | Exercises returned in arbitrary order | MEDIUM |
| F4 | 14,751-char system prompt with no size budget | MEDIUM |
| F5 | Solution/answer fields potentially leaked via `formatExerciseContent` | HIGH (false alarm) |

## Key Design Decisions

### Exercise Sourcing: lesson.blocks

**Always source exercises from `lesson.blocks[]`**, not reverse `Exercise.lesson` lookup.

- `lesson.blocks` stores textarea JSON with exercise references in author-curated order
- Reverse lookup pulls orphans, drafts, and explanation pages incorrectly
- See [exercise-sourcing](./exercise-sourcing.md)

### Lesson Context Block

When no admin Prompt is linked, `buildLessonContextBlock` injects:

```
## Current Lesson
Course: {course}
Chapter: {chapter}
Lesson: {title}
Type: {type}
```

### Active Exercise Marker

When `activeExerciseId` is provided, append:

```
## Currently Active Exercise (authoritative — ignore earlier exercise context in chat history)
### Active Exercise Details
Title: ...
Body: ...
```

The "authoritative" header tells the model to treat this section as ground truth even when chat history mentions earlier exercises.

### Size Budgets

- `EXERCISE_CONTENT_BUDGET`: 400 chars per exercise (truncated with `…(truncated)`)
- `EXERCISES_SECTION_BUDGET`: 4000 chars total (remaining exercises listed by title only)

Target: reduce system prompt from ~14,751 to ~7,600 chars.

### Image Handling Gate

`IMAGE_HANDLING_INSTRUCTIONS` are gated on `hasImageAttached` (non-empty `mediaIds` or `chatAssetIds`). Prevents model from anchoring on image rejection rules for text-only questions.

### Exercises Order

Curated order from `lesson.blocks[]` (e.g., `הסבר-1, הסבר-2, 1, 2, 3, ..., 29`) — matches student-visible order on lesson page.

## Debug Endpoint

`POST /api/agent/chat/debug-prompt` (admin-only) returns composed system prompt without calling LLM. Essential for auditing what actually reaches the model.

See [debug-prompt-endpoint](./debug-prompt-endpoint.md)

## Related

- [lesson-context-flow](./lesson-context-flow.md)
- [exercise-sourcing](./exercise-sourcing.md)
