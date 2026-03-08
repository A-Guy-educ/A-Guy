# Spec: Architect Agent Code Review + Self-Healing Pipeline

## Overview

Add an architect agent review stage after build, a fix stage for targeted corrections, and a verify loop that automatically triggers fixes when quality gates fail. This creates a self-healing pipeline that can resolve issues autonomously up to a configurable retry limit.

## Problem Statement

### Current Pipeline Flow
```
architect → plan-gap → build → commit → verify → pr
```

### Issues with Current Flow
1. **No code review**: Generated code is committed without architect review
2. **Verify failure = pipeline failure**: When quality gates fail, pipeline stops
3. **No self-healing**: Requires human intervention to fix verify failures
4. **Fix mode gap**: Cannot apply targeted fixes without full rebuild

## Requirements

### REQ-1: Review Stage (Architect Agent)
After build completes and code is committed, run the architect agent to review the generated code before proceeding to verify.

- **Stage name**: `review`
- **Agent**: Reuse architect agent with modified instructions
- **Input files**: Generated source files in `src/`
- **Output**: `review.md` with findings (issues, suggestions, severity)
- **Timeout**: Same as architect stage
- **Post-actions**: 
  - If issues found → prepare fix context
  - If no issues → proceed to verify

### REQ-2: Fix Stage
After review (or directly triggered), apply targeted fixes to the generated code.

- **Stage name**: `fix`
- **Input**: 
  - `review.md` (if coming from review stage)
  - `verify-failures.md` (if verify failed)
  - `rerun-feedback.md` (if human-triggered fix)
- **Behavior**: 
  - Read failure context
  - Apply minimal targeted fixes
  - Do NOT regenerate entire code (unlike build)
- **Output**: Modified source files + `fix-summary.md`
- **Timeout**: 10 minutes max (should be quick fixes)

### REQ-3: Verify Loop
When verify stage fails, automatically loop back to fix stage instead of failing the pipeline.

- **Loop trigger**: verify stage returns failure
- **Loop target**: fix stage
- **Max iterations**: 2 (configurable)
- **Context passed**: verify error output as `verify-failures.md`
- **Exit condition**: verify passes OR max iterations reached

### REQ-4: Pipeline Order Update
Update the implementation pipeline order to include review and fix stages:

```
Current:
architect → plan-gap → build → commit → verify → pr

Proposed:
architect → plan-gap → build → commit → review → fix → commit → verify → pr
                    ↑                               │
                    └──────── [VERIFY FAIL] ──────┘
```

### REQ-5: Fix Command Mode
Add a new CLI mode that allows targeted fixes without full rebuild.

- **Command**: `@cody fix --feedback="..."`
- **Behavior**: 
  - Skip build stage (use existing code)
  - Run fix stage with provided feedback
  - Commit fixes
  - Run verify
- **Use case**: Human noticed issue, wants quick fix without regeneration

### REQ-6: Review Agent Prompt
Create a dedicated system prompt for the review agent that instructs it to:

1. **Review scope**:
   - Code quality and best practices
   - Missing edge cases
   - Potential bugs or logic errors
   - Security concerns
   - TypeScript type safety
   - Test coverage gaps

2. **Output format** (review.md):
   ```markdown
   # Code Review: {taskId}
   
   ## Summary
   - Issues Found: {n}
   - Critical: {n}
   - Major: {n}
   - Minor: {n}
   
   ## Critical Issues
   - {description} (file:line)
   
   ## Major Issues
   - {description} (file:line)
   
   ## Minor Issues / Suggestions
   - {description} (file:line)
   
   ## Fix Required
   - [ ] Yes - issues need fixing
   - [ ] No - code looks good
   ```

3. **Decision**: 
   - If critical/major issues found → set flag to trigger fix stage
   - If only minor → proceed to verify

### REQ-7: Fix Agent Prompt
Create a dedicated system prompt for the fix agent:

1. **Input context**:
   - Review findings OR
   - Verify failure output OR
   - Human feedback

2. **Instructions**:
   - Read the issue description
   - Apply MINIMAL fixes (do not refactor or rewrite)
   - Do NOT regenerate unrelated code
   - Preserve working code

3. **Output**:
   - Modified files (minimal changes)
   - `fix-summary.md` documenting what was fixed

### REQ-8: State Machine Integration
Update the state machine to support:

1. **Stage loops**: Ability to reset to a previous stage after failure
2. **Retry tracking**: Count fix attempts in status.json
3. **Context preservation**: Pass failure context between stages

```typescript
// In status.json - track fix attempts
{
  "stages": {
    "review": { "state": "completed", "issuesFound": true },
    "fix": { "state": "running", "attempt": 1, "maxAttempts": 2 },
    "verify": { "state": "failed", "error": "..." }
  }
}
```

### REQ-9: Post-Actions for Review/Fix Stages

#### Review Stage Post-Actions
```typescript
postActions: [
  { type: 'analyze-review-findings' },  // Parse review.md, determine if fix needed
  { type: 'commit-task-files', ... },   // Commit review.md
]
```

