# Plan: Architect Agent Code Review + Self-Healing Pipeline

## Overview

This plan adds architect code review after build, a targeted fix stage, and a verify loop to the Cody pipeline. The pipeline becomes self-healing: when verify fails, it loops back to fix instead of failing.

## Pipeline Flow (Before vs After)

### Before
```
architect → plan-gap → build → commit → verify → pr
```

### After
```
architect → plan-gap → build → commit → review → fix → commit-fix → verify → pr
                                                              ↑
                                                              │
                                                    [VERIFY FAIL]
                                                    (loops back to fix)
```

---

## Step 1: Add review and fix to ALL_STAGES

**File**: `scripts/cody/stage-prompts.ts`
**Lines**: 29-41

**Current Code**:
```typescript
export const ALL_STAGES = [
  'taskify',
  'spec',
  'gap',
  'clarify',
  'architect',
  'plan-gap',
  'build',
  'commit',
  'verify',
  'autofix',
  'pr',
] as const
```

**Change To**:
```typescript
export const ALL_STAGES = [
  'taskify',
  'spec',
  'gap',
  'clarify',
  'architect',
  'plan-gap',
  'build',
  'commit',
  'review',    // NEW
  'fix',       // NEW
  'commit-fix', // NEW: commit after fix stage
  'verify',
  'autofix',
  'pr',
] as const

export type Stage = (typeof ALL_STAGES)[number]
```

**Also add to STAGE_CONTEXT_FILES** (lines 66-78):
```typescript
export const STAGE_CONTEXT_FILES: Record<Stage, string[]> = {
  // ... existing entries ...
  review: ['review.md', 'build.md', 'plan.md', 'spec.md', 'clarified.md'],
  fix: [
    'verify-failures.md',  // Errors from verify stage
    'review.md',           // Issues from architect review
    'rerun-feedback.md',   // Human feedback via @cody fix
    'fix-summary.md',     // Previous fix attempts
    'build.md',           // What was built (for context)
    'plan.md',            // Implementation plan
    'spec.md',            // Original specification
    'clarified.md',       // Design decisions
  ],
  'commit-fix': ['fix-summary.md', 'verify-failures.md'], // Files to include in fix commit
}
```

**Add stage instructions** (lines 93-137):
```typescript
export const stageInstructions: Record<Stage, (taskId: string) => string> = {
  // ... existing entries ...
  review: () => `CRITICAL: CODE REVIEW STAGE

You are reviewing already-generated code. DO NOT modify code files.
Your job is to analyze and produce a review.md with findings.

Read the generated source files and identify issues.`,

  fix: () => `CRITICAL: TARGETED FIX STAGE

