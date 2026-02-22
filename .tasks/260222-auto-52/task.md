# Task

## Description
Two `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments are misplaced and suppress nothing. The actual `any` types they were meant to target are several lines below.

## Files Affected
- `src/server/services/exercise-conversion/helpers.ts` — line 68: targets line 69 (no `any`), actual `any` is on line 70
- `src/server/services/exercise-conversion/helpers.ts` — line 308: targets line 309 (no `any`), actual `any` is on line 323

## Expected Fix
Remove both stale `eslint-disable-next-line` comments. Optionally fix the underlying `any` types.

## Priority
LOW — Dead code, ESLint warns about unused directives
