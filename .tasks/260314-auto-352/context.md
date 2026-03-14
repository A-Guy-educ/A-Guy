# Codebase Context: 260314-auto-352

## Files to Modify
- `scripts/cody/conflict-utils.ts` (NEW) — conflict detection & marker file utilities
- `scripts/cody/git-utils.ts` (L174-196) — modify `mergeDefaultBranch()` to return boolean + support `leaveConflicts`
- `.opencode/agents/merge-resolve.md` (NEW) — AI agent for git conflict resolution
- `scripts/cody/pipeline/definitions.ts` (L42-82, L91) — add MERGE_ORDER, prepend resolve-conflicts to all impl orders, add stage definition
- `scripts/cody/stage-prompts.ts` (L29-44, L69-116, L131-201) — add to ALL_STAGES, STAGE_CONTEXT_FILES, stageInstructions
- `scripts/cody/agent-runner.ts` (L65-80) — add resolve-conflicts timeout
- `scripts/cody/cody-utils.ts` (L22) — add 'merge' to CodyInput.mode union
- `scripts/cody/parse-inputs.ts` (L33) — add 'merge' to VALID_MODES
- `scripts/cody/engine/pipeline-resolver.ts` (L18-45, L65-70) — add merge case to resolvePipelineForMode + createRebuildCallback
- `scripts/cody/entry.ts` (L30, L319, L750-755, L788) — add runMergeMode(), fix runFixMode merge ordering
- `scripts/cody/checkout-task-branch.ts` (L287-289) — replace process.exit(1) with log
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (L31-49, switch block) — add smart-resolve action
- `src/ui/cody/types.ts` (L267-279) — add 'smart-resolve' to GitHubAction
- `src/ui/cody/api.ts` (after L213) — add smartResolve() to tasksApi
- `src/ui/cody/hooks/index.ts` (L269-412) — add smartResolve mutation
- `src/ui/cody/constants.ts` (L11-20) — add resolve-conflicts to IMPL_STAGES
- `src/ui/cody/pipeline-utils.ts` (L14-27, L32-44) — add stageLabels + stageMaxDurations entries
- `src/ui/cody/components/TaskDetail.tsx` (L1119-1128, L1465-1473) — pass onSmartResolve to MergeButton, show in done column
- `src/ui/cody/components/MergeButton.tsx` (L19-26, L83-139) — add onSmartResolve prop + Resolve button
- `src/ui/cody/components/tooltip-content.tsx` (L201-211) — update conflict tooltip text
- `.github/workflows/cody.yml` (L14) — update mode description

