# Spec: 260220-auto-67

## Overview

Address "error swallowing" in several backend and frontend files by implementing proper error logging before handling/suppressing the errors. This ensures debugging visibility when operations fail.

## Requirements

### FR-001: Log Errors in `exercises.ts` Query
**Priority**: MUST
**Description**: 
- In `src/server/repos/queries/exercises.ts`, import the logger.
- In `queryExerciseById`, inside the `catch` block, log the error before returning `null`.
- Use the standard logging pattern: `logger.error({ err: error, id }, 'Error querying exercise by ID')`.

### FR-002: Log Errors in `api-service.ts`
**Priority**: MUST
**Description**:
- In `src/server/services/api/api-service.ts`:
  - In `chat` method catch block: log the error.
  - In `getConversation` method catch block: log the error.
  - In `resetChat` method catch block: log the error.
- Include context (e.g., `contextKey` where available) in the log object.

### FR-003: Log Errors in `useNotebookChat.ts`
**Priority**: MUST
**Description**:
- In `src/ui/web/chat/hooks/useNotebookChat.ts`:
  - In `streamMessage` catch block: log the error before showing toast.
  - In `sendMessageSync` catch block: log the error before showing toast.
  - In `handleReset` catch block: log the error before showing toast.
- Ensure the error object is passed to the logger.

### FR-004: Log Errors in `ConvertForm/index.tsx`
**Priority**: MUST
**Description**:
- In `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`, import the logger.
- In `loadPrompts` catch block: capture the error and log it.
- In `handleSubmit` catch block: log the error.
- Include relevant IDs (`lessonId`, `mediaId`) in the log object.

## Acceptance Criteria

- [ ] `src/server/repos/queries/exercises.ts` imports `logger` and logs errors in `queryExerciseById`.
- [ ] `src/server/services/api/api-service.ts` logs errors in `chat`, `getConversation`, and `resetChat`.
- [ ] `src/ui/web/chat/hooks/useNotebookChat.ts` logs errors in `streamMessage`, `sendMessageSync`, and `handleReset`.
- [ ] `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` imports `logger` and logs errors in `loadPrompts` and `handleSubmit`.
- [ ] All new log statements use `logger.error` and include the error object as `{ err: error }` (or similar standard property).
- [ ] No functional changes to the return values or UI behavior (toasts still show, nulls still returned).

## Guardrails

- **No Behavioral Changes**: The external behavior (what the user sees, what the function returns) must remain exactly the same. Only logging is added.
- **Logger Import**: Use `import { logger } from '@/infra/utils/logger'` for consistency.
- **Client/Server Safety**: The logger usage must be compatible with the environment (Server Components, Client Components, Server Actions). The existing `logger` utility is safe for use in `useNotebookChat` (client) and server files.

## Out of Scope

- Refactoring the error handling logic itself (e.g., throwing instead of returning null).
- Changing the user-facing error messages.
