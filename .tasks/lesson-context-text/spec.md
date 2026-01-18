# TDD Task: Lesson Full-Context Injection (MVP)

## Goal

Guarantee that lesson-level textual context is injected into chat prompts at runtime,
without being persisted in conversations or messages.

The implementation must be driven entirely by tests.

---

## Test Strategy (Test-First)

### 1. Schema Tests

**Test: Lesson has AI context field**

- Assert that `Lesson` schema includes:
  - `lessonContextText` (string / long text)
- Assert that:
  - Field is optional
  - Field is NOT indexed for search
  - Field is NOT referenced by any other collection

---

### 2. Conversation Integrity Tests

**Test: Conversation schema is unchanged**

- Assert no new fields added to:
  - `Conversation`
  - `Message`
- Assert no message contains lesson context text

**Failure Condition**

- If lesson context appears inside stored messages → test fails

---

### 3. Prompt Composition Tests

**Test: Lesson context is injected at runtime**

- Given:
  - A lesson with `lessonContextText = "LESSON CONTENT"`
  - A conversation with user messages
- When:
  - A chat request is built
- Then:
  - The final prompt contains `"LESSON CONTENT"`
  - The prompt contains the user question
  - The prompt contains recent messages only

**Negative Assertion**

- Lesson context must NOT appear in:
  - Stored conversation
  - Stored messages

---

### 4. Isolation Tests

**Test: Lesson context is lesson-scoped only**

- Given:
  - Two lessons with different `lessonContextText`
- When:
  - Chat is executed in lesson A
- Then:
  - Only lesson A context is injected
  - Lesson B context never appears

---

### 5. Guardrail Tests

**Test: Oversized lesson context is blocked**

- Given:
  - `lessonContextText` exceeding model context limit
- When:
  - Chat request is built
- Then:
  - Request is rejected with a clear error
  - No model call is made

---

### 6. Single Responsibility Tests

**Test: Context injection is centralized**

- Assert:
  - A single function exists: `buildLessonContextPrompt()`
  - No other code path injects lesson context
- If lesson context is injected elsewhere → test fails

---

## Explicit Non-Tests (Out of Scope)

- PDF parsing
- Text extraction
- Chunking
- Vector search
- Embeddings
- LangChain
- memory_items

---

## Acceptance Criteria

- All tests pass before implementation is considered complete
- Chat answers demonstrably depend on `lessonContextText`
- Lesson context is never persisted in conversation data
- The system remains replaceable with retrieval-based logic later

---

## Engineering Rule

If a future refactor replaces full-context injection,
only `buildLessonContextPrompt()` tests should change.
