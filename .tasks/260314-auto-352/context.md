# Codebase Context: 260314-auto-352

## Files to Modify

### Pipeline Infrastructure (Steps 1-5)
- `scripts/cody/conflict-utils.ts` (NEW) — conflict detection utilities (getConflictedFiles, hasActiveMergeConflicts, writeConflictMarker, hasConflictMarker, removeConflictMarker)
- `scripts/cody/git-utils.ts` (L174-196) — modify `mergeDefaultBranch()` to support `leaveConflicts` option, change return type from `void` to `boolean`
- `scripts/cody/pipeline/definitions.ts` (L42-82 orders, L91 createStageDefinitions) — add `MERGE_ORDER`, prepend `resolve-conflicts` to existing orders, add stage definition
- `scripts/cody/stage-prompts.ts` (L29-44 ALL_STAGES, L69-116 STAGE_CONTEXT_FILES, L131-201 stageInstructions) — register resolve-conflicts stage
- `scripts/cody/agent-runner.ts` (L65-80 STAGE_TIMEOUTS) — add resolve-conflicts timeout
- `scripts/cody/cody-utils.ts` (L22) — add `'merge'` to `CodyInput.mode` union type
- `scripts/cody/parse-inputs.ts` (L33) — add `'merge'` to `VALID_MODES` array
- `scripts/cody/engine/pipeline-resolver.ts` (L18-45) — add `'merge'` to mode type + switch case, import `MERGE_ORDER`
- `scripts/cody/entry.ts` (L30 imports, L319 switch, L750-755 fix runFixMode, new runMergeMode fn) — merge mode + bug fix
- `scripts/cody/checkout-task-branch.ts` (L287-289) — replace `process.exit(1)` with log message

### Agent (Step 2)
- `.opencode/agents/merge-resolve.md` (NEW) — merge resolution agent with git permissions

### Dashboard API (Step 6)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (L30-49 actionSchema, after L296 switch) — add `'smart-resolve'` action

### Dashboard UI (Steps 7-8)
- `src/ui/cody/types.ts` (L267-279) — add `'smart-resolve'` to `GitHubAction`
- `src/ui/cody/api.ts` (after L213) — add `smartResolve()` to `tasksApi`
- `src/ui/cody/hooks/index.ts` (L269-412) — add `smartResolve` mutation
- `src/ui/cody/components/TaskDetail.tsx` (L31-56 imports, L1117-1128 desktop header, L1464-1473 mobile) — Smart Resolve button
- `src/ui/cody/components/tooltip-content.tsx` (L201-211) — update conflict tooltip
- `src/ui/cody/components/MergeButton.tsx` (L19-26 props, L83-139 render) — add `onSmartResolve` prop

### Display (Step 3)
- `src/ui/cody/constants.ts` (L11-20 IMPL_STAGES) — add `'resolve-conflicts'`
- `src/ui/cody/pipeline-utils.ts` (L14-27 stageLabels, L32-44 stageMaxDurations) — add stage labels

### Workflow (Step 9)
- `.github/workflows/cody.yml` (L14) — update mode description

## Files to Read (reference patterns)
- `.opencode/agents/build.md` (L1-10) — YAML frontmatter pattern for agent files
- `.opencode/agents/fix.md` — agent that uses `agentName` override pattern
- `scripts/cody/pipeline/definitions.ts` (L91-340) — stage definition pattern (type, timeout, shouldSkip, postActions)
- `scripts/cody/engine/types.ts` (L50-76) — `StageDefinition` interface
- `src/ui/cody/api.ts` (L175-213) — API method pattern (fetch → handleResponse)
- `src/ui/cody/hooks/index.ts` (L290-412) — mutation pattern (mutationFn, onSuccess, onError)
- `src/ui/cody/components/MergeButton.tsx` (L1-140) — conflict-aware UI pattern, `usePRCIStatus` usage
- `src/ui/cody/hooks/usePRCIStatus.ts` — how `hasConflicts` is detected
- `tests/unit/scripts/cody/git-utils.test.ts` — test pattern (vi.mock, toCommandString helper)

## Key Signatures
- `mergeDefaultBranch(cwd: string): void` from `scripts/cody/git-utils.ts` — will change to `(cwd: string, options?: { leaveConflicts?: boolean }): boolean`
- `ensureFeatureBranch(taskId, taskType, projectDir?, taskDir?): void` from `scripts/cody/git-utils.ts` — calls mergeDefaultBranch internally
- `ensureTaskDir(taskId: string): string` from `scripts/cody/cody-utils.ts`
- `getTaskDir(taskId: string): string` from `scripts/cody/cody-utils.ts`
- `triggerWorkflow(options: { taskId, mode?, fromStage?, feedback? }): Promise<void>` from `src/ui/cody/github-client.ts`
- `postComment(issueNumber: number, body: string): Promise<void>` from multiple locations
- `clearCache(): void` from `src/ui/cody/github-client.ts`
- `withActor(message: string, actor?: string): string` from route.ts L60
- `resolvePipelineForMode(mode, profile, clarify, ctx): PipelineDefinition` from `pipeline-resolver.ts`
- `buildPipeline(mode, profile, clarify, ctx): PipelineDefinition` from `definitions.ts`
- `createStageDefinitions(ctx): Map<string, StageDefinition>` from `definitions.ts` (private, internal)
- `createRebuildCallback(mode, clarify): (ctx) => PipelineDefinition` from `pipeline-resolver.ts`
- `runPipeline(ctx, pipeline, rebuildCallback): Promise<void>` from `engine/state-machine.ts`
- `STAGE_TIMEOUTS: Record<string, number>` from `agent-runner.ts`
- `DEFAULT_TIMEOUT` from `agent-runner.ts` (10 minutes)
- `type PipelineStep = string | { parallel: string[] }` from `engine/types.ts`
- `type CodyInput = { mode: 'spec'|'impl'|'rerun'|'fix'|'full'|'status', ... }` from `cody-utils.ts`
- `VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status']` from `parse-inputs.ts`
- `type GitHubAction = 'approve' | 'reject' | ... | 'comment'` from `types.ts`
- `handleSuccess(label: string): () => void` from `useTaskActions()` in hooks/index.ts
- `handleError(label: string): (error: Error) => void` from `useTaskActions()` in hooks/index.ts
- `usePRCIStatus(prNumber: number): { data: { ciStatus, mergeable, hasConflicts } }` from `hooks/usePRCIStatus.ts`
- `stageLabels: Record<string, string>` from `pipeline-utils.ts`
- `stageMaxDurations: Record<string, number>` from `pipeline-utils.ts`
- `ALL_STAGES` from `src/ui/cody/constants.ts` (different from stage-prompts.ts ALL_STAGES)
- `IMPL_STAGES` from `src/ui/cody/constants.ts`

