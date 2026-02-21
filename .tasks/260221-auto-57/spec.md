# Spec: 260221-auto-57

## Overview

Several `catch` blocks across the codebase discard the original error, making debugging difficult. They currently return `null`, show a generic message, or present a toast without logging the actual error. The objective is to improve the debugging experience by explicitly logging the original error before performing the fallback action.

## Requirements

### NFR-001: Log Caught Errors in Queries
**Priority**: MUST
**Description**: In `src/server/repos/queries/exercises.ts`, the original error caught in the `catch` block MUST be logged to the console before returning `null`.

### NFR-002: Log API Service Errors
**Priority**: MUST
**Description**: In `src/server/services/api/api-service.ts`, the caught error MUST be logged to the console before returning the generic error response (e.g., `{ success: false, error: 'Network error' }`).

### NFR-003: Log Client-Side Chat Hook Errors
**Priority**: MUST
**Description**: In `src/ui/web/chat/hooks/useNotebookChat.ts`, the caught errors MUST be logged to the console before displaying the toast error message.

### NFR-004: Log Admin Conversion Form Errors
**Priority**: MUST
**Description**: In `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`, the caught error MUST be logged to the console before setting the UI error state.

### NFR-005: Preserve Existing Fallback Behavior
**Priority**: MUST
**Description**: The logic inside the `catch` blocks (e.g., returning `null`, showing toasts, setting error state) MUST remain exactly as it is, merely prepended with the `console.error` statement.

### NFR-006: Rename Unused Error Variables
**Priority**: MUST
**Description**: The error variable in the `catch` clauses MUST be renamed from an unused variable convention (e.g., `_error`, `_err`) to an active variable (e.g., `error`, `err`) to satisfy linter rules.

## Acceptance Criteria

- [ ] `console.error('...', error)` or equivalent is called in the `catch` block of `src/server/repos/queries/exercises.ts`.
- [ ] `console.error('...', error)` or equivalent is called in all identified `catch` blocks of `src/server/services/api/api-service.ts`.
- [ ] `console.error('...', error)` or equivalent is called in all identified `catch` blocks of `src/ui/web/chat/hooks/useNotebookChat.ts`.
- [ ] `console.error('...', error)` or equivalent is called in the `catch` block of `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`.
- [ ] The existing behavior of the `catch` blocks (returning null, setting state, triggering toasts) is unchanged.
- [ ] TypeScript compilation and linting succeed with no new type errors or unused variable warnings.

## Guardrails

- Do NOT change the return type or values of the functions.
- Do NOT remove or modify the existing error handling actions (like toasts or `setError` calls).
- Ensure that the error variable is properly renamed from `_error` or `_err` to `error`.

## Out of Scope

- Implementing complex logging systems (e.g., Sentry, Pino, DataDog) for these specific files if not already required. A simple `console.error` is sufficient for this task.
- Fixing or modifying other `catch` blocks not explicitly listed in the task description.
- Modifying the successful execution paths of the affected functions.