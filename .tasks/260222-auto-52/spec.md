# Spec: 260222-auto-52

## Overview

Remove two stale `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments in `src/server/services/exercise-conversion/helpers.ts`. These comments are misplaced and generate ESLint warnings because they do not suppress any actual rules on the targeted lines. Optionally, the underlying `any` types that the comments were originally meant for should be typed correctly.

## Requirements

### FR-001: Remove Stale ESLint Directives

**Priority**: MUST
**Description**: Remove the misplaced `// eslint-disable-next-line @typescript-eslint/no-explicit-any` directives around line 68 and line 308 in `src/server/services/exercise-conversion/helpers.ts`.

### FR-002: Fix Underlying `any` Types

**Priority**: SHOULD
**Description**: Identify the actual `any` types (located around line 70 and line 323) and replace them with strong, explicit TypeScript types where appropriate.

### NFR-001: Code Cleanliness

**Priority**: MUST
**Description**: Removing the stale directives should resolve existing ESLint warnings regarding unused `eslint-disable` rules in the file.

## Acceptance Criteria

- [ ] The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` directive targeting line 69 is removed.
- [ ] The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` directive targeting line 309 is removed.
- [ ] (Optional) The `any` type on line 70 is replaced with an appropriate strict type.
- [ ] (Optional) The `any` type on line 323 is replaced with an appropriate strict type.
- [ ] Running ESLint on `src/server/services/exercise-conversion/helpers.ts` produces no warnings about unused disable directives.

## Guardrails

- Ensure the behavior and runtime logic of the helper functions are not modified.
- If `any` types are replaced, ensure no new TypeScript compilation errors are introduced.
- Restrict all modifications exclusively to `src/server/services/exercise-conversion/helpers.ts`.

## Out of Scope

- Addressing other `eslint-disable` comments or `any` types in other files across the repository.
- Refactoring the implementation of the affected functions beyond type annotations.
