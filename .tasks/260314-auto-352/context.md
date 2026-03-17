# Codebase Context: 260314-auto-352

## Files to Modify

### Stage Registry (canonical source of truth)
- `scripts/cody/stages/registry.ts` (L21-35 STAGE_NAMES, L37 StageName, L43-57 STAGES, L80-201 STAGE_REGISTRY, L274 TypedPipelineStep, L279-323 pipeline orders) — add 'resolve-conflicts' to STAGE_NAMES, STAGE_REGISTRY, STAGES const; add MERGE_ORDER; prepend to IMPL/FIX orders

### Conflict Utilities
- `scripts/cody/conflict-utils.ts` (NEW) — getConflictedFiles, writeConflictMarker, hasConflictMarker, removeConflictMarker

### Git Utils
- `scripts/cody/git-utils.ts` (L267-295) — modify mergeDefaultBranch() signature and return type

### Pipeline Definitions
- `scripts/cody/pipeline/definitions.ts` (L68 createStageDefinitions) — add 'resolve-conflicts' stage definition with shouldSkip logic

### Stage Prompts
- `scripts/cody/stage-prompts.ts` (L43-115 stageInstructions) — add 'resolve-conflicts' entry

### Agent
- `.opencode/agents/merge-resolve.md` (NEW) — merge resolution agent with git permissions

### Mode Handler
- `scripts/cody/modes/merge.ts` (NEW) — runMergeMode function
- `scripts/cody/modes/index.ts` (L7-12) — add export for runMergeMode
- `scripts/cody/modes/fix.ts` (L16 imports, L30-35 merge bug, L67 taskDir) — fix merge ordering + use leaveConflicts

### Entry Point
- `scripts/cody/entry.ts` (L28-34 imports, L336-357 switch) — add merge case + import

### Pipeline Resolver
- `scripts/cody/engine/pipeline-resolver.ts` (L18-19 mode type, L24-44 switch, L66 rebuild type) — add merge case

### Config
- `scripts/cody/cody-utils.ts` (L19 CodyInput.mode) — add 'merge' to union
- `scripts/cody/parse-inputs.ts` (L33 VALID_MODES) — add 'merge'

### Checkout
- `scripts/cody/checkout-task-branch.ts` (L287-290) — remove process.exit(1) on conflict

### Dashboard API
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (L35-55 actionSchema, L398 default case) — add 'smart-resolve'

### Dashboard UI
- `src/ui/cody/types.ts` (L282-293 GitHubAction) — add 'smart-resolve'
- `src/ui/cody/api.ts` (after L249) — add smartResolve method
- `src/ui/cody/hooks/index.ts` (L298-461 useTaskActions) — add smartResolve mutation
- `src/ui/cody/components/TaskDetail.tsx` (L224-275 getPrimaryAction, header area) — Smart Resolve button
- `src/ui/cody/components/MergeButton.tsx` (L19-26 props, L83+) — add onSmartResolve prop
- `src/ui/cody/components/tooltip-content.tsx` (L201-213) — update conflict tooltip text
- `src/ui/cody/constants.ts` (L11-27) — add 'resolve-conflicts' to IMPL_STAGES
- `src/ui/cody/pipeline-utils.ts` (L14-27 stageLabels, L32-44 stageMaxDurations) — add resolve-conflicts

### Workflow
- `.github/workflows/cody.yml` (L14) — update mode description

## Files to Read (reference patterns)
- `.opencode/agents/build.md` (L1-10) — YAML header format for agents
- `scripts/cody/modes/impl.ts` — mode handler pattern (imports, structure)
- `scripts/cody/modes/fix.ts` — full mode handler with pipeline resolution
- `scripts/cody/pipeline/definitions.ts` (L68-350) — stage definition pattern (shouldSkip, postActions)
- `scripts/cody/engine/types.ts` (L50-76) — StageDefinition interface, agentName field
- `tests/unit/scripts/cody/stage-registry.test.ts` — test pattern for registry assertions
- `tests/unit/scripts/cody/entry-modes.test.ts` — test pattern for pipeline mode resolution
- `tests/unit/scripts/cody/git-utils.test.ts` — test pattern for mocking child_process
- `tests/helpers/cody/pipeline-test-harness.ts` — createMockPipelineContext factory

