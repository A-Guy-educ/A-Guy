---
title: Exercise Section Sizing
type: architecture
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1476
  - https://github.com/A-Guy-educ/A-Guy/pull/1472 (audit F4)
---

# Exercise Section Sizing

**Status:** Implemented — PR #1476

## Problem

The exercises section previously emitted full content for all exercises. For `lesson-1` (31 exercises, many with multi-part question bodies), this produced a ~14,751-character system prompt. That much text diluted Gemini's attention and correlated with wrong-count and lost-context bugs.

## Solution

Two budgets in `buildExercisesSection` (`prompt-composer.server.ts`):

| Budget | Value | Effect |
|--------|-------|--------|
| `EXERCISE_CONTENT_BUDGET` | 400 chars | Per-exercise body truncated with `…(truncated)` marker |
| `EXERCISES_SECTION_BUDGET` | 4,000 chars | Total section. Once exceeded, remaining exercises listed by **title only** |

Title is always present — meta-questions like "what exercises are in this lesson" still answer correctly even when bodies are truncated.

## Result

`lesson-1` system prompt: **14,751 → 7,611 chars (–48%)**. First 22 exercises keep truncated bodies; 23–31 are title-only.

## Related

- [Chat System Architecture](../architecture/chat-system.md)
