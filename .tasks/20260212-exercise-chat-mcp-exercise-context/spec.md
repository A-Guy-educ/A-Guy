# Spec: 20260212-exercise-chat-mcp-exercise-context

## Overview

The interactive lesson chat currently works but is not automatically grounded in the exercise the student is viewing. The goal is to automatically provide the chat agent with the active exercise context (IDs and full student-visible exercise content) and keep that context up to date as the student navigates between exercises and between question blocks within an exercise.

This implementation must integrate with the existing MCP interface by enabling tool-calling for student chat and restricting tool access/output so students only expose the currently active exercise context and never leak correctness/answer-key data.

## Requirements

### FR-001: Provide Active Exercise Identifiers To Chat

**Priority**: MUST
**Description**: When the student is viewing an exercise, chat requests must include identifiers for the active content:

- `lessonId` (chat conversation scope remains lesson-scoped)
- `exerciseId` (the exercise currently being viewed)
- `activeBlockId` (the question block id currently active, based on last interaction)

### FR-002: Ground Chat In Full Student-Visible Exercise Content

**Priority**: MUST
**Description**: For each chat message while viewing an exercise, the chat agent must have access to the full exercise content displayed to the student (prompt/instructions blocks and question blocks including their options where relevant).

The injected context must be:

- Automatically provided (no copy/paste by the student)
- Updated on exercise navigation
- Updated when `activeBlockId` changes

### FR-003: MCP Tool-Calling Enabled For Student Chat

**Priority**: MUST
**Description**: Enable MCP tool-calling for non-admin (student) chat so the agent can fetch the active exercise context at runtime.

Tool-calling must be enabled for:

- Authenticated students

Tool-calling must NOT be enabled for:

- Guests (unless explicitly added later)

### FR-004: Student MCP Tools Are Restricted To Related Data Only

**Priority**: MUST
**Description**: Students must not be able to access unrelated exercises/lessons/courses or administrative data via MCP.

The system must enforce restrictions server-side:

- Students only get access to a minimal toolset (ideally a single tool like `getActiveExerciseContext` or equivalent)
- Tool arguments must be validated against the current chat request context (e.g., `exerciseId` must match the active `exerciseId` in the request)
- Tool output must be sanitized to include only student-visible fields and exclude correctness/answer key fields

### FR-005: No Stale Context When Navigating

**Priority**: MUST
**Description**: When the student navigates to another exercise, subsequent chat requests must use the new `exerciseId` and the agent must fetch/inject the new exercise content. The agent must not continue using the previous exercise content.

### FR-006: Multi-Question Exercises Supported

**Priority**: MUST
**Description**: For exercises containing multiple question blocks, the chat must know which question is active via `activeBlockId`.

Definition of active question:

- The question block the student most recently interacted with (e.g., selected an option, typed an answer, clicked "Check answer")

### FR-007: Works In Split View And Fullscreen

**Priority**: MUST
**Description**: Exercise context injection must work regardless of workspace layout:

- Split view workspace
- Fullscreen workspace

### NFR-001: Security - Prevent Answer Leakage

**Priority**: MUST
**Description**: The injected exercise context and any MCP tool output must exclude correctness/answer-key fields.

Examples of fields that must not be exposed (names may vary):

- `correct`, `isCorrect`, `correctAnswer`, `solution`, `rubric`, grading keys, hidden explanations

### NFR-002: Access Control Enforcement

**Priority**: MUST
**Description**: All server-side reads performed to fetch exercise context must enforce Payload access control for the authenticated student (i.e., operations must not bypass access unintentionally).

### NFR-003: Prompt Size + Performance

**Priority**: SHOULD
**Description**: Injecting full exercise JSON can grow prompts. The system should:

- Prefer fetching only required fields (student-visible subset)
- Avoid persisting injected exercise content in conversation history
- Log/monitor large context sizes and gracefully degrade if needed (e.g., truncate long rich text, or omit non-essential blocks)

### NFR-004: Observability

**Priority**: SHOULD
**Description**: Add structured logging around:

- Active context (`lessonId`, `exerciseId`, `activeBlockId`)
- Tool list availability for student chat
- Tool call execution and failures (without logging sensitive content)

## Acceptance Criteria

- [ ] Opening chat while viewing an exercise provides the agent with the correct active context (`lessonId`, `exerciseId`, `activeBlockId`).
- [ ] The agent can answer a vague prompt like "I don't understand this" with details specific to the currently viewed exercise and active question.
- [ ] Switching exercises updates context automatically (no stale exercise content referenced as the current exercise).
- [ ] Pages/exercises with multiple question blocks correctly update `activeBlockId` based on last student interaction.
- [ ] Works in both split view and fullscreen workspaces.
- [ ] Students are not required to paste exercise content.
- [ ] Student tool-calling cannot fetch other exercises by providing arbitrary ids.
- [ ] Correctness/answer-key fields are not exposed through injected context or tool output.

## Guardrails

- Conversation scoping remains lesson-scoped (lessonId takes priority for conversation identity) unless explicitly changed in a future task.
- Do not persist exercise context injection into stored conversation messages.
- Do not enable MCP tool-calling for guest chat in this task.
- Do not leak correctness/answer-key data.
- Preserve existing chat behavior outside exercise views (e.g., lesson-level chat without an exercise).

## Out of Scope

- Scroll/viewport-based active question detection (this spec uses last-interaction).
- New MCP server architecture or broad student access to query arbitrary content.
- Re-scoping conversations to be exercise-specific.
- Changes to exercise authoring schemas beyond what is required to sanitize correctness fields.