#### Fix Stage Post-Actions
```typescript
postActions: [
  { type: 'commit-task-files', ... },  // Commit fixes
  { type: 'clear-verify-failures' },   // Clear previous failures for retry
]
```

## Technical Implementation

### File Changes Required

| File | Change |
|------|--------|
| `stage-prompts.ts` | Add 'review' and 'fix' to ALL_STAGES |
| `pipeline/definitions.ts` | Add review and fix stage definitions |
| `pipeline-resolver.ts` | Handle new 'fix' mode |
| `entry.ts` | Add runFixMode() handler |
| `cody-utils.ts` | Add 'fix' to valid modes |
| `parse-inputs.ts` | Add 'fix' mode parsing |
| `engine/state-machine.ts` | Add loop logic for verify→fix |
| `engine/types.ts` | Add ReviewStageResult, FixStageResult types |
| `handlers/agent-handler.ts` | Handle review and fix stage types |
| `stage-prompts.ts` | Add REVIEW_AGENT_PROMPT and FIX_AGENT_PROMPT |

### Stage Type Support
The state machine already supports 'agent' and 'scripted' stage types. Review and fix will both be 'agent' type.

### Status Schema Update
```typescript
// Add to StageStatus interface
interface StageStatus {
  // ... existing fields
  issuesFound?: boolean
  fixAttempt?: number
  maxFixAttempts?: number
  reviewSummary?: {
    critical: number
    major: number
    minor: number
  }
}
```

## Acceptance Criteria

### AC-1: Review Stage Executes
- [ ] Review stage runs after build completes
- [ ] Architect agent reviews generated code
- [ ] review.md is produced with findings

### AC-2: Fix Stage Applies Targeted Fixes
- [ ] Fix stage reads review findings or verify failures
- [ ] Applies minimal fixes to code
- [ ] Does NOT regenerate entire codebase

### AC-3: Verify Loop Works
- [ ] When verify fails, pipeline loops to fix
- [ ] Fix attempts are tracked (max 2)
- [ ] After max attempts, pipeline fails with clear error

### AC-4: Fix Mode Works
- [ ] @cody fix --feedback="..." command is recognized
- [ ] Skips build, runs fix with feedback
- [ ] Commits and runs verify

### AC-5: Pipeline Order Correct
- [ ] Stages execute in correct order
- [ ] Review runs before first verify
- [ ] Fix can run multiple times if needed

### AC-6: Status Tracking
- [ ] status.json tracks fix attempts
- [ ] Review findings are recorded
- [ ] Pipeline can resume from any point

## Design Decisions

### D1: Review Severity Threshold
**Decision**: Only trigger fix if critical or major issues found
- Critical: Security, data loss, runtime crashes
- Major: Type errors, missing functionality, test failures
- Minor: Style, suggestions → proceed to verify

### D2: Fix Loop Limit
**Decision**: Max 2 fix attempts per verify run
- Reason: Prevent infinite loops
- After 2 failures, pipeline fails with summary

### D3: Review Trigger
**Decision**: Review always runs after build (not optional)
- Reason: Ensures consistent code quality
- Can be disabled via task.json if needed

### D4: Fix Context Priority
When multiple sources exist, priority order:
1. Verify failures (most recent, most actionable)
2. Review findings (architect assessment)
3. Human feedback (via @cody fix)

### D5: Commit Strategy
- Review stage: commits review.md only
- Fix stage: commits source file changes
- Both use existing commit-task-files post-action

## Testing Strategy

### Unit Tests
- parse-inputs: fix mode recognition
- cody-utils: valid modes includes fix
- rerun-utils: fromStage resolution for fix mode

### Integration Tests
- Review stage produces review.md
- Fix stage applies minimal changes
- Verify loop triggers after failure
- Fix mode skips build stage

### Manual Testing
- Run pipeline on sample task
- Verify review stage executes
- Inject verify failure, confirm loop
- Test @cody fix command

## Risks and Mitigations

### R1: Infinite Loop
**Risk**: Fix → verify → fix → verify loops forever
**Mitigation**: Max 2 fix attempts, then fail

### R2: Review Takes Too Long
**Risk**: Review agent timeout
**Mitigation**: Set reasonable timeout (same as architect)

### R3: Fixes Wrong Code
**Risk**: Fix agent modifies wrong files
**Mitigation**: Explicit file list in context, minimal change instruction

### R4: Review False Positives
**Risk**: Review flags non-issues
**Mitigation**: Human can override with @cody proceed

## Related Issues

- #750: Equation Paper (original motivation)
- Self-healing pipeline requirements
- Cody fix mode feature request

## Success Metrics

1. **Self-healing rate**: % of verify failures resolved without human
2. **Fix quality**: Reviews contain actionable findings
3. **Pipeline speed**: Review + fix adds ~10-15 min max
4. **User satisfaction**: Fewer manual fix triggers needed
