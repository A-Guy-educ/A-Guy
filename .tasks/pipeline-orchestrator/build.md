# Build Agent Report: pipeline-orchestrator

## Changes

- **Created `scripts/cody/pipeline/orchestrator.ts`**: Core orchestrator class with:
  - Error classification (technical, validation, data_quality, business_logic, unknown)
  - Decision types (retry, skip, escalate, halt, continue)
  - Exponential backoff retry with configurable delays
  - Escalation notification system via callbacks
  - Decision audit log for debugging
  - `OrchestratedError` wrapper class for better error context

- **Created `scripts/cody/pipeline/orchestrator-integration.ts`**: Integration helpers:
  - `createOrchestratorContext()` - builds context from pipeline state
  - `processStageFailure()` - routes error through orchestrator
  - `applyDecision()` - applies orchestrator decision to pipeline state
  - `createSlackEscalationHooks()` - Slack notification template
  - `createGitHubEscalationHooks()` - GitHub issue comment template
  - `createHumanInTheLoopDecisionModifier()` - human approval hook

- **Created `scripts/cody/pipeline/orchestrator.test.ts`**: Unit tests covering:
  - Error classification for all error types
  - Decision logic for each error category
  - Retry delay exponential backoff calculation
  - Stats and reset functionality

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PipelineOrchestrator                          │
├─────────────────────────────────────────────────────────────────┤
│  classifyError(error, context)                                  │
│    → technical (timeout, network, transient)                     │
│    → validation (tsc, lint, test failures)                      │
│    → data_quality (invalid JSON, schema violations)             │
│    → business_logic (requires human judgment)                   │
│                                                                  │
│  decide(context, classification)                                 │
│    → retry (with backoff for technical/validation)              │
│    → skip (when stage should be skipped)                        │
│    → escalate (for human review on business logic)              │
│    → halt (for data quality or max retries exceeded)            │
│    → continue (default fallback)                                │
│                                                                  │
│  notify callbacks (Slack, GitHub, custom)                        │
│  stats + decision log for debugging                            │
└─────────────────────────────────────────────────────────────────┘
```

## Integration Points

The orchestrator is designed to integrate with `state-machine.ts` at these points:

1. **`handleStageResult`** (L677-725): After stage fails, route through `processStageFailure()` before built-in `retryWith` logic
2. **`executeSingleStep` catch block** (L367-391): Catch exceptions and route through orchestrator
3. **`executeParallelStep`** (L614-622): Before returning failed state

## Usage Example

```typescript
import { PipelineOrchestrator, createSlackEscalationHooks } from './pipeline/orchestrator'
import { processStageFailure, applyDecision } from './pipeline/orchestrator-integration'

// Create orchestrator
const orchestrator = new PipelineOrchestrator({
  retryPolicy: { maxAttempts: 3, baseDelayMs: 1000 },
})

// Add Slack notifications
orchestrator.onNotify(async (notification) => {
  await postToSlack(notification)
})

// In state machine, when stage fails:
const { decision, classification } = await processStageFailure(
  ctx,
  stageName,
  stageState,
  error,
  { orchestrator }
)

const result = applyDecision(state, stageName, decision, classification)
return result.state
```

## Design Decisions

1. **Sync operation**: All orchestrator methods are async to allow notification hooks
2. **Callback-based notifications**: Allows Slack, GitHub, or custom escalation paths
3. **Decision modifier hook**: `onDecision` callback allows human-in-the-loop override
4. **Error wrapping**: `OrchestratedError` preserves original error + decision + classification
5. **No external dependencies**: Orchestrator is self-contained, no DB required

## Next Steps

To fully integrate:

1. Modify `state-machine.ts` to accept `OrchestratorHooks` in `runPipeline()`
2. Route failures in `handleStageResult()` through `processStageFailure()`
3. Apply decisions via `applyDecision()`
4. Wire up Slack/GitHub notification callbacks

## Tests Written

- `scripts/cody/pipeline/orchestrator.test.ts` - 12 test cases

## Deviations

- Did not modify `state-machine.ts` directly - the orchestrator is designed as an opt-in layer
- The pipeline remains functional without the orchestrator (backward compatible)

## Quality

- TypeScript: Unable to verify (node not available in environment)
- Lint: Unable to verify
- Tests: Unable to run (node not available)
