# Apply Audit Report: 260226-fix-stream-message-callback

## Improvements Applied

| #   | Type   | Where                          | Status              |
| --- | ------ | ------------------------------ | ------------------- |
| 1   | PROMPT | AGENTS.md                     | IMPLEMENTED         |
| 2   | PROMPT | AGENTS.md                     | IMPLEMENTED         |
| 3   | INDEX  | .ai-docs/indexes/pattern-index.json | IMPLEMENTED |

## Changes Made

### AGENTS.md

Added two new sections to improve performance bug identification and spec writing:

1. **Performance Optimization** section (lines 1236-1272):
   - Added systematic approach for diagnosing React performance issues
   - Documented the common pitfall of misattributing performance issues
   - Included code examples showing the correct refs pattern for callback stabilization

2. **Spec Writing Best Practices** section (lines 1274-1285):
   - Guidelines for verifying pre-existing conditions before writing specs
   - Requirements to include actual code context (dependency arrays, useCallback usage)
   - Requirement to include ESLint warnings verbatim
   - Warning against misattribution with concrete example from this task

### .ai-docs/indexes/pattern-index.json

Added new pattern entry:
- **Pattern**: `refs-pattern`
- **Description**: Using refs to stabilize callback dependencies and prevent unnecessary recreations
- **Files**: [] (empty - pattern discovered but no canonical examples yet)

## Suggested Improvements (Not Applied)

1. **Type:** DOC
   - **Where:** docs/performance-patterns.md (new file)
   - **Reason:** Not in safe-path whitelist - creating new documentation files outside of the whitelisted paths requires manual review
   - **Suggestion:** Create `docs/performance-patterns.md` with the refs pattern documentation

2. **Type:** CODE_PATTERN
   - **Where:** tests/README.md
   - **Reason:** tests/README.md is not in safe-path whitelist - testing documentation is not part of the whitelisted paths
   - **Suggestion:** Add hooks stability test pattern documentation to tests/README.md

## Notes

- The auditor identified that the spec incorrectly attributed the issue to `streamMessage` needing useCallback, when the actual problem was `isLoading`/`isLoadingHistory` state dependencies in `injectExerciseContext`
- All three implementable improvements have been applied to whitelisted files
- The Primary Improvement (PROMPT) has been addressed by adding spec writing best practices to AGENTS.md
- Additional Finding #4 (INDEX) has been addressed by adding refs-pattern to the pattern index
