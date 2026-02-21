# Spec: 516

## Overview

Fix error swallowing across the application where catch blocks use intentionally unused error variables like `_error` or `_err`. This causes actual API error details to be hidden from users (generic error toasts) and missing from server-side logs, making debugging difficult.

## Requirements

### FR-001: Expose API Errors to UI
**Priority**: MUST
**Description**: When an API error occurs in the chat interface (or other client actions), the error toast must display the specific error message or details rather than a generic "Something went wrong" message.

### FR-002: Server-side Error Logging
**Priority**: MUST
**Description**: Server-side catch blocks (e.g., repository queries like `exercises.ts`) must log the actual error. This ensures developers can distinguish between different failure reasons, such as a "not found" vs a "database connection error".

### NFR-001: Prevent Silent Error Swallowing
**Priority**: MUST
**Description**: Remove instances of `catch (_error)` or `catch (_err)` where the error is entirely discarded. Errors must be logged or appropriately handled.

## Acceptance Criteria

- [ ] Client-side error toasts in the chat interface display specific error information.
- [ ] Server-side catch blocks log the error before returning fallback values (like `null`).
- [ ] A search for `catch (_error)` and `catch (_err)` yields zero results for intentionally swallowed errors.

## Guardrails

- What must NOT change: The application's fallback behavior. If a function is designed to return `null` on failure (e.g., querying an exercise), it should still return `null`, but only *after* logging the error.
- Constraints to follow: Do not expose sensitive server-side information (like database credentials or internal stack traces) directly to the client UI. Sanitize errors sent to the client.

## Out of Scope

- Implementing a completely new global error tracking service (e.g., adding Sentry or Datadog) if it doesn't already exist.
- Refactoring the entire application architecture to use `Result` types instead of exceptions.

## Open Questions & Clarification on Pipeline Failure

- **Why did the task fail again?**
  The previous automated task (`260221-auto-56`) successfully modified the code and passed tests, but the pipeline failed during the final step: Pull Request creation.
  
  **Root Cause of Failure:** 
  The automated pipeline uses `gh pr create` with the built-in `GITHUB_TOKEN`. However, it failed with the error:
  `GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)`
  
  This is a repository-level security restriction. In the repository settings (Settings -> Actions -> General -> Workflow permissions), the checkbox for **"Allow GitHub Actions to create and approve pull requests"** is currently disabled, which prevents the pipeline from opening the PR.