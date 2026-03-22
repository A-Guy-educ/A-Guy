# Codebase Context: 260315-queue-manager-plugin

## Files to Modify
- `scripts/inspector/index.ts` (line ~15-30) — Add import and register queueManagerPlugin
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED) — Add `add-to-queue` and `remove-from-queue` action handlers
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED) — Add queue buttons to action menu
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED) — Add "Queue" view mode
- `src/ui/cody/components/TaskList.tsx` (MODIFIED) — Add queue status rendering
- `src/ui/cody/hooks/useTaskActions.ts` (MODIFIED) — Add addToQueue/removeFromQueue mutations

## Files to Create
- `scripts/inspector/plugins/cody/queue-manager/types.ts` (NEW) — Queue types
- `scripts/inspector/plugins/cody/queue-manager/queue-state.ts` (NEW) — State helpers
- `scripts/inspector/plugins/cody/queue-manager/gate-reviewer.ts` (NEW) — AI gate review
- `scripts/inspector/plugins/cody/queue-manager/index.ts` (NEW) — Main plugin
- `src/ui/cody/components/QueueView.tsx` (NEW) — Queue view component
- `tests/unit/scripts/inspector/queue-manager.test.ts` (NEW) — Unit tests

## Files to Read (reference patterns)
- `scripts/inspector/plugins/cody/failure-analysis/index.ts` — Plugin structure, retry tracking pattern, action creation, dedup usage
- `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts` — MiniMax LLM call pattern (HTTP fetch, system prompt, JSON parsing)
- `scripts/inspector/plugins/cody/failure-analysis/classifier.ts` — Deterministic pre-classification pattern
- `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts` — From-stage routing logic
- `scripts/inspector/plugins/cody/health-check/index.ts` — Plugin that produces evaluatedTasks, nudge/digest action patterns
- `scripts/inspector/plugins/cody/health-check/discovery.ts` — Task discovery from GitHub issues
- `scripts/inspector/core/types.ts` — All core interfaces (InspectorPlugin, ActionRequest, EvaluatedTask, GitHubClient, StateStore)
- `scripts/inspector/core/inspector.ts` — Main loop: plugin execution, dedup, state save
- `scripts/inspector/clients/github.ts` — GitHubClient implementation (triggerWorkflow, postComment, addLabel, removeLabel, getOpenIssues)
- `tests/unit/scripts/inspector/failure-analysis.spec.ts` — Test pattern for inspector plugins
- `tests/unit/scripts/inspector/health-check.test.ts` — Test pattern with mock context

## Key Signatures
- `InspectorPlugin { name, description, domain, schedule?, run(ctx): Promise<ActionRequest[]> }` from `scripts/inspector/core/types.ts`
- `ActionRequest { plugin, type, target?, urgency, title, detail, dedupKey?, dedupWindowMinutes?, execute(ctx) }` from `scripts/inspector/core/types.ts`
- `EvaluatedTask { taskId, issueNumber, health, healthDetail, failedStage?, failedError?, gatedMinutes? }` from `scripts/inspector/core/types.ts`
- `GitHubClient.triggerWorkflow(workflow: string, inputs: Record<string, string>): void` from `scripts/inspector/core/types.ts`
- `GitHubClient.postComment(issueNumber: number, body: string): void` from `scripts/inspector/core/types.ts`
- `GitHubClient.addLabel(issueNumber: number, label: string): void` from `scripts/inspector/core/types.ts`
- `GitHubClient.removeLabel(issueNumber: number, label: string): void` from `scripts/inspector/core/types.ts`
- `GitHubClient.getOpenIssues(labels?: string[]): IssueInfo[]` from `scripts/inspector/core/types.ts`
- `GitHubClient.getIssue(issueNumber: number): { body: string | null; title: string | null }` from `scripts/inspector/core/types.ts`
- `StateStore.get<T>(key: string): T | undefined` from `scripts/inspector/core/types.ts`
- `StateStore.set<T>(key: string, value: T): void` from `scripts/inspector/core/types.ts`
- `classifyRetryability(failedStage: string, error: string): RetryClassification` from `scripts/inspector/plugins/cody/failure-analysis/classifier.ts`
- `analyzeFailure(input: AnalysisInput): Promise<AnalysisResult>` from `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts`
- `resolveFromStage(failedStage: string): string` from `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts`
- `readTaskFile(taskId: string, filename: string): string` from `scripts/inspector/clients/github.ts`
- `PluginRegistry.register(plugin: InspectorPlugin): void` from `scripts/inspector/plugins/registry.ts`

## Reuse Inventory
- `classifyRetryability` from `scripts/inspector/plugins/cody/failure-analysis/classifier.ts` — pre-classify retryability without LLM
- `analyzeFailure` from `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts` — MiniMax LLM failure diagnosis
- `resolveFromStage` from `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts` — determine rerun start stage
- `readTaskFile` from `scripts/inspector/clients/github.ts` — read task output files from .tasks/ directory
- `MiniPipelineProgress` from `src/ui/cody/components/MiniPipelineProgress.tsx` — compact pipeline progress display (reuse in queue view)
- `StatusBadge` from `src/ui/cody/components/StatusBadge.tsx` — status badge component (reuse for queue status)

## Integration Points
- Must register in `scripts/inspector/index.ts` plugin list — AFTER healthCheckPlugin (depends on evaluatedTasks state)
- Reads `cody:evaluatedTasks` from `ctx.state` — produced by health-check plugin each cycle
- Calls `ctx.github.triggerWorkflow('cody.yml', inputs)` — same mechanism as failure-analysis plugin
- Gate approval posts `/cody approve` as issue comment — parsed by Cody pipeline's `parse-inputs.ts`
- Dashboard actions use `/api/cody/tasks/[taskId]/actions` endpoint — extend existing POST handler
- Queue view filtered by labels — uses existing `useCodyTasks` hook which fetches from `/api/cody/tasks`
- May need to add `cody:queue-active` tasks to health-check's `failure-analysis` skip list to avoid conflict

## Imports Verified
- `scripts/inspector/core/types` → exports InspectorPlugin, ActionRequest, InspectorContext, EvaluatedTask, StateStore, GitHubClient ✅
- `scripts/inspector/clients/github` → exports readTaskFile, createGitHubClient ✅
- `scripts/inspector/plugins/cody/failure-analysis/classifier` → exports classifyRetryability ✅
- `scripts/inspector/plugins/cody/failure-analysis/analyzer` → exports analyzeFailure ✅
- `scripts/inspector/plugins/cody/failure-analysis/stage-router` → exports resolveFromStage ✅
- `scripts/inspector/plugins/registry` → exports PluginRegistry class ✅
