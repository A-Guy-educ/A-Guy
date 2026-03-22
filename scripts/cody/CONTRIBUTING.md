# Contributing to Cody Pipeline

Thank you for your interest in contributing to the Cody pipeline engine!

## Overview

The Cody pipeline is a deterministic task execution engine that processes GitHub issues through a series of stages (taskify → gap → architect → plan-gap → build → commit → review → verify → docs/pr).

## Project Structure

```
scripts/cody/
├── engine/               # Core pipeline engine
│   ├── state-machine.ts  # Deterministic execution engine
│   ├── status.ts        # State persistence (status.json)
│   └── types.ts         # Type definitions
├── pipeline/            # Pipeline configuration
│   ├── definitions.ts   # Pipeline order and stage mapping
│   ├── post-actions/    # Post-action implementations
│   └── skip-conditions.ts
├── stages/              # Stage definitions
│   ├── registry.ts      # Stage registry
│   └── definitions/    # Individual stage configs
├── handlers/           # Stage handlers
│   ├── agent-handler.ts    # Agent-based stages (LLM)
│   ├── scripted-handler.ts  # Scripted stages (deterministic)
│   └── gate-handler.ts      # Gate stages (approval)
├── config/
│   └── constants.ts     # Pipeline constants
├── logger.ts           # Logging utilities
└── pipeline-events.ts   # Structured event logging
```

## Development Setup

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Run tests**:

   ```bash
   # All tests
   pnpm test:unit

   # Watch mode
   pnpm test:unit --watch

   # Specific test file
   pnpm test:unit --run tests/unit/scripts/cody/engine/state-machine.test.ts
   ```

3. **Type checking**:

   ```bash
   pnpm -s tsc --noEmit
   ```

4. **Linting**:
   ```bash
   pnpm -s lint
   ```

## Key Concepts

### Pipeline State

The pipeline maintains state in `status.json` files:

- `state`: running | completed | failed | timeout | paused
- `cursor`: Current stage name
- `stages`: Record of each stage's state

### Post-Actions

Post-actions run after a stage completes. They are classified as:

- **Blocking**: Failure stops the pipeline (e.g., `check-gate`, `commit-task-files`)
- **Advisory**: Failure logs a warning but doesn't stop the pipeline (e.g., `run-tsc`, `run-unit-tests`)

See [STAGE_AUTHORING.md](./STAGE_AUTHORING.md) for how to add post-actions to stages.

### Structured Logging

Use `pipeline-events.ts` for consistent event logging:

```typescript
import { logStageStart, logStageComplete, logStageFail } from './pipeline-events'

logStageStart('architect', ctx.taskId)
logStageComplete('architect', ctx.taskId, 'completed', duration)
logStageFail('build', ctx.taskId, errorMessage)
```

## Adding a New Stage

1. **Define the stage** in `stages/definitions/`:

   ```typescript
   export const MyStage: StageDefinition = {
     name: 'my-stage',
     type: 'agent', // or 'scripted', 'git', 'gate'
     timeout: 300, // seconds
     maxRetries: 2,
     postActions: [...],
   }
   ```

2. **Register in `stages/registry.ts`**:

   ```typescript
   import { MyStage } from './definitions/my-stage'

   export const STAGE_REGISTRY: Record<StageName, StageDefinition> = {
     // ... existing stages
     'my-stage': MyStage,
   }
   ```

3. **Add to pipeline order** in `pipeline/definitions.ts`:

   ```typescript
   export const PIPELINE_ORDER: PipelineStep[] = [
     // ... existing stages
     'my-stage',
   ]
   ```

4. **Add skip conditions** in `pipeline/skip-conditions.ts` if needed

5. **Add tests**:
   - Unit tests in `tests/unit/scripts/cody/`
   - Integration tests in `tests/int/`

## Adding a New Post-Action

1. **Define the action type** in `engine/types.ts`:

   ```typescript
   export type MyAction = {
     type: 'my-action'
     option1?: string
   }
   ```

2. **Add to PostAction union**

3. **Implement the handler** in `pipeline/post-actions/`

4. **Classify as blocking or advisory**:
   - If blocking: Add to `BLOCKING_POST_ACTIONS` in `engine/types.ts`
   - If advisory: No changes needed

## Running the Pipeline Locally

```bash
# Full pipeline
pnpm cody run --taskId=<task-id> --mode=spec

# Lightweight mode
pnpm cody run --taskId=<task-id> --mode=spec --profile=lightweight

# Dry run
pnpm cody run --taskId=<task-id> --dry-run
```

## Common Issues

### Tests Failing

1. Check import paths - tests in `tests/unit/scripts/cody/` need `../../../../` to reach project root
2. Mock external dependencies (LLM calls, GitHub API, etc.)
3. Use `vi.useFakeTimers()` for time-sensitive tests

### Type Errors

1. Run `pnpm generate:types` after changing Payload schemas
2. Check that `StageName` types are consistent across files

### Debugging Pipeline Runs

1. Check `status.json` in the task directory
2. Look at logs with `logLevel: 'debug'` in `logger.ts`
3. Use `ctx.context` to pass debugging info between stages

## Pull Request Checklist

- [ ] Tests pass (`pnpm test:unit`)
- [ ] TypeScript compiles (`pnpm -s tsc --noEmit`)
- [ ] Lint passes (`pnpm -s lint`)
- [ ] New stages have post-action error classification
- [ ] New post-actions have blocking/advisory classification
- [ ] Documentation updated (if adding new features)

## Getting Help

- See [AGENTS.md](../AGENTS.md) for Cody pipeline architecture
- See [STAGE_AUTHORING.md](./STAGE_AUTHORING.md) for stage and post-action development
- Check `.tasks/<task-id>/` for task-specific context and memory
