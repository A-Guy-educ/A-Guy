# Spec: 260217-exercise-context-injection

## Overview

Inject exercise content into chat conversations so the AI has contextual awareness when helping students. Also enhance answer validation with question type metadata for type-specific evaluation.

## Non-Goals

- No changes to conversation scope (remains `lessons:{lessonId}`)
- No new API endpoints (reuse existing chat endpoint with `hidden: true`)
- No schema changes to collections (use existing `hidden` field on messages)
- No changes to the exercise content data model

## Requirements

### Chat Context Requirements

#### EC-01: Exercise Context Injection on Load

**Priority:** MUST
**Description:** When a student navigates to an exercise (page load or pagination), a hidden message containing the full exercise content is injected into the conversation.

**Behavior:**

- Triggered when `currentExercise.id` changes
- Uses existing `agentChatStream` endpoint with `hidden: true`
- Context includes: exercise title, all content blocks (questions + rich text), media references

#### EC-02: Hidden Message Persistence

**Priority:** MUST
**Description:** Hidden exercise context messages are persisted in the database but excluded from client-side chat history responses.

**Behavior:**

- Use existing `hidden` field on `messages` array (Conversations collection, line 181-188)
- `getConversation` endpoint already filters hidden messages (get-conversation.ts, line 182)
- No changes to persistence layer required

#### EC-03: Context Included in LLM Prompt

**Priority:** MUST
**Description:** Hidden exercise context messages are included in the LLM prompt via the existing 20-message recent window.

**Behavior:**

- Existing pipeline preserves hidden messages in `trimMessagesForUpdate` (pipeline.ts, line 47)
- Hidden messages flow into `composePrompt` as regular messages
- No changes to prompt composition required

#### EC-04: Coexistence with Incorrect-Answer Pattern

**Priority:** MUST
**Description:** The existing `exercise-incorrect-answer` CustomEvent flow continues to work alongside exercise-load context injection.

**Behavior:**

- Student opens exercise → hidden context message injected
- Student answers incorrectly → `exercise-incorrect-answer` fires → `sendContextualHelp` sends another hidden message
- Both hidden messages coexist in conversation → LLM has full context
- Only AI response from `sendContextualHelp` is visible

#### EC-05: Context Updates on Navigation

**Priority:** SHOULD
**Description:** When student navigates to a different exercise in the same lesson, a new hidden context message is injected for the new exercise.

**Behavior:**

- Old context stays in conversation history
- Natural 20-message window pushes old context out over time
- No explicit "invalidate old context" message needed

#### EC-06: Context Injection Deduplication

**Priority:** SHOULD
**Description:** Exercise context injection is a no-op if the conversation already has a recent hidden context message for the same exerciseId.

**Behavior:**

- Track last injected `exerciseId` in `useRef`
- Skip injection if `exerciseId` matches last injected
- Reset ref on exercise change

#### EC-07: Structured Context Format

**Priority:** MUST
**Description:** Exercise context hidden message follows a structured format the LLM can parse (not raw JSON dump).

**Behavior:**

- Use delimiter-based format: `[EXERCISE CONTEXT]...[/EXERCISE CONTEXT]`
- Strip solutions and correct answers (prevent leakage via chat)
- Include hints (helps LLM guide student)
- Cap output at 2000 characters

### Answer Validation Requirements

#### AV-01: Question Metadata in Validation

**Priority:** SHOULD
**Description:** The answer validation endpoint accepts optional `questionType` and `questionVariant` fields.

**Behavior:**

- Zod schema: `questionType?: z.string()`, `questionVariant?: z.string()`
- Fields are optional for backward compatibility
- Existing callers work unchanged

#### AV-02: Type-Specific Validation Rules

**Priority:** SHOULD
**Description:** The answer validation LLM prompt uses question type/variant to apply type-specific evaluation rules.

**Behavior:**

- Numeric: Accept equivalent forms (3.14 ≈ π, 1/2 = 0.5)
- Algebraic: Accept equivalent expressions (2x = x+x = x\*2)
- Text: Focus on meaning, not exact phrasing
- Table: Each cell evaluated independently
- Matching: All pairs must match

#### AV-03: Backward Compatibility

**Priority:** MUST
**Description:** No breaking changes to the existing validation API contract.

**Behavior:**

- New fields are optional
- Missing fields default to permissive type-agnostic validation
- Existing frontend callers work without changes

## Architecture

### Current State (As-Is)