## Reuse Inventory
- `triggerWorkflow()` from `src/ui/cody/github-client.ts` — used by smart-resolve action to trigger merge mode
- `mergeDefaultBranch()` from `scripts/cody/git-utils.ts` — extended with `leaveConflicts` option
- `usePRCIStatus` hook from `src/ui/cody/hooks/usePRCIStatus.ts` — provides `hasConflicts` boolean for UI
- `buildPipeline()` from `scripts/cody/pipeline/definitions.ts` — creates stage map, reused for merge mode
- `handleSuccess()` / `handleError()` from `useTaskActions` — toast pattern for new mutation
- `postComment()` from `src/ui/cody/github-client.ts` — post audit comment for smart-resolve action
- `clearCache()` from `src/ui/cody/github-client.ts` — invalidate server cache after action
- `withActor()` from `route.ts` — actor attribution for comments
- `STAGE_TIMEOUTS` from `scripts/cody/agent-runner.ts` — reuse existing timeout pattern
- `DEFAULT_TIMEOUT` from `scripts/cody/agent-runner.ts` — fallback for resolve-conflicts timeout
- `ensureTaskDir()` from `scripts/cody/cody-utils.ts` — create task directory in merge mode

## Integration Points
- New `'merge'` mode must be added to: `CodyInput.mode` (L22), `VALID_MODES` (L33), `resolvePipelineForMode()` (L18), entry.ts switch (L319), `createRebuildCallback` (L66)
- New `'resolve-conflicts'` stage must be in: `createStageDefinitions()`, pipeline orders (IMPL_ORDER_STANDARD, IMPL_ORDER_LIGHTWEIGHT, FIX_FULL_ORDER), `ALL_STAGES` (stage-prompts.ts), `STAGE_CONTEXT_FILES`, `stageInstructions`, `STAGE_TIMEOUTS`
- New `'smart-resolve'` action must be in: `actionSchema` z.enum, switch case, `GitHubAction` type, `tasksApi`, `useTaskActions()`
- Dashboard display: `stageLabels`, `stageMaxDurations`, `IMPL_STAGES` (constants.ts)
- `merge-resolve.md` agent auto-discovered by OpenCode from `.opencode/agents/` directory
- `MERGE_ORDER` pipeline order used only by `merge` mode in `pipeline-resolver.ts`
- `resolve-conflicts` prepended to `FIX_FULL_ORDER`, `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`
- Dashboard reads `hasConflicts` from `usePRCIStatus` which calls GitHub's `mergeable_state`
- `checkout-task-branch.ts` has its OWN local `mergeDefaultBranch()` at L92-101 (not the one from git-utils.ts)

## Imports Verified
- `scripts/cody/git-utils` → exports `mergeDefaultBranch`, `ensureFeatureBranch`, `getDefaultBranch` ✅
- `scripts/cody/cody-utils` → exports `ensureTaskDir`, `getTaskDir`, `parseCliArgs` ✅
- `scripts/cody/pipeline/definitions` → exports `buildPipeline`, `FIX_FULL_ORDER`, `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`, `flattenPipelineOrder` ✅
- `scripts/cody/engine/pipeline-resolver` → exports `resolvePipelineForMode`, `createRebuildCallback` ✅
- `scripts/cody/engine/state-machine` → exports `runPipeline` ✅
- `scripts/cody/stage-prompts` → exports `ALL_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`, `Stage` ✅
- `scripts/cody/agent-runner` → exports `STAGE_TIMEOUTS`, `DEFAULT_TIMEOUT` ✅
- `src/ui/cody/github-client` → exports `triggerWorkflow`, `postComment`, `clearCache` ✅
- `src/ui/cody/hooks/usePRCIStatus` → exports `usePRCIStatus` with `hasConflicts` ✅
- `src/ui/cody/constants` → exports `ALL_STAGES`, `IMPL_STAGES`, `SPEC_STAGES` ✅
- `src/ui/cody/pipeline-utils` → exports `stageLabels`, `stageMaxDurations` ✅
- `lucide-react` → exports `GitMerge` icon (need to add to TaskDetail imports) ✅
