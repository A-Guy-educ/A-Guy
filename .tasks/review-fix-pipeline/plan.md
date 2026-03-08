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
architect → plan-gap → build → commit → review → fix → commit → verify → pr
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
  fix: ['fix-summary.md', 'verify-failures.md', 'review.md', 'rerun-feedback.md'],
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
    // Skip if coming from verify failure but max attempts reached
    const { loadState } = await import('../engine/status')
    const state = loadState(ctx.taskId)
    const fixStage = state?.stages?.fix
    if (fixStage?.fixAttempt !== undefined && fixStage.fixAttempt >= 2) {
      return { shouldSkip: true, reason: 'Max fix attempts reached' }
    }
    return { shouldSkip: false }
  },
  postActions: [
    { type: 'commit-task-files', stagingStrategy: 'tracked+task', push: true },
  ],
})
```

**Complexity**: Medium
**Files Modified**: 1

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
  'commit',    // NEW: commit fixes before verify
  'verify',
  'pr',
]
```

**Also update IMPL_ORDER_LIGHTWEIGHT**:
```typescript
export const IMPL_ORDER_LIGHTWEIGHT: PipelineStep[] = [
  'architect',
  'build',
  'commit',
  'review',    // NEW
  'fix',       // NEW
  'commit',    // NEW
  'verify',
  'pr',
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
**Location**: In runPipeline function, after verify stage completes

**Find where stage results are handled** (around line 450-550)

**Add after verify stage completes**:
```typescript
// Check for verify stage failure and trigger loop
if (stageName === 'verify') {
  if (stageResult.state === 'failed') {
    // Get current fix attempt count
    const fixStageState = state.stages.get('fix')
    const currentAttempt = fixStageState?.fixAttempt || 0
    const maxAttempts = pipeline.stages.get('fix')?.maxRetries || 2
    
    if (currentAttempt < maxAttempts) {
      // Loop to fix stage
      logger.info(`Verify failed, looping to fix (attempt ${currentAttempt + 1}/${maxAttempts})`)
      
      // Capture verify failures for fix stage
      const verifyFailuresPath = path.join(ctx.taskDir, 'verify-failures.md')
      const errorOutput = stageResult.error || 'Verify failed - check logs'
      fs.writeFileSync(verifyFailuresPath, `# Verify Failures\n\n${errorOutput}\n`)
      
      // Increment fix attempt counter
      const newFixAttempt = currentAttempt + 1
      state = updateStage(state, 'fix', {
        state: 'running',
        fixAttempt: newFixAttempt,
        maxFixAttempts: maxAttempts,
        startedAt: new Date().toISOString(),
      })
      writeState(ctx.taskId, state)
      
      // Reset verify stage to pending for retry
      state = updateStage(state, 'verify', { state: 'pending' })
      writeState(ctx.taskId, state)
      
      // Find index of fix stage in pipeline
      const stageOrder = flattenPipelineOrder(pipeline.order)
      const fixIndex = stageOrder.indexOf('fix')
      
      // Continue from fix stage
      return runPipelineFromStage(ctx, pipeline, hooks, rebuildPipeline, fixIndex, state)
    } else {
      logger.error(`Max fix attempts (${maxAttempts}) reached, pipeline failing`)
      // Continue to fail the pipeline normally
    }
  }
}
```

**Need to add helper function** `runPipelineFromStage`:
```typescript
async function runPipelineFromStage(
  ctx: PipelineContext,
  pipeline: PipelineDefinition,
  hooks?: LifecycleHooks,
  rebuildPipeline?: (ctx: PipelineContext) => PipelineDefinition,
  startIndex?: number,
  initialState?: PipelineStateV2,
): Promise<PipelineStateV2> {
  // Same as runPipeline but accepts startIndex
  // ... implementation similar to runPipeline ...
}
```

**Alternative simpler approach**: Modify the stage completion logic to check if we should loop:
```typescript
// After any stage completes with 'failed' state
if (stageResult.state === 'failed' && stageName === 'verify') {
  // Check fix attempt count and loop
  const shouldLoop = checkAndIncrementFixAttempt(ctx.taskId)
  if (shouldLoop) {
    // Write verify failures to file
    writeVerifyFailuresFile(ctx.taskDir, stageResult.error)
    // Reset to fix stage in state
    const { loadState, writeState, updateStage } = await import('./status')
    const s = loadState(ctx.taskId)
    const newState = updateStage(s, 'fix', { 
      state: 'running',
      fixAttempt: (s.stages.fix?.fixAttempt || 0) + 1 
    })
    writeState(ctx.taskId, newState)
    // Return early with indication to continue from fix
    return runPipeline(ctx, pipeline, hooks, rebuildPipeline)
  }
}
```

**Complexity**: High
**Files Modified**: 1

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

**Complexity**: Low
**Files Modified**: 1

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

  // Resolve pipeline (reuse rerun definition but start from fix)
  const pipeline = resolvePipelineForMode('rerun', ctx.profile, false, ctx)
  
  // Load state to get fix attempt count
  const { loadState, writeState, updateStage } = await import('./engine/status')
  let state = loadState(input.taskId)
  
  // Initialize fix attempt if not set
  if (!state?.stages?.fix?.fixAttempt) {
    state = updateStage(state || initState(ctx, 'fix'), 'fix', {
      state: 'pending',
      fixAttempt: 0,
      maxFixAttempts: 2,
    })
    writeState(input.taskId, state)
  }

  // Run from fix stage (skip build)
  await runPipeline(ctx, pipeline)

  logger.info('\n✅ Fix complete!')
}
```