```
Exercise Page
    │
    ├── ExercisesPager (client component)
    │   ├── ExerciseRenderer (content blocks)
    │   └── ChatInterface (chat + hidden message flow)
    │       │
    │       └── useNotebookChat hook
    │           ├── sendContextualHelp() → sends hidden message
    │           └── streamMessage() → calls /api/agent/chat/stream
    │
    └── Agent Chat Stream Endpoint
        │
        ├── Persists message with `hidden: true`
        └── Filters hidden messages from client GET
```

### Target State (To-Be)

```
Exercise Page
    │
    ├── ExercisesPager
    │   ├── ExerciseRenderer
    │   └── ChatInterface
    │       │
    │       └── useNotebookChat hook
    │           ├── injectExerciseContext() → NEW: sends formatted hidden message
    │           ├── sendContextualHelp() → existing
    │           └── streamMessage() → existing
    │
    └── Agent Chat Stream Endpoint (no changes)
        │
        └── Same flow, now with exercise context hidden messages
```

### Key Files

| File                                                        | Change   | Description                                  |
| ----------------------------------------------------------- | -------- | -------------------------------------------- |
| `src/infra/llm/exercise-context.ts`                         | NEW      | `formatExerciseContextMessage()` utility     |
| `src/ui/web/chat/hooks/useNotebookChat.ts`                  | MODIFIED | Add `injectExerciseContext()`                |
| `src/ui/web/chat/ChatInterface/index.tsx`                   | MODIFIED | Trigger context injection on exercise change |
| `src/app/(frontend)/.../ExercisesPager/index.tsx`           | MODIFIED | Pass exercise data to ChatInterface          |
| `src/server/payload/endpoints/exercises/validate-answer.ts` | MODIFIED | Accept questionType/variant                  |
| `src/infra/llm/services/answer-validation-service.ts`       | MODIFIED | Pass type metadata to LLM                    |
| `src/infra/llm/prompts/answer-validation.ts`                | MODIFIED | Type-specific rules                          |
| `src/ui/web/exerciserenderer/utils/answerChecking.ts`       | MODIFIED | Send question metadata                       |
| `tests/int/exercise-context-injection.int.spec.ts`          | NEW      | E2E integration tests                        |
| `tests/unit/infra/llm/exercise-context.spec.ts`             | NEW      | Context formatting tests                     |

## Implementation Details

### formatExerciseContextMessage()

```typescript
/**
 * Format exercise content into a readable message for the LLM.
 * - Strips solutions and correct answers (prevent leakage)
 * - Includes hints (helps LLM guide student)
 * - Caps output at 2000 characters
 */
export function formatExerciseContextMessage(
  exerciseTitle: string,
  blocks: ContentBlock[],
  mediaMap?: Record<string, MediaItem>,
): string {
  const parts: string[] = []

  parts.push('[EXERCISE CONTEXT]')
  parts.push(`Exercise: "${exerciseTitle}"`)
  parts.push('')
  parts.push('Content Blocks:')

  let used = 0
  for (const block of blocks) {
    if (used >= 2000) break

    if (block.type === 'rich_text') {
      const preview = block.value.substring(0, 200)
      parts.push(`${used + 1}. [RichText] ${preview}...`)
    } else if (block.type === 'question_select') {
      if (block.variant === 'mcq' || block.variant === 'true_false') {
        const options = block.answer.options.map((o) => o.content.value).join(', ')
        const hints = block.hint ? ` | Hint: ${block.hint.value}` : ''
        parts.push(
          `${used + 1}. [Question: ${block.variant}] ${block.prompt.value} | Options: ${options}${hints}`,
        )
      }
    } else if (block.type === 'question_free_response') {
      const hints = block.hint ? ` | Hint: ${block.hint.value}` : ''
      const answers = block.answer.acceptedAnswers.length
      parts.push(
        `${used + 1}. [Question: FreeResponse] ${block.prompt.value} | Accepted: ${answers} answer(s)${hints}`,
      )
    } else if (block.type === 'question_table') {
      parts.push(
        `${used + 1}. [Question: Table] ${block.prompt.value} | Rows: ${block.table.rowsData.length}`,
      )
    } else if (block.type === 'question_matching') {
      parts.push(
        `${used + 1}. [Question: Matching] ${block.prompt.value} | Pairs: ${block.correctPairs.length}`,
      )
    } else if (block.type === 'question_geometry') {
      parts.push(`${used + 1}. [Question: Geometry] ${block.prompt.value}`)
    } else if (block.type === 'latex') {
      parts.push(`${used + 1}. [LaTeX] ${block.latex.substring(0, 100)}...`)
    } else if (block.type === 'svg') {
      parts.push(`${used + 1}. [SVG] ${block.altText || 'Diagram'}`)
    } else {
      parts.push(`${used + 1}. [${block.type}]`)
    }
    used += 100 // rough estimate
  }

  parts.push('[END EXERCISE CONTEXT]')
  return parts.join('\n').substring(0, 2000)
}
```

