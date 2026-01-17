# Task: Move Lesson System Prompt to Payload Prompts (TDD)

## Goal

Replace the hardcoded/markdown-based system prompt source with a **Payload `Prompts` collection**, starting **only at the Lesson level**, while keeping the chat endpoint behavior stable. Implement via **TDD** and update/fix any existing tests impacted by the change.

---

## Scope

### In

- Create a new Payload collection: **`prompts`**.
- Add a **relationship field** on **`lessons`**: `prompt` → `prompts` (single).
- Update `src/endpoints/agent/chat.ts` to load the Lesson’s prompt template from Payload and use it as `systemInstructions`.
- Keep existing context policy flow: lesson context injection → `composePrompt` → Gemini call.
- Remove the legacy markdown prompt dependency from `src/lib/ai/services/exercise-chat-service.ts` (or leave only a minimal fallback used exclusively when no composedPrompt is passed).
- Update / fix existing tests for all touched modules.

### Out (for this task)

- No prompt placeholders / inputVars system.
- No prompt overrides on exercises/chapters/courses yet.
- No prompt bundles/policies collection.
- No admin UX improvements beyond basic relationship selection.

---

## Success Criteria

- Chat endpoint uses **Prompt from Lesson relationship** when available.
- If Lesson has **no prompt** or the linked prompt is **not `published`**, endpoint uses a **deterministic fallback** (defined below) without crashing.
- Existing chat behavior remains stable (no duplicated user message, no missing system message).
- All tests pass (new + updated).

---

## Design Decisions (Locked)

- Relationship from Lesson → Prompt (single).
- Prompts use status: `draft | published | archived`.
- Runtime uses **published only**.
- Both inputs are included:
  - **Lesson Prompt template** is the base system instructions.
  - **`lessonContextText`** (if present) is injected into the system instructions via `buildLessonContextPrompt` **before** `composePrompt`.

- Fallback order for system prompt:
  1. Lesson.prompt (if exists and is `published`)
  2. Global default prompt (first published prompt with `isDefaultForAgentChat=true`)
  3. Minimal built-in fallback string (last resort; logs warning)

---

## Data Model

### 1) `prompts` collection

**Fields**

- `title` (text, required)
- `status` (select: `draft|published|archived`, required, default `draft`)
- `template` (textarea/code editor, required)
- `isDefaultForAgentChat` (checkbox, default false)
- (optional but recommended) `key` (text, unique, optional)
- `updatedAt/createdAt` (Payload timestamps)

**Access**

- Read: authenticated users (or admin-only if you prefer; endpoint uses server-side access)
- Write: admin only

**Indexes**

- index on `status`
- index on `isDefaultForAgentChat`

### 2) `lessons` changes

- Add `prompt` field: relationship → `prompts` (single, optional)

---

## Implementation Stages (TDD-first)

## Stage 0 — Baseline & Safety Rails

**Timebox:** 30–60 minutes

**Deliverables**

- Identify current tests that cover `agent/chat.ts` and `exercise-chat-service.ts`.
- Add a single “smoke” test ensuring the endpoint still composes a prompt and calls the model adapter in the same way (mocked).

**Guardrails**

- No behavior changes yet.
- No refactors beyond what’s needed to test.

---

## Stage 1 — Add Prompts Collection + Lesson Relationship (Schema)

**Timebox:** 60–120 minutes

**TDD**

- Add schema-level tests (or integration tests) that:
  - `prompts` can be created with `title/status/template`.
  - `lessons.prompt` accepts a valid prompt relationship.

**Deliverables**

- `src/collections/Prompts.ts` (or equivalent)
- Update Lessons collection config to include `prompt` relationship
- Minimal admin visibility (no extra UI work)

**Acceptance Checks**

- Payload boots with the new collection.
- Relationship resolves at depth 0/1 without issues.

---

## Stage 2 — Prompt Selection Logic (Resolver) in `agent/chat.ts`

**Timebox:** 2–4 hours

**Create a small function (server-side) with unit tests:**
`resolveAgentSystemPrompt(payload, lessonId, fallbackPolicy)`

**TDD: Required test cases**

1. **Lesson has published prompt** → returns its `template`.
2. Lesson has prompt but it’s `draft` → does not use it; falls back.
3. Lesson has prompt but it’s `archived` → does not use it; falls back.
4. Lesson has no prompt → falls back.
5. No published default exists → returns minimal built-in fallback and logs warning.

**Deliverables**

- Implement the resolver function (location suggestion: `src/lib/ai/prompt-resolver.server.ts`).
- Update `src/endpoints/agent/chat.ts` Step 10:
  - Replace `getSystemPrompt()` usage.
  - Load system instructions via the resolver.
  - Keep `buildLessonContextPrompt(systemInstructions, lessonContextText)`.

**Guardrails**

- Keep all existing context policy calls unchanged: `getRecentWindow`, memory retrieval, `composePrompt`, observability.
- Do not change the “persist message first” behavior.

---

## Stage 3 — Remove Markdown Prompt Dependency from `exercise-chat-service.ts`

**Timebox:** 1–2 hours

**TDD: Required test cases**

1. When `composedPrompt` is provided, service:
   - Converts roles correctly to Gemini history
   - Does not duplicate the current user message

2. Legacy path behavior (if retained temporarily):
   - Uses a provided system string (NOT md import)
   - Or is disabled/throws with a clear error if called

**Deliverables**

- Remove `../prompts/exercise-chat-agent-prompt.md` import.
- Remove or deprecate `getSystemPrompt()`.
- Ensure the endpoint is the single source of system instructions.

**Guardrails**

- No change to retry/timeout semantics.

---

## Stage 4 — Update Existing Tests + Add Regression Coverage

**Timebox:** 2–4 hours

**Fix impacted tests**

- Any tests expecting `getSystemPrompt()` to return md-derived content must be updated to reflect Payload-based prompt selection.
- Any snapshot tests must be updated (prompt content will differ).

**Add regression tests (minimum set)**

- Endpoint composes prompt with:
  - System instructions from prompt
  - Lesson context injected (when present)
  - Summary and memory items included when enabled

- Endpoint still returns success shape `{ success, message, conversationId, contextKey }`.

---

## Stage 5 — Cleanup & Documentation

**Timebox:** 30–60 minutes

**Deliverables**

- Remove unused exports/imports (`getSystemPrompt` usage in endpoint).
- Add short internal doc comment in `agent/chat.ts` explaining prompt source and fallback order.
- Ensure logs are actionable (warn on missing default, info on resolved prompt id).

---

## Test Plan (Concrete)

### Unit tests

- `resolveAgentSystemPrompt` (all cases above)

### Integration/API tests (mock Gemini)

- `agentChat`:
  - With lessonId referencing a lesson with published prompt
  - With lessonId referencing a lesson without prompt
  - With prompt in draft/archived

### Non-goals

- No end-to-end browser tests required in this task.

---

## Observability Requirements

- Log once per request:
  - `resolvedPromptId` and/or `resolvedPromptTitle`
  - fallback reason if fallback used

- Do not log full prompt contents in production (keep snapshots dev-only).

---

## Acceptance Criteria

- CI passes.
- New tests added and existing tests updated.
- Chat endpoint uses Payload prompt selection for Lessons.
- No duplicate user message in Gemini history.
- Clear fallback behavior and logs.

---

## Notes / Future Follow-ups (Not in this task)

- Add overrides for Exercise → Lesson fallback.
- Add prompt selection for other models (Course/Chapter/Exercise/ingest).
- Add placeholders/inputVars and publish-time validation.
