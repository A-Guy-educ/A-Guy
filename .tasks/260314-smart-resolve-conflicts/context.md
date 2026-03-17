# Codebase Context: 260314-smart-resolve-conflicts

## Files to Modify

### Pipeline Infrastructure
- `scripts/cody/git-utils.ts` (L174-196) — modify `mergeDefaultBranch()` to support `leaveConflicts` option
- `scripts/cody/conflict-utils.ts` (NEW) — conflict detection, marker file read/write
- `scripts/cody/checkout-task-branch.ts` (L87-101, L287-289) — stop `process.exit(1)` on conflict
- `scripts/cody/pipeline/definitions.ts` (L42-82, L225+) — add `resolve-conflicts` stage + `MERGE_ORDER` + prepend to existing orders
- `scripts/cody/stage-prompts.ts` (L29-44, L69-116, L131+) — add stage to ALL_STAGES, context files, instructions
- `scripts/cody/engine/pipeline-resolver.ts` (L18-45) — add `merge` case to `resolvePipelineForMode()`
- `scripts/cody/entry.ts` (L743-755) — fix `runFixMode()` merge bug + add `runMergeMode()`
- `scripts/cody/cody-utils.ts` (L22) — add `'merge'` to `CodyInput.mode` union
- `scripts/cody/parse-inputs.ts` (L33) — add `'merge'` to `VALID_MODES`

### Agent
- `.opencode/agents/merge-resolve.md` (NEW) — merge resolution agent with git permissions

### Dashboard API
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (L31-49, after L296) — add `'smart-resolve'` action

### Dashboard UI
- `src/ui/cody/types.ts` (L267-279) — add `'smart-resolve'` to `GitHubAction`
- `src/ui/cody/api.ts` (after L213) — add `smartResolve()` to `tasksApi`
- `src/ui/cody/hooks/index.ts` (L269-412) — add `smartResolve` mutation to `useTaskActions()`
- `src/ui/cody/components/TaskDetail.tsx` (L221-272, L1117-1188) — Smart Resolve button
- `src/ui/cody/components/tooltip-content.tsx` (L201-210) — update conflict tooltip
- `src/ui/cody/components/MergeButton.tsx` (L39-140) — add resolve action to conflict state

### Workflow
- `.github/workflows/cody.yml` (L14) — update mode description

### Display
- `src/ui/cody/constants.ts` — add `resolve-conflicts` stage label
- `src/ui/cody/pipeline-utils.ts` — add stage to progress calculation

## Files to Read (reference patterns)
- `.opencode/agents/build.md` — agent instruction format pattern (YAML header, tool declarations, rules)
- `.opencode/agents/fix.md` — agent that uses `agentName` override pattern
- `scripts/cody/pipeline/definitions.ts` — stage definition pattern (type, timeout, shouldSkip, postActions)
- `scripts/cody/engine/types.ts` — `StageDefinition`, `PipelineStep`, `PipelineContext` types
- `src/ui/cody/api.ts` (L125-213) — API method pattern (fetch, handleResponse)
- `src/ui/cody/hooks/index.ts` (L290-348) — mutation pattern (mutationFn, onSuccess, onError)
- `src/ui/cody/components/MergeButton.tsx` — conflict-aware UI pattern
- `src/ui/cody/hooks/usePRCIStatus.ts` — how `hasConflicts` is detected

## Key Signatures
- `mergeDefaultBranch(cwd: string): void` from `scripts/cody/git-utils.ts` — will change to `(cwd: string, options?: { leaveConflicts?: boolean }): boolean`
- `ensureFeatureBranch(taskId: string, taskType: string, projectDir?: string, taskDir?: string): void` from `scripts/cody/git-utils.ts` — calls mergeDefaultBranch internally
- `triggerWorkflow(options: { taskId, mode?, fromStage?, feedback? }): Promise<void>` from `src/ui/cody/github-client.ts`
- `resolvePipelineForMode(mode, profile, clarify, ctx): PipelineDefinition` from `scripts/cody/engine/pipeline-resolver.ts`
- `buildPipeline(mode, profile, clarify, ctx): PipelineDefinition` from `scripts/cody/pipeline/definitions.ts`
- `type CodyInput = { mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status', ... }` from `scripts/cody/cody-utils.ts`
- `VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status']` from `scripts/cody/parse-inputs.ts`
- `type GitHubAction = 'approve' | 'reject' | ... | 'approve-pr'` from `src/ui/cody/types.ts`
- `useTaskActions({ issueNumber, actorLogin, onSuccess, onError })` from `src/ui/cody/hooks/index.ts`
- `ALL_STAGES` array from `scripts/cody/stage-prompts.ts`
- `STAGE_CONTEXT_FILES` record from `scripts/cody/stage-prompts.ts`
- `stageInstructions` record from `scripts/cody/stage-prompts.ts`

## Reuse Inventory
- `triggerWorkflow()` from `src/ui/cody/github-client.ts` — used by `smart-resolve` action to trigger merge mode
- `mergeDefaultBranch()` from `scripts/cody/git-utils.ts` — extended with `leaveConflicts` option
- `usePRCIStatus` hook from `src/ui/cody/hooks/usePRCIStatus.ts` — provides `hasConflicts` boolean for UI
- `buildPipeline()` from `scripts/cody/pipeline/definitions.ts` — creates stage map, reused for merge mode
- `handleSuccess()` / `handleError()` from `useTaskActions` — toast pattern for new mutation
- `postComment()` from `src/ui/cody/github-client.ts` — post audit comment for smart-resolve action
- `clearCache()` from `src/ui/cody/github-client.ts` — invalidate server cache after action
- `STAGE_TIMEOUTS.build` from `scripts/cody/agent-runner.ts` — reuse build timeout for resolve-conflicts stage
- `writeConflictMarker()` from new `scripts/cody/conflict-utils.ts` — used by entry.ts, checkout-task-branch.ts, git-utils.ts

## Integration Points
- New `'merge'` mode must be added to: `CodyInput.mode`, `VALID_MODES`, `resolvePipelineForMode()`, `entry.ts` switch
- New `'resolve-conflicts'` stage must be in: `definitions.ts` stage map, `ALL_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`
- New `'smart-resolve'` action must be in: `actionSchema` z.enum, switch cases, `tasksApi`, `useTaskActions`
- `merge-resolve.md` agent auto-discovered by OpenCode from `.opencode/agents/` directory
- `MERGE_ORDER` pipeline order used only by `merge` mode in `pipeline-resolver.ts`
- `resolve-conflicts` prepended to `FIX_FULL_ORDER` and `IMPL_ORDER_STANDARD`/`IMPL_ORDER_LIGHTWEIGHT`
- Dashboard reads `hasConflicts` from `usePRCIStatus` which calls `/api/cody/prs/status` which reads GitHub `mergeable_state`

## Imports Verified
- `@/ui/cody/github-client` → exports `triggerWorkflow`, `postComment`, `clearCache` ✅
- `@/ui/cody/auth` → exports `requireCodyAuth` ✅
- `@/ui/cody/hooks/usePRCIStatus` → exports `usePRCIStatus` hook with `hasConflicts` ✅
- `scripts/cody/git-utils` → exports `mergeDefaultBranch`, `ensureFeatureBranch` ✅
- `scripts/cody/pipeline/definitions` → exports `buildPipeline`, `FIX_FULL_ORDER`, `IMPL_ORDER_STANDARD` ✅
- `scripts/cody/engine/pipeline-resolver` → exports `resolvePipelineForMode` ✅
- `scripts/cody/stage-prompts` → exports `ALL_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions` ✅