### injectExerciseContext() in useNotebookChat

```typescript
const lastInjectedExerciseId = useRef<string | null>(null)

const injectExerciseContext = useCallback(
  async (
    exercise: { id: string; title: string; content: ContentData },
    mediaMap?: Record<string, MediaItem>,
  ) => {
    if (isLoading || isLoadingHistory) return
    if (lastInjectedExerciseId.current === exercise.id) return // EC-06

    lastInjectedExerciseId.current = exercise.id

    const formatted = formatExerciseContextMessage(
      exercise.title,
      exercise.content.blocks,
      mediaMap,
    )
    const prompt = `The student is now viewing the following exercise. Use this context to help them if they ask questions.\n\n${formatted}`

    const context = { exerciseId, lessonId, chapterId, courseId, categoryId }
    await streamMessage(prompt, acknowledgment, context, { hidden: true })
  },
  [isLoading, isLoadingHistory, streamMessage, formatExerciseContextMessage],
)
```

### Enhanced Answer Validation Prompt

```typescript
export const ANSWER_VALIDATION_PROMPT_V2 = `You are an expert tutor grading student answers.

${ANSWER_VALIDATION_PROMPT}

// Type-Specific Rules:
- Numeric answers: Accept equivalent forms (3.14 ≈ π, 1/2 = 0.5, 0.5 = 1/2)
- Algebraic: Accept equivalent expressions (2x = x+x = x*2 = 2*x)
- Text: Focus on meaning, not exact phrasing; accept synonyms
- Table: Each cell answer is evaluated independently
- Matching: All pairs must match; order may vary

Output Format: Return ONLY valid JSON with { isCorrect: boolean, reasoning: string }
```

## Testing Strategy

### Unit Tests

- `formatExerciseContextMessage`: Tests for all 10 block types, answer stripping, 2000-char cap
- `injectExerciseContext`: Tests dedup logic, early return conditions

### Integration Tests

- `agent-chat-streaming.int.spec.ts` additions:
  - Hidden message persisted in DB
  - Hidden message excluded from client GET
  - Hidden message included in LLM prompt
  - Coexistence with incorrect-answer pattern
  - Multi-exercise context injection

- `validate-answer.int.spec.ts` additions:
  - Accepts questionType/variant
  - Backward compatibility (missing fields)
  - Type-specific validation called

### E2E Tests

- Full flow: page load → context injection → student question → context-aware AI response
- Navigation flow: exercise A → exercise B → both contexts in conversation
- Security: hidden messages never leak to client

## Security Considerations

| Context                   | Stored in DB | Sent to LLM | Visible in UI |
| ------------------------- | ------------ | ----------- | ------------- |
| Exercise content blocks   | Yes (hidden) | Yes         | No            |
| Hints                     | Yes (hidden) | Yes         | No            |
| Solutions/correct answers | **NO**       | **NO**      | N/A           |
| Media URLs                | Yes (hidden) | Yes         | No            |

**Answer Leakage Prevention:**

- `formatExerciseContextMessage` explicitly excludes:
  - `answer.correctOptionIds` (MCQ)
  - `answer.acceptedAnswers` (free response)
  - `solution` field (all question types)
  - `fullSolution` field (all question types)

## Guardrails

- Do not create new API endpoints (reuse existing with `hidden: true`)
- Do not change conversation scope (remains `lessons:{lessonId}`)
- Do not modify existing schemas (use existing `hidden` field)
- Do not leak hidden messages to client responses
- Do not include solutions/correct answers in context messages
- Maintain backward compatibility for all existing callers

## Out of Scope

- Vector search for exercise content (beyond scope, stick to hidden messages)
- Memory extraction from exercise context (future enhancement)
- Dynamic per-exercise system prompts (lesson-level prompts only)
- Changes to exercise content data model

## Dependencies

- Existing `hidden` field on messages (Conversations collection)
- Existing `sendContextualHelp` pattern (useNotebookChat)
- Existing `exercise-incorrect-answer` CustomEvent flow
- Existing `answerChecking.ts` validation flow

## Open Questions (Resolved)

| Question                     | Decision                                      | Rationale                                                 |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| Proactive vs silent context? | Silent injection only                         | Minimal UI impact, LLM uses context when relevant         |
| Trigger timing?              | On exercise load + existing incorrect pattern | Covers both exercise-level and question-level help        |
| Stale context handling?      | Natural window expiration                     | Simpler than active invalidation, sufficient for use case |
