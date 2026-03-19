# Codebase Context: 260316-inspector-pipeline-fixer

## Files to Modify
- `scripts/inspector/plugins/cody/health-check/index.ts` (lines 72-79) — detect `cody:failed` label when status.json missing, parse error from failure comment
- `scripts/inspector/plugins/cody/pipeline-fixer/index.ts` (NEW) — new plugin replacing failure-analysis
- `scripts/inspector/plugins/cody/queue-manager/index.ts` (lines 1-527) — strip retry/gate logic, keep queue management only
- `scripts/inspector/plugins/cody/queue-manager/types.ts` (lines 22-87) — remove GateReviewInput, GateReviewResult, retries, gateApprovals from QueueState
- `scripts/inspector/plugins/cody/queue-manager/queue-state.ts` (lines 86-118) — remove getRetryCount, incrementRetry
- `scripts/inspector/index.ts` (lines 14, 75, 88-105) — swap failureAnalysisPlugin → pipelineFixerPlugin
- `tests/unit/scripts/inspector/pipeline-fixer.spec.ts` (NEW) — tests for pipeline-fixer
- `tests/unit/scripts/inspector/queue-manager.test.ts` (lines 208-237, 303-366) — update for simplified queue-manager
- `tests/unit/scripts/inspector/health-check.spec.ts` — add label-based failure detection tests

## Files to Delete
- `scripts/inspector/plugins/cody/failure-analysis/index.ts`
- `scripts/inspector/plugins/cody/failure-analysis/classifier.ts`
- `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts`
- `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts`
- `scripts/inspector/plugins/cody/queue-manager/gate-reviewer.ts`
- `tests/unit/scripts/inspector/failure-analysis.spec.ts`

## Files to Read (reference patterns)
- `scripts/inspector/plugins/cody/health-check/index.ts` — plugin structure, evaluateHealth function (lines 65-170)
- `scripts/inspector/plugins/cody/health-check/discovery.ts` — task discovery, extractTaskId, findTaskIdFromComments
- `scripts/inspector/plugins/cody/queue-manager/index.ts` — action execution pattern (triggerWorkflow, postComment, state management)
- `scripts/inspector/core/types.ts` — InspectorPlugin, ActionRequest, InspectorContext, EvaluatedTask interfaces
- `scripts/inspector/clients/github.ts` — readTaskFile, createIssue, triggerWorkflow, getIssueComments implementations
- `tests/unit/scripts/inspector/queue-manager.test.ts` — test helper patterns (createMockContext, createEvaluatedTask)

## Key Signatures
- `readTaskFile(taskId: string, filename: string): string` from `scripts/inspector/clients/github.ts`
- `createIssue(title: string, body: string, labels: string[]): number | null` from GitHubClient
- `triggerWorkflow(workflow: string, inputs: Record<string, string>): void` from GitHubClient
- `postComment(issueNumber: number, body: string): void` from GitHubClient
- `getIssueComments(issueNumber: number): IssueComment[]` from GitHubClient
- `searchIssues(query: string): IssueInfo[]` from GitHubClient
- `interface InspectorPlugin { name, description, domain, schedule?, run(ctx) }` from `scripts/inspector/core/types.ts`
- `interface ActionRequest { plugin, type, target?, urgency, title, detail, dedupKey?, dedupWindowMinutes?, execute }` from core/types.ts
- `interface EvaluatedTask extends TaskSnapshot { health, healthDetail, failedStage?, failedError? }` from core/types.ts
- `interface TaskSnapshot { taskId, issueNumber, issueTitle, labels, status, issueUpdatedAt, statusUpdatedAt }` from core/types.ts
- `interface InspectorContext { repo, dryRun, state, github, log, cycleNumber, digestIssue? }` from core/types.ts
- `getQueueState(ctx): QueueState` from queue-state.ts
- `failTask(ctx, task): void` from queue-state.ts
- `cleanTaskState(state, taskId): QueueState` from queue-state.ts

## Reuse Inventory
- `readTaskFile` from `scripts/inspector/clients/github.ts` — read failure logs and stage outputs
- `createIssue` from GitHubClient — create pipeline-fix issues
- `triggerWorkflow` from GitHubClient — trigger cody.yml reruns
- `postComment` from GitHubClient — post status updates on issues
- `getIssueComments` from GitHubClient — parse failure comments for error info (used in health-check Step 0)
- `EvaluatedTask` type from core/types.ts — task health input
- `InspectorPlugin` / `ActionRequest` from core/types.ts — plugin interface
- `getQueueState` from queue-state.ts — check if task is queue-managed active task
- `QUEUE_LABELS` from queue-manager/types.ts — label constants

## Integration Points
- Must register `pipelineFixerPlugin` in `scripts/inspector/index.ts` (replaces `failureAnalysisPlugin`)
- Must register AFTER health-check plugin (reads `cody:evaluatedTasks` from state)
- Health-check must detect `cody:failed` label as `health: 'failed'` even without status.json
- Pipeline-fixer state key: `cody:fixerState` (stored in inspector state store, persists across CI runs via GhVariableStateStore)
- Fix issues get label `cody:pipeline-fix` and `@cody` comment to trigger pipeline
- Queue-manager delegates failures by marking task `cody:queue-failed` and advancing — pipeline-fixer picks up the task on next cycle via health-check
- Pipeline-fixer skips tasks where `queue:state.activeTaskId` matches (still managed by queue)

## Failure Comment Format (parsed by health-check)
```
❌ Pipeline failed for `260316-auto-648`

**Failed stage:** `build` (after 24m 7s)
**Error:** Pipeline failed at stage: build (failed): Agent "build" failed. Artifacts: build-stderr.log, build-events.jsonl
**Cost:** $6.34 across 4 stages
**Completed:** taskify ✅ → gap ✅ → architect ✅ → plan-gap ✅ → build ❌
```
Regex patterns:
- Stage: `/\*\*Failed stage:\*\*\s*\`([^\`]+)\`/`
- Error: `/\*\*Error:\*\*\s*(.+)/`

## Imports Verified
- `import { readTaskFile } from '../../../clients/github'` ✅
- `import type { InspectorPlugin, ActionRequest, InspectorContext, EvaluatedTask } from '../../../core/types'` ✅
- `import { getQueueState } from '../queue-manager/queue-state'` ✅
- `import { pipelineFixerPlugin } from './plugins/cody/pipeline-fixer/index'` ✅ (will exist after Step 1)
