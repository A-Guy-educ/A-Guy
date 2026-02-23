# Spec: 260223-auto-62

## Overview

The `Exercises` collection's slug generation hook currently uses an unbounded `while (true)` loop to find a unique slug by appending incrementing numbers. This can cause an infinite loop or excessive database queries if thousands of exercises share the same title within a lesson. This task introduces a safety limit (`MAX_SLUG_ATTEMPTS`) to the loop to prevent runaway execution. Additionally, it modernizes the database queries in the `generateSlug` and `validateSlugUniqueness` hooks to use the `req` object for transaction safety, adhering to Payload 3.x best practices.

## Requirements

### FR-001: Cap Slug Generation Attempts
**Priority**: MUST
**Description**: The `generateSlug` hook MUST use a constant `MAX_SLUG_ATTEMPTS` (recommended: `50`) to limit the `while` loop that searches for a unique slug.

### FR-002: Handle Maximum Attempts Reached
**Priority**: MUST
**Description**: If `MAX_SLUG_ATTEMPTS` is reached without finding a unique slug, the hook MUST throw an explicit Error indicating that a unique slug could not be generated within the allowed attempts.

### FR-003: Modernize Database Queries with `req`
**Priority**: MUST
**Description**: The `generateSlug` and `validateSlugUniqueness` hooks MUST extract the `req` object from the hook arguments. The hooks MUST use `req.payload.find()` (or pass `req` appropriately if still using a global payload instance) and MUST pass `req` into the `find()` options to ensure transaction safety.

### FR-004: Ensure Global Uniqueness Check
**Priority**: MUST
**Description**: When passing `req` to `find()`, `overrideAccess: true` MUST be explicitly passed to ensure the uniqueness check evaluates against all documents regardless of the current user's read access (since `req` automatically applies user access control).

### NFR-001: Query Performance
**Priority**: SHOULD
**Description**: The `find()` calls in both hooks SHOULD include `depth: 0` to prevent unnecessary relationship resolution during the existence check.

### NFR-002: Configuration Maintainability
**Priority**: SHOULD
**Description**: The `MAX_SLUG_ATTEMPTS` constant SHOULD be defined at the top of the hook file for easy discoverability and maintainability.

## Acceptance Criteria

- [ ] `MAX_SLUG_ATTEMPTS` is defined and bounds the number of iterations in the slug generation loop.
- [ ] The hook throws an `Error` when the limit is reached instead of looping infinitely.
- [ ] The `req` object is extracted from the hook arguments and passed to `find()` calls for transaction atomicity.
- [ ] `overrideAccess: true` is explicitly passed to `find()` calls to ensure global uniqueness.
- [ ] `depth: 0` is used in the uniqueness queries for performance.
- [ ] Existing logic for generating base slugs and appending counters (e.g., `-1`, `-2`) works correctly up to the defined limit.
- [ ] The `getPayloadInstance()` helper is removed or avoided if `req.payload` provides the necessary instance.

## Guardrails

- MUST NOT alter the underlying base slug generation logic using `formatSlug(title)`.
- MUST ensure existing `limit: 1` (or `limit: 2` for validation) is preserved to prevent over-fetching.

## Out of Scope

- Changing slug generation rules for other collections.
- Implementing a completely new slug generation mechanism (e.g., UUIDs).
