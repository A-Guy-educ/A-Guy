# Stage Authoring Guide

This guide explains how to create stages and post-actions for the Cody pipeline.

## Stages

### Stage Definition

```typescript
import type { StageDefinition } from '../engine/types'

export const MyStage: StageDefinition = {
  name: 'my-stage',
  type: 'agent', // | 'scripted' | 'git' | 'gate'
  timeout: 300, // seconds
  maxRetries: 2,

  // Optional: skip condition
  shouldSkip: (ctx) => ({
    shouldSkip: ctx.input.mode === 'lightweight',
    reason: 'Skipped in lightweight mode',
  }),

  // Optional: post-actions to run after stage completes
  postActions: [{ type: 'validate-task-json' }, { type: 'run-tsc' }],

  // Optional: minimum complexity to run this stage
  minComplexity: 30,

  // Optional: retry configuration
  retryWith: {
    stage: 'my-stage',
    maxAttempts: 3,
    onFailure: async (ctx, taskDir) => {
      // Capture failure details
    },
  },
}
```

### Stage Types

| Type       | Handler               | Use Case                                      |
| ---------- | --------------------- | --------------------------------------------- |
| `agent`    | `agent-handler.ts`    | LLM-powered stages (architect, build, review) |
| `scripted` | `scripted-handler.ts` | Deterministic stages (commit, validate)       |
| `git`      | `git-handler.ts`      | Git operations (checkout, branch)             |
| `gate`     | `gate-handler.ts`     | Approval-required stages                      |

### Stage Properties

| Property        | Type                           | Description                |
| --------------- | ------------------------------ | -------------------------- |
| `name`          | `StageName`                    | Unique identifier          |
| `type`          | `StageType`                    | Which handler to use       |
| `timeout`       | `number`                       | Max seconds before timeout |
| `maxRetries`    | `number`                       | Retry attempts on failure  |
| `shouldSkip`    | `(ctx) => SkipResult`          | Conditional skip           |
| `postActions`   | `PostAction[]`                 | Actions after completion   |
| `minComplexity` | `number`                       | Minimum complexity score   |
| `retryWith`     | `RetryConfig`                  | Declarative retry loop     |
| `preExecute`    | `(ctx) => Promise<void>`       | Pre-execution hook         |
| `validator`     | `(output) => ValidationResult` | Output validation          |

## Post-Actions

Post-actions execute after a stage completes, regardless of success or failure.

### Classification: Blocking vs Advisory

**Blocking post-actions** - Pipeline stops if these fail:

- `validate-task-json`
- `resolve-profile`
- `check-gate`
- `commit-task-files`
- `validate-plan-exists`
- `validate-build-content`
- `validate-src-changes`

**Advisory post-actions** - Failures log warnings but don't stop the pipeline:

- `set-classification-labels`
- `archive-rerun-feedback`
- `run-tsc`
- `run-unit-tests`
- `run-quality-with-autofix`
- `analyze-review-findings`
- `clear-verify-failures`
- `run-mechanical-autofix`

### Adding a New Post-Action

1. **Define the type** in `engine/types.ts`:

```typescript
export type MyPostAction = {
  type: 'my-post-action'
  option1?: string
}
```

2. **Add to the union**:

```typescript
export type PostAction =
  | ValidateTaskJsonAction
  | // ... existing
  | MyPostAction
```

3. **Implement in `pipeline/post-actions/`**:

```typescript
// my-post-action.ts
export async function executeMyPostAction(
  ctx: PipelineContext,
  action: MyPostAction,
  state: PipelineStateV2,
): Promise<void> {
  // Implementation
}
```

4. **Register in `pipeline/post-actions/index.ts`**:

```typescript
import { executeMyPostAction } from './my-post-action'

export async function executePostAction(...) {
  switch (action.type) {
    // ... existing cases
    case 'my-post-action':
      return executeMyPostAction(ctx, action, state)
  }
}
```

5. **Classify** - Add to `BLOCKING_POST_ACTIONS` if blocking, or leave as advisory (default).

### Parallel Post-Actions

Use `parallel` to run multiple post-actions concurrently:

```typescript
{
  type: 'parallel',
  actions: [
    { type: 'set-classification-labels' },
    { type: 'archive-rerun-feedback' },
  ],
}
```

Failures are classified per-action:

- Blocking failures stop the pipeline
- Advisory failures log warnings but continue

## Skip Conditions

Define when a stage should be skipped:

```typescript
shouldSkip: (ctx) => {
  // Skip if complexity is below threshold
  if (ctx.input.complexity && ctx.input.complexity < 30) {
    return { shouldSkip: true, reason: 'Complexity below 30' }
  }

  // Skip in certain modes
  if (ctx.input.mode === 'lightweight') {
    return { shouldSkip: true, reason: 'Skipped in lightweight mode' }
  }

  return { shouldSkip: false }
}
```

## Retry Loops

Declarative retry for fix → verify cycles:

```typescript
retryWith: {
  stage: 'verify',
  maxAttempts: 3,
  onFailure: async (ctx, taskDir) => {
    // Write verify-failures.md before retry
    await fs.writeFile(
      path.join(taskDir, 'verify-failures.md'),
      gatherFailureDetails(ctx)
    )
  },
  onTimeout: 'retry', // or 'fail'
}
```

## Output Validation

Validate stage output:

```typescript
validator: (outputFile) => {
  const content = fs.readFileSync(outputFile, 'utf-8')

  if (!content.includes('expected-pattern')) {
    return {
      valid: false,
      error: 'Output missing expected pattern',
    }
  }

  return { valid: true }
}
```

## Examples

### Agent Stage with Retry

```typescript
export const BuildStage: StageDefinition = {
  name: 'build',
  type: 'agent',
  timeout: 600,
  maxRetries: 1,
  agentName: 'build', // Uses build agent instead of stage name

  postActions: [
    { type: 'validate-task-json' },
    { type: 'validate-src-changes' },
    {
      type: 'parallel',
      actions: [{ type: 'run-tsc' }, { type: 'run-unit-tests' }],
    },
  ],

  retryWith: {
    stage: 'build',
    maxAttempts: 3,
  },
}
```

### Scripted Stage

```typescript
export const CommitStage: StageDefinition = {
  name: 'commit',
  type: 'scripted',
  timeout: 60,
  maxRetries: 0,

  postActions: [
    { type: 'commit-task-files', stagingStrategy: 'tracked+task', push: true, ensureBranch: true },
  ],
}
```

### Gate Stage

```typescript
export const QualityGate: StageDefinition = {
  name: 'quality-gate',
  type: 'gate',
  timeout: 3600, // 1 hour for human review
  maxRetries: 0,

  postActions: [{ type: 'check-gate', gate: 'quality' }],
}
```
