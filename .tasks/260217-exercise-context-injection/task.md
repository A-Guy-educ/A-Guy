# Task: 260217-exercise-context-injection

## PRD (Product Requirements Document)

**Feature:** Exercise Context Injection for Chat AI

**Problem Statement:**
When a student asks a question in the chat while viewing an exercise, the AI lacks awareness of the specific exercise content. The AI only knows the lesson-level context (title, description), but not:

- The specific question the student is trying to solve
- The question type (MCQ, free response, table, matching, geometry)
- Associated media (images, diagrams)
- Available hints and solutions

This leads to generic AI responses like "I'd need more context about your question" when the student asks for help.

**Requirements:**

### Chat Context Requirements

- EC-01: When a student navigates to an exercise, a hidden message containing the full exercise content is injected into the conversation
- EC-02: Hidden exercise context messages are persisted in the DB but excluded from client-side chat history
- EC-03: Hidden exercise context messages are included in the LLM prompt (via the 20-message recent window)
- EC-04: The existing `exercise-incorrect-answer` pattern continues to work alongside exercise-load injection
- EC-05: When student navigates to a different exercise in the same lesson, a new hidden context message is injected
- EC-06: Exercise context injection is a no-op if the conversation already has a recent hidden context message for the same exerciseId
- EC-07: Exercise context hidden message follows a structured format the LLM can parse (not raw JSON dump)

### Answer Validation Requirements

- AV-01: The answer validation endpoint accepts optional `questionType` and `questionVariant` fields
- AV-02: The answer validation LLM prompt uses question type/variant to apply type-specific evaluation rules
- AV-03: No breaking changes to the existing validation API contract (new fields are optional)

**Acceptance Criteria:**

- [ ] Chat AI responds with context-aware answers when student asks about exercises
- [ ] Hidden messages are never visible in the client chat UI
- [ ] Existing incorrect-answer help flow continues to work
- [ ] Answer validation supports question type-specific rules
- [ ] All existing tests pass

## Metadata

- **ID:** 260217-exercise-context-injection
- **Type:** feat
- **Status:** pending
- **Date:** 2026-02-17
- **Pipeline:** spec → clarify → plan → build → test → verify → auditor → pr

## Implementation Plan Summary

| Step      | Description                                                          | Time           |
| --------- | -------------------------------------------------------------------- | -------------- |
| 1         | Create `formatExerciseContextMessage()` utility                      | 15 min         |
| 2         | Add `injectExerciseContext()` to `useNotebookChat` hook              | 20 min         |
| 3         | Trigger `injectExerciseContext` on exercise navigation               | 20 min         |
| 4         | Verify coexistence with existing `exercise-incorrect-answer` pattern | 15 min         |
| 5         | Enhance answer validation endpoint with question metadata            | 25 min         |
| 6         | Update frontend answer checking to send question metadata            | 15 min         |
| 7         | End-to-end integration test                                          | 20 min         |
| **Total** |                                                                      | **~2.5 hours** |