You are applying MINIMAL fixes to resolve identified issues.
DO NOT regenerate entire codebase.
DO NOT refactor or rewrite working code.
Only fix the specific issues identified.`,
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 2: Define Review Stage in Pipeline

**File**: `scripts/cody/pipeline/definitions.ts`
**Location**: In `createStageDefinitions()` function, around line 200

**Add after build stage definition**:
```typescript
// Review stage - architect agent reviews generated code
stages.set('review', {
  name: 'review',
  type: 'agent',
  timeout: STAGE_TIMEOUTS.review ?? DEFAULT_TIMEOUT,
  maxRetries: 0,  // Review runs once
  shouldSkip: (ctx) => {
    // Skip if complexity below threshold
    const complexitySkip = skipIfBelowComplexity(ctx, 'review')
    if (complexitySkip.shouldSkip) return complexitySkip
    return { shouldSkip: false }
  },
  postActions: [
    { type: 'analyze-review-findings' },  // NEW: Parse review.md, determine if fix needed
    { type: 'commit-task-files', stagingStrategy: 'task-only', push: true },
  ],
})
```

**Complexity**: Medium
**Files Modified**: 1

---

## Step 3: Define Fix Stage in Pipeline

**File**: `scripts/cody/pipeline/definitions.ts`
**Location**: After review stage definition

**Add**:
```typescript
// Fix stage - targeted fixes based on review or verify failures
stages.set('fix', {
  name: 'fix',
  type: 'agent',
  timeout: STAGE_TIMEOUTS.fix ?? ms('10m'),  // 10 min timeout
  maxRetries: 2,  // Allow up to 2 fix attempts
  shouldSkip: (ctx) => {
    // NOTE: shouldSkip is synchronous - use sync import from definitions.ts scope
    // Skip if coming from verify failure but max attempts reached
    // loadState is already imported at top of definitions.ts
    const state = loadState(ctx.taskId)
    const fixStage = state?.stages?.fix
    if (fixStage?.fixAttempt !== undefined && fixStage.fixAttempt >= 2) {
      return { shouldSkip: true, reason: 'Max fix attempts reached' }
    }
    // Skip if review found no issues AND no verify failures exist
    const reviewStage = state?.stages?.review
    if (!reviewStage?.issuesFound) {
      const verifyFailuresPath = path.join(ctx.taskDir, 'verify-failures.md')
      if (!fs.existsSync(verifyFailuresPath)) {
        return { shouldSkip: true, reason: 'No issues to fix' }
      }
    }
    return { shouldSkip: false }
  },
  postActions: [
    { type: 'commit-task-files', stagingStrategy: 'tracked+task', push: true },
    { type: 'clear-verify-failures' }, // Clear failures after fix attempt
  ],
})
```

**Complexity**: Medium
**Files Modified**: 1

---

## Step 3b: Define commit-fix Stage in Pipeline

**File**: `scripts/cody/pipeline/definitions.ts`
**Location**: After fix stage definition

**Add**:
```typescript
// Commit-fix stage - commits the fix changes before verify
// Mirrors the existing 'commit' stage pattern: type 'git', no postActions.
// The GitCommitFixHandler (see Step 3c) treats "No changes" as success
// instead of failure, so the pipeline doesn't crash when fix is skipped.
stages.set('commit-fix', {
  name: 'commit-fix',
  type: 'git',
  timeout: STAGE_TIMEOUTS['commit-fix'] ?? ms('2m'),
  maxRetries: 0,
  shouldSkip: (ctx) => {
    // Skip commit-fix if fix stage was skipped (nothing to commit)
    const state = loadState(ctx.taskId)
    if (state?.stages?.fix?.state === 'skipped') {
      return { shouldSkip: true, reason: 'Fix was skipped, nothing to commit' }
    }
    return { shouldSkip: false }
  },
})
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 3c: Add GitCommitFixHandler to Handler Registry

**File**: `scripts/cody/handlers/git-handler.ts`
**Location**: After GitCommitHandler class

**Add**:
```typescript
/**
 * Tolerant commit handler for commit-fix stage.
 * Treats "No changes" as completed (not failed), since fix stage
 * may produce no file changes if review found only minor issues
 * or if the fix was applied but resulted in identical code.
 */
export class GitCommitFixHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const handler = new GitCommitHandler()
    const result = await handler.execute(ctx, def)

    // Treat "No changes" as success instead of failure
    if (result.outcome === 'failed' && result.reason?.includes('No changes')) {
      return { outcome: 'completed', retries: 0 }
    }
    return result
  }
}
```

**File**: `scripts/cody/handlers/handler.ts`
**Location**: In the named handler switch (line 31-38)

**Add case for commit-fix**:
```typescript
export function getHandler(stageName: string, stageType: StageType): StageHandler {
  // Named handlers first - for stages that need special handling
  switch (stageName) {
    case 'commit':
      return new GitCommitHandler()
    case 'commit-fix':                  // NEW
      return new GitCommitFixHandler()   // NEW - tolerant of no-changes
    case 'pr':
      return new GitPrHandler()
    case 'verify':
      return new ScriptedVerifyHandler()
  }
  // ... rest unchanged
}
```

**Also update import** at top of handler.ts:
```typescript
import { GitCommitHandler, GitCommitFixHandler, GitPrHandler } from './git-handler'
```

**Complexity**: Low
**Files Modified**: 2 (`git-handler.ts`, `handler.ts`)

---

## Step 4: Update Pipeline Order

**File**: `scripts/cody/pipeline/definitions.ts`
**Lines**: 43-57

