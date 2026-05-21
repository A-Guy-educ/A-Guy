---
title: Lesson Context Flow
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1450
  - https://github.com/A-Guy-educ/A-Guy/pull/1479
  - src/server/services/lesson-context/prompt-composition.ts
---

# Lesson Context Flow

## Overview

Lesson context flows from page parameters → `fetchLessonContextForContext` → `composeFullSystemInstructions` → model.

## Entry Points

| Entry | Parameters | Path |
|-------|------------|------|
| Lesson page | `lessonId` | `fetchLessonContext` |
| Exercise page | `lessonId` + `exerciseId` | `fetchExerciseLessonContext` |

## Context Data Shape

```typescript
interface LessonContext {
  lessonContextBlock?: string   // Markdown block for system prompt
  lessonContextText?: string    // Text version
  exercises?: Exercise[]         // Curated exercises from lesson.blocks
  course?: Course
  lesson?: Lesson
}
```

## Context Building

1. `fetchLessonContext` (lesson path):
   - Find lesson by ID (include `title`, `type`, `chapter`)
   - Look up chapter → course
   - Call `buildLessonContextBlock(lesson, chapter, course)`

2. `fetchExerciseLessonContext` (exercise path):
   - Find exercise by ID
   - Look up lesson → chapter → course
   - Call `buildLessonContextBlock` with `activeExerciseId`

3. Source exercises via [exercise-sourcing](./exercise-sourcing.md)

## Active Exercise Marker

When `activeExerciseId` is set, `buildLessonContextBlock` appends:

```
## Currently Active Exercise (authoritative — ignore earlier exercise context in chat history)
### Active Exercise Details
Title: {exercise.title}
Body: {exercise.content}
```

This prevents the model from anchoring on previous exercise context in chat history.

## Pipeline Threading

- `pipeline.ts` (streaming): threads `lessonContext.lessonContextBlock`, `lessonContext.lessonContextText`, `lessonContext.exercises`
- `chat.ts` (non-streaming): same threading
- Both must pass these values or text-only chats receive only metadata

## Common Bug Pattern

`select` clause excluding `title`/`chapter`/`type` → `buildLessonContextBlock` has nothing to render → returns `undefined` → lesson context block empty.

## Related

- [chat-system-prompt-architecture](./chat-system-prompt-architecture.md)
- [exercise-sourcing](./exercise-sourcing.md)