## Key Signatures
- `mergeDefaultBranch(cwd: string): void` from `scripts/cody/git-utils.ts` — changing to `(cwd: string, options?: { leaveConflicts?: boolean }): boolean`
- `ensureFeatureBranch(taskId, taskType, projectDir?, taskDir?): void` from `scripts/cody/git-utils.ts` — calls mergeDefaultBranch internally (L369, L391, L463)
- `resolvePipelineForMode(mode, profile, clarify, ctx): PipelineDefinition` from pipeline-resolver.ts
- `buildPipeline(mode, profile, clarify, ctx): PipelineDefinition` from definitions.ts
- `createStageDefinitions(ctx): Map<StageName, StageDefinition>` from definitions.ts
- `type CodyInput = { mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status', ... }` from cody-utils.ts
- `VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status']` from parse-inputs.ts
- `type StageName = (typeof STAGE_NAMES)[number]` from stages/registry.ts
- `STAGE_REGISTRY: Record<StageName, StageMetadata>` from stages/registry.ts
- `type GitHubAction = 'approve' | 'reject' | ...` from types.ts
- `useTaskActions({ issueNumber, actorLogin, onSuccess, onError })` from hooks/index.ts
- `getStageTimeout(stage: StageName): number` from stages/registry.ts
- `flattenPipelineOrder(order: PipelineStep[]): string[]` from pipeline/definitions.ts
- `triggerWorkflow(options, octokit?): Promise<void>` from github-client.ts
- `postWithAttribution(issueNumber, message, actor, userOctokit)` from actions/route.ts

## Reuse Inventory
- `getDefaultBranch(cwd)` from `scripts/cody/git-utils.ts` — get branch name
- `getStageTimeout('resolve-conflicts')` from registry — reuses registry timeout system
- `createMockPipelineContext()` from `tests/helpers/cody/` — test fixtures
- `triggerWorkflow()` from `src/ui/cody/github-client.ts` — trigger CI
- `postWithAttribution()` from route.ts — post comment with actor
- `handleSuccess()`/`handleError()` from `useTaskActions` — toast pattern
- `invalidateTaskCache()`/`invalidatePRCache()` from github-client.ts — cache busting
- `usePRCIStatus` hook from `src/ui/cody/hooks/usePRCIStatus.ts` — provides `hasConflicts`

## Integration Points
- `STAGE_NAMES` → `StageName` type → `STAGE_REGISTRY` → `createStageDefinitions()` → `buildPipeline()` — ALL must be updated for resolve-conflicts
- New mode: `CodyInput.mode` union → `VALID_MODES` → `resolvePipelineForMode()` type + switch → `modes/merge.ts` → `entry.ts` switch
- Dashboard: `actionSchema` z.enum → switch case → `GitHubAction` type → `tasksApi` → `useTaskActions()`
- Frontend constants: `IMPL_STAGES` → `ALL_STAGES` → `calculatePipelineProgress()` — must include resolve-conflicts

## Imports Verified
- `scripts/cody/git-utils` → exports `mergeDefaultBranch`, `ensureFeatureBranch`, `getDefaultBranch` ✅
- `scripts/cody/stages/registry` → exports `STAGE_NAMES`, `StageName`, `STAGE_REGISTRY`, `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`, `FIX_FULL_ORDER`, `getStageTimeout` ✅
- `scripts/cody/pipeline/definitions` → re-exports pipeline orders from registry, exports `buildPipeline`, `flattenPipelineOrder` ✅
- `scripts/cody/engine/pipeline-resolver` → exports `resolvePipelineForMode` ✅
- `scripts/cody/modes` → barrel exports all mode handlers ✅
- `src/ui/cody/github-client` → exports `triggerWorkflow`, `postComment`, `invalidateTaskCache`, `invalidatePRCache` ✅
- `src/ui/cody/hooks/usePRCIStatus` → exports `usePRCIStatus` with `hasConflicts` ✅
- `tests/helpers/cody` → exports `createMockPipelineContext` ✅