**Current Code**:
```typescript
export const IMPL_ORDER_STANDARD: PipelineStep[] = [
  'architect',
  'plan-gap',
  'build',
  'commit',
  'verify',
  'pr',
]
```

**Change To**:
```typescript
export const IMPL_ORDER_STANDARD: PipelineStep[] = [
  'architect',
  'plan-gap',
  'build',
  'commit',
  'review',    // NEW
  'fix',       // NEW
  'commit-fix', // NEW: commit fix changes before verify
  'verify',
  'pr',
]

// Also update IMPL_ORDER_LIGHTWEIGHT:
export const IMPL_ORDER_LIGHTWEIGHT: PipelineStep[] = [
  'architect',
  'build',
  'commit',
  'review',    // NEW
  'fix',       // NEW
  'commit-fix', // NEW
  'verify',
  'pr',
]

// NEW: Fix-only pipeline order for @cody fix mode
export const FIX_ORDER: PipelineStep[] = [
  'review',    // Run review first to identify issues
  'fix',       // Apply fixes
  'commit-fix', // Commit the fixes
  'verify',    // Verify the fixes
  'pr',        // Create PR if verify passes
]
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 5: Add Timeout Constants

**File**: `scripts/cody/agent-runner.ts`

**Find STAGE_TIMEOUTS and add**:
```typescript
export const STAGE_TIMEOUTS: Record<string, number> = {
  // ... existing entries ...
  review: ms('15m'),   // 15 min for review
  fix: ms('10m'),      // 10 min for fixes
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 6: Create Review Agent Prompt

**File**: `scripts/cody/stage-prompts.ts`
**Location**: Add new function, around line 200

**Add**:
```typescript
/**
 * Build the review agent prompt
 * This is used when the review stage runs
 */
export function buildReviewPrompt(taskId: string, taskDir: string): string {
  return `# Code Review: ${taskId}

## Your Role
You are a code review agent. Review the generated code for quality, correctness, and best practices.

## Review Scope
Analyze the generated source files for:

### Critical Issues (BLOCKS merge)
- Security vulnerabilities
- Data loss risks
- Runtime crashes
- Authentication/authorization bypasses

### Major Issues (MUST fix)
- TypeScript type errors
- Missing functionality
- Test failures
- Logic errors

### Minor Issues (SHOULD fix)
- Code style inconsistencies
- Missing error handling
- Performance concerns

## Input Files
- build.md - What was built
- plan.md - The implementation plan
- spec.md - Original specification
- Source files in src/

## Your Task
1. Read all generated source files in src/
2. Identify issues by severity
3. Write review.md with your findings

## Output Format (review.md)
\`\`\`markdown
# Code Review: ${taskId}

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
- [x] Yes - critical or major issues need fixing
- [ ] No - code looks good to proceed
\`\`\`

## Important
- Be thorough but objective
- Don't flag style preferences as critical
- If code is acceptable, mark "Fix Required: No"
- Write actual file:line references for issues
`
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 7: Create Fix Agent Prompt

**File**: `scripts/cody/stage-prompts.ts`
**Location**: Add new function, after buildReviewPrompt

**Add**:
```typescript
/**
 * Build the fix agent prompt
 * This is used when the fix stage runs
 */
export function buildFixPrompt(taskId: string, taskDir: string): string {
  return `# Targeted Fix: ${taskId}

## Your Role
You are a targeted fix agent. Apply minimal fixes to resolve identified issues.

## Input Context (check what exists)
1. verify-failures.md - Errors from verify stage (most recent)
2. review.md - Issues from architect review
3. rerun-feedback.md - Human feedback via @cody fix

## Your Task
1. Read the issue description from available input files
2. Apply MINIMAL fixes - do NOT refactor or rewrite
3. Preserve working code
4. Do NOT touch files unrelated to the issue

## Constraints
- Maximum 10 minutes runtime
- Only modify files directly related to the issue
- Do NOT regenerate entire codebase
- Do NOT add new features
- Do NOT modify tests (let the build agent handle tests)

## Output
Modify the source files directly.
Write fix-summary.md:

\`\`\`markdown
# Fix Summary: ${taskId}

## Issues Addressed
- {issue description from review/verify/human}

## Files Modified
- {filename} - {change description}

## Verification
Run TypeScript compiler to ensure no type errors.
`
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 8: Add New Post-Action Types

**File**: `scripts/cody/engine/types.ts`
**Location**: Around line 175, add new action types

**Add**:
```typescript
// Analyze-review-findings action - parses review.md to determine if fix needed
export type AnalyzeReviewFindingsAction = {
  type: 'analyze-review-findings'
}

// Clear-verify-failures action - clears previous verify failures for retry
export type ClearVerifyFailuresAction = {
  type: 'clear-verify-failures'
}
```

**Update PostAction union** (around line 256):
```typescript
export type PostAction =
  | ValidateTaskJsonAction
  | SetClassificationLabelsAction
  | ResolveProfileAction
  | CheckGateAction
  | CommitTaskFilesAction
  | ArchiveRerunFeedbackAction
  | ValidatePlanExistsAction
  | ValidateBuildContentAction
  | ValidateSrcChangesAction
  | RunTscAction
  | RunUnitTestsAction
  | RunQualityWithAutofixAction
  | ParallelPostAction
  | AnalyzeReviewFindingsAction      // NEW
  | ClearVerifyFailuresAction        // NEW
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 9: Implement Post-Action Handlers

**File**: `scripts/cody/pipeline/post-actions.ts`
**Location**: Find executePostAction function

**Add new case in switch statement**:
```typescript
case 'analyze-review-findings': {
  const reviewPath = path.join(ctx.taskDir, 'review.md')
  
  let fixNeeded = false
  let reviewSummary = { critical: 0, major: 0, minor: 0 }
  
  if (fs.existsSync(reviewPath)) {
    const content = fs.readFileSync(reviewPath, 'utf-8')
    
    // Parse review findings
    const criticalMatch = content.match(/Critical:\s*(\d+)/)
    const majorMatch = content.match(/Major:\s*(\d+)/)
    const fixRequiredMatch = content.match(/Fix Required.*\[\s*x\s*\]\s*Yes/)
    
    reviewSummary = {
      critical: parseInt(criticalMatch?.[1] || '0'),
      major: parseInt(majorMatch?.[1] || '0'),
      minor: 0,
    }
    
    fixNeeded = (reviewSummary.critical > 0 || reviewSummary.major > 0) || fixRequiredMatch !== null
  }

  // Update state to track findings
  const { loadState, writeState, updateStage } = await import('../engine/status')
  const state = loadState(ctx.taskId)
  if (state) {
    const updated = updateStage(state, 'review', {
      issuesFound: fixNeeded,
      reviewSummary,
    })
    writeState(ctx.taskId, updated)
  }

  logger.info(`Review findings: ${reviewSummary.critical} critical, ${reviewSummary.major} major, fixNeeded=${fixNeeded}`)
  
  return { success: true, data: { fixNeeded } }
}

case 'clear-verify-failures': {
  // Clear verify-failures.md file if exists
  const verifyFailuresPath = path.join(ctx.taskDir, 'verify-failures.md')
  if (fs.existsSync(verifyFailuresPath)) {
    fs.unlinkSync(verifyFailuresPath)
    logger.info('Cleared verify-failures.md')
  }
  return { success: true }
}
```

**Also add to PostActionResult type** if needed.

**Complexity**: Medium
**Files Modified**: 1

---

## Step 10: Add Verify Loop Logic to State Machine

**File**: `scripts/cody/engine/state-machine.ts`
**Location**: In `handleStageResult` function (around line 553-566)

**Approach**: Intercept verify failures in `handleStageResult`, BEFORE calling `completeState(state, 'failed')`. The existing main `while(true)` loop will naturally continue after we return the modified state.

**Find where verify stage fails** (around line 553 in `handleStageResult`):

```typescript
} else if (result.outcome === 'failed') {
  state = updateStage(state, stageName, {
    state: 'failed',
    error: result.reason,
  })

  // If non-advisory stage failed, mark pipeline as failed
  if (!def.advisory) {
    // Set lifecycle label to failed
    if (ctx.input.issueNumber) {
      setLifecycleLabel(ctx.input.issueNumber, 'cody:failed')
    }
    return completeState(state, 'failed')  // <-- INTERCEPT HERE
  }
}
```

**Replace the failure handling block with**:

```typescript
} else if (result.outcome === 'failed') {
  // VERIFY LOOP: Check if verify failed and we should retry with fix
  if (stageName === 'verify' && !def.advisory) {
    // Read maxFixAttempts from state (set during fix stage init)
    // We can't use pipeline.stages here because handleStageResult
    // doesn't receive the pipeline parameter
    const maxAttempts = state.stages['fix']?.maxFixAttempts ?? 2
    
    // Get current fix attempt from state
    const currentAttempt = state.stages['fix']?.fixAttempt ?? 0
    
    if (currentAttempt < maxAttempts) {
      // Capture verify failures for fix stage
      const verifyFailuresPath = path.join(ctx.taskDir, 'verify-failures.md')
      const errorOutput = result.reason || 'Verify failed - check logs'
      
      // Try to capture more detailed output from verify scripts
      let detailedOutput = errorOutput
      try {
        const tscOutput = fs.readFileSync(path.join(ctx.taskDir, 'tsc-output.txt'), 'utf-8').slice(0, 5000)
        const lintOutput = fs.readFileSync(path.join(ctx.taskDir, 'lint-output.txt'), 'utf-8').slice(0, 5000)
        detailedOutput = `# Verify Failures\n\n${errorOutput}\n\n## TypeScript Errors\n\`\`\`\n${tscOutput}\n\`\`\`\n\n## Lint Errors\n\`\`\`\n${lintOutput}\n\`\`\``
      } catch {
        // Files don't exist, use basic error
      }
      
      fs.writeFileSync(verifyFailuresPath, detailedOutput)
      
      // Increment fix attempt
      const newFixAttempt = currentAttempt + 1
      
      // Reset fix, commit-fix, and verify to pending
      state = updateStage(state, 'fix', {
        state: 'pending',
        fixAttempt: newFixAttempt,
        maxFixAttempts: maxAttempts,
      })
      state = updateStage(state, 'commit-fix', { state: 'pending' })
      state = updateStage(state, 'verify', { state: 'pending' })
      
      // Update the failed verify stage with attempt info
      state = updateStage(state, 'verify', {
        state: 'failed',
        error: result.reason,
        retries: currentAttempt, // Track which attempt failed
      })
      
      writeState(ctx.taskId, state)
      
      logger.info(`🔄 Verify failed, looping to fix (attempt ${newFixAttempt}/${maxAttempts})`)
      
      // IMPORTANT: Return state WITHOUT calling completeState('failed')
      // The main while(true) loop will continue and resolveNextStep will find 'fix' as next pending stage
      return state
    } else {
      logger.error(`Max fix attempts (${maxAttempts}) reached, pipeline failing`)
      // Fall through to normal failure handling
    }
  }
  
  // Normal failure handling
  state = updateStage(state, stageName, {
    state: 'failed',
    error: result.reason,
  })

  // If non-advisory stage failed, mark pipeline as failed
  if (!def.advisory) {
    // Set lifecycle label to failed
    if (ctx.input.issueNumber) {
      setLifecycleLabel(ctx.input.issueNumber, 'cody:failed')
    }
    return completeState(state, 'failed')
  }
}
```

**Also need to ensure StageStateV2 can store fixAttempt**. Add to types.ts StageStateV2:
```typescript
export interface StageStateV2 {
  // ... existing fields
  fixAttempt?: number
  maxFixAttempts?: number
  issuesFound?: boolean
}
```

**Complexity**: High
**Files Modified**: 2 (`state-machine.ts`, `types.ts`)

---

## Step 11: Add Fix Mode to Parse Inputs

**File**: `scripts/cody/parse-inputs.ts`
**Lines**: 33

**Current Code**:
```typescript
export const VALID_MODES = ['spec', 'impl', 'rerun', 'full', 'status']
```

**Change To**:
```typescript
export const VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status']
```

**Also update mode detection** (around line 244):
```typescript
} else if (VALID_MODES.includes(firstWord)) {
  outputs.mode = firstWord
```

This already handles 'fix' since it's now in VALID_MODES.

**Complexity**: Low
**Files Modified**: 1

---

## Step 12: Add Fix Mode to CodyInput Type

**File**: `scripts/cody/cody-utils.ts`
**Lines**: 21-22, 91

**Update interface** (line 21):
```typescript
export interface CodyInput {
  mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status'
  // ... rest unchanged
}
```

**Update VALID_MODES constant** (line 91):
```typescript
const VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status'] as const
```

**Also update isValidMode function**:
```typescript
export function isValidMode(mode: string): mode is (typeof VALID_MODES)[number] {
  return VALID_MODES.includes(mode as (typeof VALID_MODES)[number])
}
```

**IMPORTANT: Also fix implicit feedback capture for fix mode**:
In the same file, find the `parseCommentBody` function (around line 870):

The current code only captures implicit feedback for `rerun` mode:
```typescript
// Line 871 - current code:
if (mode === 'rerun') {
```

**Change to**:
```typescript
// Allow implicit feedback for both rerun and fix modes
// This handles "@cody fix the button isn't showing" → feedback = "the button isn't showing"
if (mode === 'rerun' || mode === 'fix') {
```

**Why**: When users write `@cody fix the button isn't showing`, the text after "fix" should be captured as feedback for the fix agent to use. Currently only rerun mode captures this, so fix mode would lose the user's description.

**Complexity**: Low
**Files Modified**: 1 (`scripts/cody/cody-utils.ts`)

---

## Step 13: Add runFixMode Handler in Entry

**File**: `scripts/cody/entry.ts`
**Location**: In main() switch statement (around line 243)

**Add case**:
```typescript
case 'fix':
  await runFixMode(ctx)
  break
```

**Add function** (after runRerunMode function, around line 618):
```typescript
import { FIX_ORDER } from './pipeline/definitions'

/**
 * Fix mode - applies targeted fixes without regenerating entire codebase
 */
async function runFixMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  logger.info('Running Cody FIX pipeline (targeted fix)...\n')

  // Ensure feedback exists
  if (!input.feedback) {
    input.feedback = 'Fix requested via @cody fix command'
  }

  // Write feedback to file
  const feedbackPath = path.join(taskDir, 'rerun-feedback.md')
  fs.writeFileSync(
    feedbackPath,
    `# Fix Feedback - ${new Date().toISOString()}\n\n${input.feedback}\n`,
  )

  // Read task definition for profile resolution
  let taskDef = null
  try {
    taskDef = readTask(taskDir)
  } catch {
    logger.warn('Could not read task.json for profile resolution, using default')
  }
  ctx.taskDef = taskDef
  if (taskDef) {
    const { resolvePipelineProfile } = await import('./pipeline-utils')
    ctx.profile = resolvePipelineProfile(taskDef)
  }

  // Import necessary functions
  const { loadState, writeState, updateStage, initState } = await import('./engine/status')
  const { resolvePipelineForMode } = await import('./engine/pipeline-resolver')
  
  // Load existing state or create new one
  let state = loadState(input.taskId)
  
  // If no existing state, create fresh state with FIX_ORDER stages
  if (!state) {
    // initState creates a fresh v2 state and writes it to disk
    state = initState(ctx, 'fix')
    
    // Initialize all FIX_ORDER stages to pending
    for (const stageName of FIX_ORDER) {
      state = updateStage(state, stageName, { state: 'pending', retries: 0 })
    }
    writeState(input.taskId, state)
  }
  
  // Set fix stage to pending and initialize fix attempt if not set
  const existingFixAttempt = state.stages['fix']?.fixAttempt ?? 0
  state = updateStage(state, 'fix', {
    state: 'pending',
    fixAttempt: existingFixAttempt,
    maxFixAttempts: 2,
  })
  
  // Also ensure commit-fix and verify are pending
  state = updateStage(state, 'commit-fix', { state: 'pending' })
  state = updateStage(state, 'verify', { state: 'pending' })
  state = updateStage(state, 'review', { state: 'pending' })
  
  // Set initial cursor
  state = { ...state, cursor: 'review', state: 'running' }
  writeState(input.taskId, state)
  
  // Build pipeline for fix mode - resolvePipelineForMode maps 'fix' to FIX_ORDER
  const pipeline = resolvePipelineForMode('fix', ctx.profile, false, ctx)
  
  // Run pipeline - it will find the first pending stage (review) and continue
  await runPipeline(ctx, pipeline)

  logger.info('\n✅ Fix complete!')
}
```

**Key fixes from original**:
1. Uses `resolvePipelineForMode('fix', ...)` which maps to `FIX_ORDER` (Step 14)
2. Creates new state via `initState(ctx, 'fix')` if none exists
3. Initializes all FIX_ORDER stages to pending so they all run
4. Sets `cursor` and `state: 'running'` to ensure pipeline continues

**Complexity**: Medium
**Files Modified**: 1

---

## Step 14: Update Pipeline Resolver

**File**: `scripts/cody/engine/pipeline-resolver.ts`
**Lines**: 17-38

**Update function signature and switch**:
```typescript
import { FIX_ORDER, IMPL_ORDER_STANDARD, IMPL_ORDER_LIGHTWEIGHT } from '../pipeline/definitions'

export function resolvePipelineForMode(
  mode: 'spec' | 'impl' | 'full' | 'rerun' | 'fix' | 'status',
  profile: 'standard' | 'lightweight',
  clarify: boolean,
  ctx: PipelineContext,
): PipelineDefinition {
  switch (mode) {
    case 'spec':
    case 'full':
      return buildPipeline(mode, profile, clarify, ctx)
    case 'impl':
      return buildPipeline('impl', profile, clarify, ctx)
    case 'rerun':
      // Rerun uses standard impl order
      const rerunOrder = profile === 'lightweight' ? IMPL_ORDER_LIGHTWEIGHT : IMPL_ORDER_STANDARD
      return { stages: buildPipeline('full', profile, clarify, ctx).stages, order: rerunOrder }
    case 'fix':
      // Fix mode uses FIX_ORDER (review → fix → commit-fix → verify → pr)
      const fixPipeline = buildPipeline('full', profile, clarify, ctx)
      return { stages: fixPipeline.stages, order: FIX_ORDER }
    case 'status':
      return { stages: new Map(), order: [] }
    default:
      return buildPipeline('full', profile, clarify, ctx)
  }
}
```

**Note**: The fix mode uses the same stage definitions from buildPipeline but with a different order (FIX_ORDER). This ensures all the stage logic (timeouts, postActions, etc.) is preserved while only changing execution order.

**Complexity**: Low
**Files Modified**: 1

---

## Step 15: Update Type Definitions

**File**: `scripts/cody/engine/types.ts`
**Location**: Add new types

**Add to StageStatus interface** (around line 90):
```typescript
export interface StageStatus {
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

**Add new result types** (around line 300):
```typescript
export interface ReviewStageResult {
  issuesFound: boolean
  summary: {
    critical: number
    major: number
    minor: number
  }
}

export interface FixStageResult {
  attempt: number
  maxAttempts: number
  issuesFixed: string[]
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 16: Handle Review/Fix Stages in Handler Registry

**File**: `scripts/cody/handlers/handler.ts`
**Lines**: 29-55

**No changes needed** - review and fix stages use type 'agent', which defaults to AgentHandler.

The agent handler uses `buildStagePrompt` from `stage-prompts.ts`, which already supports our new stages via the `stageInstructions` added in Step 1. The generic prompt path includes:
- File listings for the stage (from STAGE_CONTEXT_FILES)
- Feedback injection (from rerun-feedback.md if exists)
- Task context files
- Stage-specific instructions from `stageInstructions['review']` and `stageInstructions['fix']`

**Complexity**: None
**Files Modified**: 0

---

## Step 17: Add Review/Fix Thresholds to STAGE_COMPLEXITY_THRESHOLDS

**File**: `scripts/cody/pipeline-utils.ts`
**Location**: Find STAGE_COMPLEXITY_THRESHOLDS

**Add review and fix thresholds**:
```typescript
export const STAGE_COMPLEXITY_THRESHOLDS: Record<string, number> = {
  taskify: 0,
  spec: 20,
  gap: 30,
  clarify: 40,
  architect: 30,
  'plan-gap': 40,
  build: 50,
  review: 30,      // NEW - skip review for low complexity tasks
  fix: 0,          // NEW - never skip fix
  'commit-fix': 0, // NEW - always run
  // ... existing
}
```

**Note**: The review stage will be skipped for low-complexity tasks, but the fix stage will always run (even if skipped via its own shouldSkip logic for "no issues found").

**Complexity**: Low
**Files Modified**: 1
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 18: Add review and fix Agents to opencode.json

**File**: `opencode.json`
**Location**: In the `agent` object

The pipeline runner spawns `opencode run --agent <stage>`, which loads the agent configuration from `opencode.json`. We need to add entries for `review` and `fix`:

**Add to the agent object**:
```json
"review": {
  "model": "anthropic/claude-opus-4-6",
  "description": "Architect-level code review of generated code for quality, security, and correctness"
},
"fix": {
  "model": "minimax-coding-plan/MiniMax-M2.5",
  "description": "Targeted fixes for issues found by review or verify stages"
}
```

**Model selection rationale**:
- `review` → `claude-opus-4-6`: Code review requires deep architectural reasoning, security analysis, and understanding of complex code patterns. This is the same model used by the architect agent.
- `fix` → `MiniMax-M2.5`: Targeted code fixes are implementation work, same domain as the build agent. Fast and good at precise code changes.

**Complexity**: Low
**Files Modified**: 1

---

## Summary of Changes

| Step | File | Change | Complexity |
|------|------|--------|------------|
| 1 | stage-prompts.ts | Add review/fix/commit-fix to ALL_STAGES + context files + instructions | Low |
| 2 | definitions.ts | Define review stage | Medium |
| 3 | definitions.ts | Define fix stage + clear-verify-failures postAction | Medium |
| 3b | definitions.ts | Define commit-fix stage with shouldSkip | Low |
| 3c | git-handler.ts, handler.ts | Add GitCommitFixHandler (tolerant of no-changes) + register in handler | Low |
| 4 | definitions.ts | Update IMPL_ORDER + add FIX_ORDER | Low |
| 5 | agent-runner.ts | Add timeout constants for review, fix, commit-fix | Low |
| 6 | stage-prompts.ts | Create buildReviewPrompt (optional, used by generic path) | Low |
| 7 | stage-prompts.ts | Create buildFixPrompt (optional, used by generic path) | Low |
| 8 | types.ts | Add AnalyzeReviewFindings, ClearVerifyFailures types + StageStateV2 extensions | Low |
| 9 | post-actions.ts | Implement analyze-review-findings, clear-verify-failures | Medium |
| 10 | state-machine.ts | Add verify→fix loop logic in handleStageResult (uses state for maxAttempts) | High |
| 11 | parse-inputs.ts | Add fix to VALID_MODES | Low |
| 12 | cody-utils.ts | Add fix to CodyInput.mode + fix implicit feedback for fix mode | Low |
| 13 | entry.ts | Add runFixMode handler using resolvePipelineForMode | Medium |
| 14 | pipeline-resolver.ts | Handle fix mode with FIX_ORDER | Low |
| 15 | types.ts | Ensure StageStateV2 has fixAttempt, maxFixAttempts, issuesFound | Low |
| 16 | handler.ts | Register commit-fix handler (see Step 3c) | Low |
| 17 | pipeline-utils.ts | Add review/fix/commit-fix to STAGE_COMPLEXITY_THRESHOLDS | Low |
| 18 | opencode.json | Add review (opus) and fix (MiniMax) agent definitions | Low |

**Total Files Modified**: ~14
**Total Complexity**: Medium-High

---

## Testing Plan

### Unit Tests (Step 11, 12)
- `parse-inputs.test.ts`: Test fix mode recognition
- `cody-utils.test.ts`: Test isValidMode('fix')

### Integration Tests (New Files)
- `review-stage.int.spec.ts`
- `fix-stage.int.spec.ts`
- `verify-loop.int.spec.ts`
- `fix-mode.int.spec.ts`

### Manual Verification
1. Run pipeline on test task
2. Verify review runs after build
3. Inject verify failure, confirm loop
4. Test @cody fix command