## Files to Read (reference patterns)
- `scripts/cody/git-utils.ts` — mergeDefaultBranch pattern, execFileSync usage
- `scripts/cody/pipeline/definitions.ts` — stage definition Map pattern, shouldSkip signature
- `scripts/cody/stage-prompts.ts` — ALL_STAGES tuple, STAGE_CONTEXT_FILES record, stageInstructions record
- `.opencode/agents/build.md` — YAML frontmatter + agent instruction pattern
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` — actionSchema z.enum + switch case pattern
- `src/ui/cody/api.ts` — tasksApi.approvePR pattern for new API method
- `src/ui/cody/hooks/index.ts` — useMutation + handleSuccess/handleError pattern
- `src/ui/cody/components/MergeButton.tsx` — usePRCIStatus + hasConflicts pattern
- `tests/unit/scripts/cody/git-utils.test.ts` — execFileSync mock pattern
- `tests/unit/scripts/cody/stage-prompts.test.ts` — stage constant assertion pattern

## Key Signatures
- `export function mergeDefaultBranch(cwd: string): void` from `scripts/cody/git-utils.ts` → changing to `(cwd: string, options?: { leaveConflicts?: boolean }): boolean`
- `export function resolvePipelineForMode(mode: ..., profile, clarify, ctx): PipelineDefinition` from `scripts/cody/engine/pipeline-resolver.ts`
- `export function createRebuildCallback(_mode: ..., _clarify: boolean)` from `scripts/cody/engine/pipeline-resolver.ts`
- `export function buildPipeline(mode, profile, clarify, ctx): PipelineDefinition` from `scripts/cody/pipeline/definitions.ts`
- `function createStageDefinitions(ctx: PipelineContext): Map<string, StageDefinition>` from `scripts/cody/pipeline/definitions.ts`
- `export const VALID_MODES = [...]` from `scripts/cody/parse-inputs.ts`
- `export interface CodyInput { mode: ... }` from `scripts/cody/cody-utils.ts`
- `export const ALL_STAGES = [...] as const` from `scripts/cody/stage-prompts.ts`
- `export const STAGE_CONTEXT_FILES: Record<Stage, string[]>` from `scripts/cody/stage-prompts.ts`
- `export const stageInstructions: Record<Stage, (taskId: string) => string>` from `scripts/cody/stage-prompts.ts`
- `export const STAGE_TIMEOUTS: Record<string, number>` from `scripts/cody/agent-runner.ts`
- `export type GitHubAction = ...` from `src/ui/cody/types.ts`
- `export function useTaskActions({issueNumber, actorLogin, onSuccess, onError})` from `src/ui/cody/hooks/index.ts`

## Reuse Inventory
- `mergeDefaultBranch` from `scripts/cody/git-utils.ts` — modify (not replace)
- `ensureTaskDir` from `scripts/cody/cody-utils.ts` — used in runMergeMode
- `getTaskDir` from `scripts/cody/cody-utils.ts` — used in runFixMode
- `triggerWorkflow` from `src/ui/cody/github-client.ts` — trigger merge workflow
- `postComment` from `src/ui/cody/github-client.ts` — audit trail
- `clearCache` from `src/ui/cody/github-client.ts` — invalidate cache
- `withActor` from `src/app/api/cody/tasks/[taskId]/actions/route.ts` (L60) — format with actor
- `handleSuccess` / `handleError` — existing pattern in useTaskActions
- `usePRCIStatus` from `src/ui/cody/hooks/usePRCIStatus.ts` — provides hasConflicts

## Integration Points
- Must add 'resolve-conflicts' to `ALL_STAGES` in stage-prompts.ts (this is typed as `Stage`)
- Must add 'resolve-conflicts' to `STAGE_CONTEXT_FILES` (keyed by `Stage` type)
- Must add 'resolve-conflicts' to `stageInstructions` (keyed by `Stage` type)
- Must add 'resolve-conflicts' to `IMPL_STAGES` in constants.ts (this is typed as `ImplStage`)
- Must add `MERGE_ORDER` to exports from definitions.ts
- Must import `MERGE_ORDER` in pipeline-resolver.ts
- Must import `writeConflictMarker` in entry.ts
- Must import `hasConflictMarker`, `hasActiveMergeConflicts`, `removeConflictMarker` in definitions.ts

## Imports Verified
- `scripts/cody/git-utils.ts` → exports `mergeDefaultBranch`, `getDefaultBranch`, `ensureFeatureBranch` ✅
- `scripts/cody/cody-utils.ts` → exports `ensureTaskDir`, `getTaskDir`, `CodyInput` ✅
- `scripts/cody/agent-runner.ts` → exports `STAGE_TIMEOUTS`, `DEFAULT_TIMEOUT` ✅
- `scripts/cody/pipeline/definitions.ts` → exports `buildPipeline`, `FIX_FULL_ORDER`, `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT` ✅
- `scripts/cody/engine/pipeline-resolver.ts` → exports `resolvePipelineForMode`, `createRebuildCallback` ✅
- `src/ui/cody/github-client.ts` → exports `triggerWorkflow`, `postComment`, `clearCache` ✅
- `src/ui/cody/hooks/usePRCIStatus.ts` → exports `usePRCIStatus` ✅
- `child_process` → `execFileSync` (used in conflict-utils) ✅