**Complexity**: Medium
**Files Modified**: 1

---

## Step 14: Update Pipeline Resolver

**File**: `scripts/cody/engine/pipeline-resolver.ts`
**Lines**: 17-38

**Update function signature and switch**:
```typescript
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
    case 'fix':  // Both rerun and fix use rerun pipeline definition
      return buildPipeline('rerun', profile, clarify, ctx)
    case 'status':
      return { stages: new Map(), order: [] }
    default:
      return buildPipeline('full', profile, clarify, ctx)
  }
}
```

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

**But** need to ensure stageInstructions are returned for these stages. The agent handler uses buildStagePrompt from stage-prompts.ts, which already handles our new stages.

**Complexity**: None
**Files Modified**: 0

---

## Step 17: Add Stage-Specific Prompts to buildStagePrompt

**File**: `scripts/cody/stage-prompts.ts`
**Location**: In buildStagePrompt function (around line 170)

**Update function to handle review and fix stages**:
```typescript
export function buildStagePrompt(input: CodyInput, stage: string, feedback?: string): string {
  const { taskId } = input
  const taskDir = path.join(process.cwd(), '.tasks', taskId)

  // Special handling for review and fix stages
  if (stage === 'review') {
    return buildReviewPrompt(taskId, taskDir)
  }
  if (stage === 'fix') {
    return buildFixPrompt(taskId, taskDir)
  }

  // ... existing logic for other stages
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Step 18: Add Skip Condition for Review Stage

**File**: `scripts/cody/pipeline/skip-conditions.ts`
**Location**: In skipIfBelowComplexity function

**Add review threshold**:
```typescript
export const STAGE_COMPLEXITY_THRESHOLDS: Record<string, number> = {
  taskify: 0,
  spec: 20,
  gap: 30,
  clarify: 40,
  architect: 30,
  'plan-gap': 40,
  build: 50,
  review: 30,    // NEW - skip review for low complexity tasks
  fix: 0,       // NEW - never skip fix
  // ...
}
```

**Complexity**: Low
**Files Modified**: 1

---

## Summary of Changes

| Step | File | Change | Complexity |
|------|------|--------|------------|
| 1 | stage-prompts.ts | Add review/fix to ALL_STAGES + context files + instructions | Low |
| 2 | definitions.ts | Define review stage | Medium |
| 3 | definitions.ts | Define fix stage | Medium |
| 4 | definitions.ts | Update IMPL_ORDER | Low |
| 5 | agent-runner.ts | Add timeout constants | Low |
| 6 | stage-prompts.ts | Create buildReviewPrompt | Low |
| 7 | stage-prompts.ts | Create buildFixPrompt | Low |
| 8 | types.ts | Add AnalyzeReviewFindings, ClearVerifyFailures types | Low |
| 9 | post-actions.ts | Implement analyze-review-findings, clear-verify-failures | Medium |
| 10 | state-machine.ts | Add verify→fix loop logic | High |
| 11 | parse-inputs.ts | Add fix to VALID_MODES | Low |
| 12 | cody-utils.ts | Add fix to CodyInput.mode | Low |
| 13 | entry.ts | Add runFixMode handler | Medium |
| 14 | pipeline-resolver.ts | Handle fix mode | Low |
| 15 | types.ts | Add StageStatus extensions | Low |
| 16 | handler.ts | No changes needed | - |
| 17 | stage-prompts.ts | Update buildStagePrompt | Low |
| 18 | skip-conditions.ts | Add review threshold | Low |

**Total Files Modified**: ~15
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
