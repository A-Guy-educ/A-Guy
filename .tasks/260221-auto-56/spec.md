# Spec: 260221-auto-56

## Overview

Several catch blocks across the codebase discard the original error by returning `null`, returning generic messages, or showing user-facing toasts without logging the actual error to the console or server logs. This makes debugging difficult because the underlying errors (such as database errors or network issues) are swallowed. This task addresses this issue by properly logging the errors before handling them.

## Requirements

### FR-001: Log Error in Database Queries
**Priority**: MUST
**Description**: In `src/server/repos/queries/exercises.ts`, update the catch block (around lines 35-37) to log the caught error using `console.error` with context before returning `null`. This will allow developers to distinguish between "not found" vs "database error".

### FR-002: Log Error in API Service Methods
**Priority**: MUST
**Description**: In `src/server/services/api/api-service.ts`, update the catch blocks (around lines 123, 197, 235) to log the caught error using `console.error` with context before returning generic failure responses like `{ success: false, error: 'Network error' }`.

### FR-003: Log Error in Chat Hooks
**Priority**: MUST
**Description**: In `src/ui/web/chat/hooks/useNotebookChat.ts`, update the catch blocks (around lines 518, 571, 599) to log the error to the console (`console.error`) with context prior to displaying a toast error message.

### FR-004: Log Error in Exercise Conversion Admin Form
**Priority**: MUST
**Description**: In `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`, update the catch block (around line 84) to log the actual error using `console.error` with context before setting the generic error state (e.g., `setError('Queue failed')`).

## Acceptance Criteria

- [ ] `src/server/repos/queries/exercises.ts` correctly logs the error in the catch block before returning `null`.
- [ ] `src/server/services/api/api-service.ts` correctly logs the error in all three affected catch blocks before returning the failure object.
- [ ] `src/ui/web/chat/hooks/useNotebookChat.ts` logs the error in the console for all three affected catch blocks before executing the toast notifications.
- [ ] `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` logs the error in the catch block before updating the error state.
- [ ] The variable names in catch blocks are updated from `_error` or `_err` to `error` or `err` to reflect that they are now used.
- [ ] The existing behavior (returning `null`, setting state, showing toasts) must remain unchanged after logging the error.
- [ ] `console.error` calls should include a descriptive message prefix indicating where or why the operation failed (e.g., `console.error('Operation failed:', error)`).

## Guardrails

- **What must NOT change**: Do not change the existing behavior, return values, state updates, or user-facing error messages in the catch blocks. The objective is strictly to add observability.
- **Constraints to follow**: Use standard `console.error` with a descriptive message prefix rather than just `console.error(error)` to provide context.

## Out of Scope

- Implementing comprehensive server-side logging mechanisms (e.g., integrating Winston, Pino, Datadog, or Sentry) for these occurrences. Basic `console.error` is sufficient for this task.
- Modifying other catch blocks in the application that are not explicitly mentioned in the scope.
- Refactoring the entire error handling strategy of the project.
