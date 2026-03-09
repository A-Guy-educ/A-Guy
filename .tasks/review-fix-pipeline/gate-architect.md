# Gate Review: Architect Agent Code Review + Self-Healing Pipeline

## Task Summary
- **Task ID**: review-fix-pipeline
- **Type**: Pipeline Infrastructure
- **Risk**: Medium
- **Complexity**: 65

## Overview
Add architect agent review stage after build, a fix stage for targeted corrections, and a verify loop that automatically triggers fixes when quality gates fail.

## Changes

### Pipeline Flow
```
architect → plan-gap → build → commit → review → fix → commit → verify → pr
                                                        ↑
                                                        │
                                              [VERIFY FAIL]
                                              (loop back to fix)
```

### Files Modified (15 total)
1. `stage-prompts.ts` - Add review/fix stages + prompts
2. `pipeline/definitions.ts` - Stage definitions + pipeline order
3. `pipeline/post-actions.ts` - analyze-review-findings action
4. `engine/state-machine.ts` - Verify loop logic
5. `parse-inputs.ts` - Fix mode parsing
6. `cody-utils.ts` - Fix mode type
7. `entry.ts` - runFixMode handler
8. `engine/pipeline-resolver.ts` - Fix mode resolution
9. `engine/types.ts` - New types
10. `handlers/agent-handler.ts` - Review/fix stage handling
11. `pipeline/skip-conditions.ts` - Review skip logic
12. Tests (5 new test files)

## Key Features

### 1. Review Stage
- Runs architect agent after build completes
- Reviews generated code for critical/major/minor issues
- Outputs review.md with findings

### 2. Fix Stage
- Applies targeted fixes based on review/verify failures
- Minimal changes only (not regeneration)
- Max 2 attempts before failing

### 3. Verify Loop
- When verify fails → loops to fix
- Tracks fix attempts in status.json
- After 2 failures → pipeline fails

### 4. Fix Mode (@cody fix)
- New command: `@cody fix --feedback="..."`
- Skips build, applies fix directly
- For quick targeted corrections

## Risk Assessment

### Medium Risk Justification
- State machine modifications could affect existing flows
- Loop logic needs careful testing
- Agent prompts need tuning

### Mitigations
- Max 2 fix attempts prevents infinite loops
- Review stage can be skipped for simple tasks
- Existing commit post-action reused

## Approval Required

- [ ] Architecture review of loop logic
- [ ] Security review of fix agent constraints
- [ ] Test coverage plan

## Questions for Reviewer

1. Is max 2 fix attempts appropriate?
2. Should review stage be optional for low-complexity tasks?
3. Is the verify loop exit condition clear?
