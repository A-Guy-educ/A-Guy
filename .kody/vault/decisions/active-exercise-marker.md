---
title: Active Exercise Marker
type: decision
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1479
---

# Active Exercise Marker

**Status:** Implemented — PR #1479

## Decision

When the lesson context path is active (`extractContextCandidate` resolved to `lessonId`), the `exerciseId` from the page is threaded through as `activeExerciseId` so the model receives a clear "currently active exercise" section.

## Rationale

`extractContextCandidate` prefers `lessonId` over `exerciseId`. When the page sends both (which it always does during normal navigation), the request goes through the lesson path. Without an active exercise marker, the model anchored on the most recent hidden context-injection in chat history — typically the *previous* exercise the student just chatted about.

## Mechanism

`validated.exerciseId` is passed to `fetchLessonContextForContext` as `activeExerciseId`. When set, that exercise is fetched and appended to `lessonContextBlock`:

```
## Currently Active Exercise (authoritative — ignore earlier exercise context in chat history)
### Active Exercise Details
Title: …
Body: …
### Sub-question 1 …
### Sub-question 2 …
```

The "authoritative" header tells the model to treat this section as ground truth even when chat history mentions earlier exercises.

## Files Changed

- `prompt-composition.ts` — reads `activeExerciseId`, fetches and formats the exercise
- `pipeline.ts` — passes `validated.exerciseId`
- `chat.ts` — passes `validated.exerciseId`
- `chat-debug-prompt.ts` — passes `exerciseId` from request
- `diag-debug-prompt.ts` — same plumbing for local audits

## Related

- [Chat System Architecture](../architecture/chat-system.md)
- [Lesson Blocks as Exercise Source](lesson-blocks-as-exercise-source.md)
