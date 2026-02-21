# Spec: 260221-auto-59

## Overview

Enhance error handling visibility by logging suppressed errors in server repositories, API services, and client-side hooks/components. Currently, several `catch` blocks silently discard errors or return generic responses without logging the underlying issue, hindering debugging.

## Requirements

### FR-001: Log Errors in Exercise Repository

**Priority**: MUST
**Description**: In `src/server/repos/queries/exercises.ts`, inside the `queryExerciseById` function, the `catch` block currently suppresses errors. Modify it to log the error before returning `null`.
**Implementation Details**:
- Import `logger` from `@/infra/utils/logger`.
- In the `catch (error)` block, call `logger.error({ err: error, id }, 'Error querying exercise by ID')`.

### FR-002: Log Errors in API Service

**Priority**: MUST
**Description**: In `src/server/services/api/api-service.ts`, several methods catch errors and return generic error objects without logging the actual error.
**Implementation Details**:
- Ensure `logger` is imported (it is already imported).
- In `chat` method (approx line 123): Log the error with `logger.error({ err: error }, 'Chat API error')` before returning `{ success: false, error: 'Network error' }`.
- In `getConversation` method (approx line 197): Log the error with `logger.error({ err: error, contextKey }, 'Get conversation error')` before returning the error response.
- In `resetChat` method (approx line 235): Log the error with `logger.error({ err: error, contextKey }, 'Reset chat error')` before returning the error response.

### FR-003: Log Errors in Notebook Chat Hook

**Priority**: MUST
**Description**: In `src/ui/web/chat/hooks/useNotebookChat.ts`, generic toast errors are shown without logging the specific error details for debugging.
**Implementation Details**:
- Ensure `logger` is imported (it is already imported).
- In `streamMessage` (approx line 519): Log the error with `logger.error({ err: error }, 'Chat stream error')` before calling `toast.error`.
- In `sendMessageSync` (approx line 574): Log the error with `logger.error({ err: error }, 'Chat sync error')` before calling `toast.error`.
- In `handleReset` (approx line 602): Log the error with `logger.error({ err: error }, 'Chat reset error')` before calling `toast.error`.

### FR-004: Log Errors in Conversion Form

**Priority**: MUST
**Description**: In `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`, the `handleSubmit` function suppresses errors during the queue operation.
**Implementation Details**:
- In `handleSubmit` (approx line 84): Log the error using `console.error('Conversion queue error:', error)` before calling `setError`.
- Note: Use `console.error` here to avoid adding a new dependency on the custom logger in this client component, keeping the implementation lightweight.

## Acceptance Criteria

- [ ] `src/server/repos/queries/exercises.ts` logs errors when `findByID` fails.
- [ ] `src/server/services/api/api-service.ts` logs errors in `chat`, `getConversation`, and `resetChat` methods.
- [ ] `src/ui/web/chat/hooks/useNotebookChat.ts` logs client-side errors in streaming, sync messaging, and reset operations.
- [ ] `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` logs errors when conversion queueing fails.
- [ ] No changes to the external behavior (return values, UI toasts) except for the added logging side effect.
- [ ] All `catch` blocks use the captured `error` variable instead of `_error` or `_err` (underscore removal/renaming required where applicable).

## Guardrails

- **Behavior Preservation**: The return values of functions and the user-facing behavior (toasts, error messages) MUST remain unchanged. Only logging is added.
- **Logger Usage**:
  - Use `logger` from `@/infra/utils/logger` for server-side code (`exercises.ts`, `api-service.ts`) and existing client code that already imports it (`useNotebookChat.ts`).
  - Use `console.error` for `ConvertForm/index.tsx` to minimize bundle impact.
- **Client/Server Compatibility**: Ensure the `logger` import works in both server and client environments (as `useNotebookChat` is a client component and already uses it).

## Out of Scope

- Refactoring the error handling logic flow (e.g., throwing errors instead of returning null).
- Changing the user-facing error messages.
- Fixing the underlying bugs that might cause these errors (this task is only for observability).
