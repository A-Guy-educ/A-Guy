# Plan: Exercise Context Injection

**Task ID:** `260217-exercise-context-injection`
**Created:** 2026-02-17
**Status:** Ready for Implementation

---

## Overview

Inject exercise content into chat conversations so the AI has contextual awareness when helping students. Also enhance answer validation with question type metadata for type-specific evaluation.

**Time Estimate:** ~2.5 hours (7 implementation steps)

---

## Quick Reference

| Step | Description                              | Time   | Files                                                                                  |
| ---- | ---------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| 1    | `formatExerciseContextMessage()` utility | 15 min | NEW: `src/infra/llm/exercise-context.ts`                                               |
| 2    | `injectExerciseContext()` in hook        | 20 min | MODIFIED: `useNotebookChat.ts`                                                         |
| 3    | Trigger on exercise navigation           | 20 min | MODIFIED: `ChatInterface.tsx`, `ExercisesPager/index.tsx`                              |
| 4    | Verify coexistence with incorrect-answer | 15 min | TESTS only                                                                             |
| 5    | Enhanced answer validation endpoint      | 25 min | MODIFIED: `validate-answer.ts`, `answer-validation-service.ts`, `answer-validation.ts` |
| 6    | Frontend sends question metadata         | 15 min | MODIFIED: `answerChecking.ts`                                                          |
| 7    | E2E integration test                     | 20 min | NEW: `tests/int/exercise-context-injection.int.spec.ts`                                |

---

## Detailed Steps

### Step 1: Create `formatExerciseContextMessage()` utility

**Why:** The LLM needs exercise content in a structured, readable format — not raw JSON.

**Output:** `src/infra/llm/exercise-context.ts`

**Behavior:**

- Converts `ContentData` → readable text with delimiters
- Strips solutions and correct answers (prevent leakage)
- Includes hints (helps LLM guide student)
- Caps at 2000 characters

**Format:**

```
[EXERCISE CONTEXT]
Exercise: "{title}"

Content Blocks:
1. [RichText] {preview}...
2. [Question: MCQ] {prompt} | Options: A, B, C | Hint: {hint}
3. [Question: FreeResponse] {prompt} | Accepted: 3 answer(s)
...

[END EXERCISE CONTEXT]
```

**Tests:**

- All 10 block types formatted correctly
- Correct answers never included
- Output capped at 2000 chars

---

### Step 2: Add `injectExerciseContext()` to hook

**Why:** The frontend needs a way to inject exercise context when navigating to an exercise.

**Output:** `src/ui/web/chat/hooks/useNotebookChat.ts` (modified)

**Behavior:**

- New method: `injectExerciseContext(exercise, mediaMap)`
- Calls `formatExerciseContextMessage()` to build text
- Sends via `streamMessage(prompt, acknowledgment, context, { hidden: true })`
- Deduplicates: skips if same exerciseId already injected

**Code pattern:**

```typescript
const injectExerciseContext = useCallback(
  async (exercise, mediaMap) => {
    if (lastInjectedExerciseId.current === exercise.id) return
    lastInjectedExerciseId.current = exercise.id

    const formatted = formatExerciseContextMessage(
      exercise.title,
      exercise.content.blocks,
      mediaMap,
    )
    const prompt = `The student is now viewing: ${formatted}`
    await streamMessage(prompt, acknowledgment, context, { hidden: true })
  },
  [streamMessage],
)
```

---

### Step 3: Trigger on exercise navigation

**Why:** Connect the hook to the exercise page.

**Output:**

- `src/ui/web/chat/ChatInterface/index.tsx` (modified)
- `src/app/(frontend)/.../ExercisesPager/index.tsx` (modified)

**Behavior:**

- `ChatInterface` receives new props: `currentExercise`, `mediaMap`
- `useEffect` on mount + `currentExercise.id` change → call `injectExerciseContext()`
- `ExercisesPager` passes current exercise to `ChatInterface`

---

### Step 4: Verify coexistence with incorrect-answer

**Why:** EC-04 requires the existing `exercise-incorrect-answer` flow to continue working.

**Output:** Integration tests in `tests/int/agent-chat-streaming.int.spec.ts`

**Verification:**

- Both hidden messages (exercise context + incorrect-answer) coexist
- LLM receives both in prompt
- Client sees only visible AI response

---

### Step 5: Enhanced answer validation

**Why:** AV-01/AV-02 — different question types need different validation rules.

**Outputs:**

- `src/server/payload/endpoints/exercises/validate-answer.ts` (modified)
- `src/infra/llm/services/answer-validation-service.ts` (modified)
- `src/infra/llm/prompts/answer-validation.ts` (modified)

**Changes:**

- Zod schema: add `questionType?: string`, `questionVariant?: string`
- LLM prompt: add type-specific rules section
- Backward compatible: fields optional

**Type-Specific Rules:**

```
Numeric: Accept 3.14 ≈ π, 1/2 = 0.5
Algebraic: Accept 2x = x+x = 2*x
Text: Focus on meaning, not exact phrasing
Table: Each cell evaluated independently
Matching: All pairs must match
```

---

### Step 6: Frontend sends question metadata

**Why:** AV-01 — frontend must send question type for enhanced validation.

**Output:** `src/ui/web/exerciserenderer/utils/answerChecking.ts` (modified)

**Changes:**

- `validateFreeResponseOnServer()` adds `questionType` and `questionVariant` to request body
- No function signature change (already has question block)

---

### Step 7: E2E integration test

**Why:** Validate the full flow works end-to-end.

**Output:** `tests/int/exercise-context-injection.int.spec.ts` (NEW)

**Test scenarios:**

1. Context injection → student question → context-aware AI response
2. Exercise A → exercise B → both contexts in conversation
3. Security: hidden messages never leak to client

---

## File Summary

| File                                                        | Change Type | Description                   |
| ----------------------------------------------------------- | ----------- | ----------------------------- |
| `src/infra/llm/exercise-context.ts`                         | NEW         | Context formatting utility    |
| `src/ui/web/chat/hooks/useNotebookChat.ts`                  | MODIFIED    | Add `injectExerciseContext()` |
| `src/ui/web/chat/ChatInterface/index.tsx`                   | MODIFIED    | Trigger context injection     |
| `src/app/(frontend)/.../ExercisesPager/index.tsx`           | MODIFIED    | Pass exercise data            |
| `src/server/payload/endpoints/exercises/validate-answer.ts` | MODIFIED    | Accept question metadata      |
| `src/infra/llm/services/answer-validation-service.ts`       | MODIFIED    | Pass type to LLM              |
| `src/infra/llm/prompts/answer-validation.ts`                | MODIFIED    | Type-specific rules           |
| `src/ui/web/exerciserenderer/utils/answerChecking.ts`       | MODIFIED    | Send question metadata        |
| `tests/unit/infra/llm/exercise-context.spec.ts`             | NEW         | Unit tests for formatter      |
| `tests/int/exercise-context-injection.int.spec.ts`          | NEW         | E2E integration tests         |

---

## Quality Gates

Before marking complete, ensure:

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] All new unit tests pass
- [ ] All new integration tests pass
- [ ] No regressions in existing chat tests
- [ ] No regressions in existing answer validation tests
- [ ] Hidden messages never visible in UI

---

## Rollout Notes

This feature is additive and backward compatible:

- No breaking API changes
- Existing chat flows work unchanged
- New fields are optional

**Recommended rollout:**

1. Deploy backend changes first (steps 1, 5)
2. Verify answer validation still works
3. Deploy frontend changes (steps 2, 3, 6)
4. Feature is immediately active on next exercise navigation
5. No migration or data changes required
