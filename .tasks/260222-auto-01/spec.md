# Spec: 260222-auto-01

## Overview

The `Exercises` collection's slug generation hook currently uses an unbounded `while (true)` loop to find a unique slug by appending incrementing numbers. This can cause an infinite loop or excessive database queries if thousands of exercises share the same title within a lesson. This task will introduce a safety limit (`MAX_SLUG_ATTEMPTS`) to the loop to prevent runaway execution. 

Additionally, we will modernize the database query to use the `req` object for transaction safety, a Payload 3.x best practice.

## Requirements

### FR-001: Bounded Slug Generation
**Priority**: MUST
**Description**: The slug generation loop in `src/server/payload/collections/Exercises/hooks.ts` (lines 35-54) must be bounded. Implement a `MAX_SLUG_ATTEMPTS` constant set to 100. The loop should exit and throw an error if a unique slug cannot be found within 100 attempts.

### FR-002: Error on Exceeding Limits
**Priority**: MUST
**Description**: If the loop exceeds the maximum number of attempts, it must throw a descriptive `Error` (e.g., `Unable to generate unique slug after 100 attempts`). This ensures the admin UI gracefully displays the error.

### FR-003: Transaction Safety
**Priority**: SHOULD
**Description**: Instead of instantiating a new payload instance via `getPayloadInstance()`, the hook should destructure `req` from its arguments and use `req.payload.find`. Pass the `req` object and `depth: 0` in the `.find()` query to maintain transaction atomicity and optimize performance.

### NFR-001: System Stability
**Priority**: MUST
**Description**: The system must not lock up or consume excessive database connections due to runaway slug generation logic.

## Acceptance Criteria

- [ ] The `generateSlug` field hook's `while` loop has a maximum iteration limit of 100 (`MAX_SLUG_ATTEMPTS`).
- [ ] If the loop runs 100 times without finding a unique slug, it throws an `APIError`.
- [ ] The `generateSlug` hook destructures `req` from the hook arguments.
- [ ] The database uniqueness check uses `req.payload.find` and passes the `req` object and `depth: 0` for optimization and transaction safety.
- [ ] Existing functionality for generating unique slugs within the normal range of attempts remains unchanged.

## Guardrails

- Do NOT change the overall slug generation strategy (e.g., it must continue to append `-${counter}` to the base slug).
- The Local API call inside the hook should inherently run with `overrideAccess: true` (which is the default) to ensure the uniqueness check can see all documents regardless of user permissions.
- Ensure the `APIError` is imported from `payload`.

## Out of Scope

- Refactoring the entire slug generation logic across all collections.
- Implementing a completely new slug generation mechanism (e.g., appending UUIDs instead of numbers).
- Modifying UI components.
