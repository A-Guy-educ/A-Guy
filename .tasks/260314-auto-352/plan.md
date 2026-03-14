# Plan: Smart Resolve Conflicts

## Rerun Context

This is a rerun. The rerun feedback says "Rerun requested via /cody rerun" with no specific issues. The previous run's plan/build/review artifacts are missing (prev-run/ is empty), so this is a fresh rebuild. The plan incorporates clarification feedback (clarified.md) — specifically:
1. The `shouldSkip` logic must also check git merge state (not just the marker file) to avoid stale marker re-entry.
2. The merge in `runFixMode()` must move AFTER `ctx.taskDir` is resolved (currently at L787), since we need the task dir to write the conflict marker.
3. User-facing docs need updating (README, CHEAT-SHEET).

## Research Findings

### File paths verified
- ✅ `scripts/cody/git-utils.ts` — `mergeDefaultBranch()` at L174-196 (returns `void`, throws on conflict)
- ✅ `scripts/cody/checkout-task-branch.ts` — local `mergeDefaultBranch()` at L92-101 (returns boolean, aborts merge), `process.exit(1)` at L289
- ✅ `scripts/cody/entry.ts` — `runFixMode()` at L743-797 (merge at L750-755, taskDir resolved at L787), mode switch at L319
- ✅ `scripts/cody/cody-utils.ts` — `CodyInput.mode` union at L22
- ✅ `scripts/cody/parse-inputs.ts` — `VALID_MODES` at L33
- ✅ `scripts/cody/pipeline/definitions.ts` — pipeline orders at L42-82, `createStageDefinitions()` at L91, `buildPipeline()` at L436
- ✅ `scripts/cody/engine/pipeline-resolver.ts` — `resolvePipelineForMode()` at L18-45
- ✅ `scripts/cody/stage-prompts.ts` — `ALL_STAGES` at L29-44, `STAGE_CONTEXT_FILES` at L69-116, `stageInstructions` at L131-201
- ✅ `scripts/cody/agent-runner.ts` — `STAGE_TIMEOUTS` at L65-80, `DEFAULT_TIMEOUT` at L62
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — `actionSchema` at L30-57, switch at L82-339
- ✅ `src/ui/cody/types.ts` — `GitHubAction` at L267-279
- ✅ `src/ui/cody/api.ts` — `tasksApi` methods at L175-243
- ✅ `src/ui/cody/hooks/index.ts` — `useTaskActions()` at L269-412
- ✅ `src/ui/cody/components/TaskDetail.tsx` — `getPrimaryAction()` at L221-272, header at L1117-1188, mobile at L1462-1525
- ✅ `src/ui/cody/components/MergeButton.tsx` — `hasConflicts` at L53, full component L1-140
- ✅ `src/ui/cody/components/tooltip-content.tsx` — `MergeTooltipContent` at L156-216
- ✅ `src/ui/cody/constants.ts` — `ALL_STAGES` at L27, `IMPL_STAGES` at L11-20
- ✅ `src/ui/cody/pipeline-utils.ts` — `stageLabels` at L14-27, `stageMaxDurations` at L32-44
- ✅ `.github/workflows/cody.yml` — mode description at L14
- ✅ `.opencode/agents/build.md` — YAML header pattern L1-10
- ✅ `tests/unit/scripts/cody/git-utils.test.ts` — test patterns for git-utils
- 🆕 `scripts/cody/conflict-utils.ts` — new file
- 🆕 `.opencode/agents/merge-resolve.md` — new agent

### Patterns observed
- Pipeline orders: exported const arrays, `PipelineStep[]` for impl, `string[]` for spec
- Stage definitions: Map entries in `createStageDefinitions()` with `name`, `type`, `timeout`, `maxRetries`, `shouldSkip?`, `postActions?`, `agentName?`
- Agent files: YAML frontmatter with `name`, `description`, `mode`, `tools` map
- Dashboard actions: z.enum in `actionSchema` → switch case → `triggerWorkflow()` / `postComment()` → `clearCache()` → return
- API methods: `tasksApi.<method>(issueNumber, actorLogin?)` → POST to `/actions` with action name
- Hook mutations: `useMutation({ mutationFn, onSuccess: handleSuccess(), onError: handleError() })`
- `stageInstructions` entries: `(taskId: string) => string`
- `stageLabels` / `stageMaxDurations`: `Record<string, string|number>` maps
- Stage type `'agent'` requires matching `.opencode/agents/<agentName>.md`

### Integration points
- New stage → `createStageDefinitions()`, pipeline orders, `ALL_STAGES` (stage-prompts), `STAGE_CONTEXT_FILES`, `stageInstructions`
- New mode → `CodyInput.mode`, `VALID_MODES`, `resolvePipelineForMode()`, entry.ts switch
- New action → `actionSchema` z.enum, switch case, `GitHubAction` type, `tasksApi`, `useTaskActions()`
- Dashboard display → `stageLabels`, `stageMaxDurations`, `ALL_STAGES` (constants.ts), `IMPL_STAGES`

## Reuse Inventory

### Existing utilities to reuse (with import paths)
- `mergeDefaultBranch()` from `scripts/cody/git-utils.ts` — will be modified, not replaced
- `ensureTaskDir()` from `scripts/cody/cody-utils.ts` — create task directory
- `getTaskDir()` from `scripts/cody/cody-utils.ts` — get task directory path
- `triggerWorkflow()` from `src/ui/cody/github-client.ts` — supports arbitrary modes already
- `postComment()` from `src/ui/cody/github-client.ts` — audit trail
- `clearCache()` from `src/ui/cody/github-client.ts` — invalidate server cache
- `STAGE_TIMEOUTS.build` from `scripts/cody/agent-runner.ts` — reuse 45min timeout
- `DEFAULT_TIMEOUT` from `scripts/cody/agent-runner.ts` — fallback
- `handleSuccess()` / `handleError()` from `useTaskActions()` — toast notification pattern
- `usePRCIStatus` hook — already provides `hasConflicts` boolean
- `withActor()` from route.ts — actor attribution helper

### New code justified
- `scripts/cody/conflict-utils.ts` — new module encapsulating conflict detection/marker file logic. No existing utility handles this.
- `.opencode/agents/merge-resolve.md` — build agent explicitly forbids git commands (L375-382), so a separate agent with git permissions is required.
- `MERGE_ORDER` pipeline order — unique 4-stage sequence for dedicated merge mode.

---

## Step 1: Conflict Detection Utilities + Modify mergeDefaultBranch

**Files to Touch**:
- `scripts/cody/conflict-utils.ts` (NEW) — conflict detection + marker file utilities
- `scripts/cody/git-utils.ts` (MODIFIED — L174-196) — change `mergeDefaultBranch()` signature and behavior

**Behavior**:

1. Create `scripts/cody/conflict-utils.ts` with four functions:
   - `getConflictedFiles(cwd: string): string[]` — runs `execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { cwd, encoding: 'utf-8' })`, splits by newline, filters empties. Returns file list.
   - `hasActiveMergeConflicts(cwd: string): boolean` — runs `execFileSync('git', ['ls-files', '--unmerged'], { cwd, encoding: 'utf-8' })`. Returns true if output is non-empty (git is in merge conflict state).
   - `writeConflictMarker(taskDir: string, cwd: string): string` — builds markdown with: header, timestamp, current branch, target branch (from `getDefaultBranch()`), list of conflicted files from `getConflictedFiles()`. Writes to `path.join(taskDir, 'merge-conflicts.md')`. Returns the file path.
   - `hasConflictMarker(taskDir: string): boolean` — `fs.existsSync(path.join(taskDir, 'merge-conflicts.md'))`.
   - `removeConflictMarker(taskDir: string): void` — `fs.unlinkSync(path.join(taskDir, 'merge-conflicts.md'))` wrapped in try/catch (no-op if missing).

2. Modify `mergeDefaultBranch()` in `scripts/cody/git-utils.ts` (L174-196):
   - Change signature: `export function mergeDefaultBranch(cwd: string, options?: { leaveConflicts?: boolean }): boolean`
   - On success: `return true` (after the `execFileSync` call at L178-181)
   - On conflict (catch block L182):
     - If `options?.leaveConflicts`: log "Merge conflict detected, leaving in place for resolution", return `false` (do NOT abort, do NOT throw)
     - Else (default): keep existing abort+throw behavior
   - Existing callers that ignore the return value are unaffected (`void` → `boolean` is backward compatible in TS)

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/conflict-utils.test.ts` (NEW):
  - `getConflictedFiles()` — mock `execFileSync` to return `"file1.ts\nfile2.ts\n"`, expect `['file1.ts', 'file2.ts']`
  - `getConflictedFiles()` — mock `execFileSync` to return `""`, expect `[]`
  - `hasActiveMergeConflicts()` — mock `git ls-files --unmerged` to return output → true
  - `hasActiveMergeConflicts()` — mock `git ls-files --unmerged` to return empty → false
  - `writeConflictMarker()` — mock fs + git, verify file written with correct content
  - `hasConflictMarker()` — mock fs.existsSync, return true/false
  - `removeConflictMarker()` — mock fs.unlinkSync, verify called with correct path
- `tests/unit/scripts/cody/git-utils.test.ts` (add tests):
  - `mergeDefaultBranch(cwd)` returns `true` on clean merge
  - `mergeDefaultBranch(cwd)` still throws on conflict (backward compatible)
  - `mergeDefaultBranch(cwd, { leaveConflicts: true })` returns `false` on conflict without aborting

**Acceptance Criteria**:
- [ ] `mergeDefaultBranch(cwd)` (no options) still throws on conflict (backward compatible)
- [ ] `mergeDefaultBranch(cwd, { leaveConflicts: true })` returns `false` on conflict without aborting merge
- [ ] `mergeDefaultBranch(cwd)` returns `true` on clean merge
- [ ] All conflict-utils functions work correctly (getConflictedFiles, hasActiveMergeConflicts, writeConflictMarker, hasConflictMarker, removeConflictMarker)
- [ ] `writeConflictMarker()` creates valid markdown listing all conflicted files
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 2: Create merge-resolve Agent

**Files to Touch**:
- `.opencode/agents/merge-resolve.md` (NEW) — AI agent for conflict resolution

**Behavior**:

Create `.opencode/agents/merge-resolve.md` following the exact pattern from `build.md`:
```yaml
---
name: merge-resolve
description: Resolves git merge conflicts by reading conflict markers, understanding both sides, and producing clean merged files.
mode: primary
tools:
  bash: true
  read: true
  write: true
  edit: true
---
```

Body instructions:
1. Read `merge-conflicts.md` from the task directory for list of conflicted files
2. For each conflicted file:
   - Read the file to see `<<<<<<<`, `=======`, `>>>>>>>` conflict markers
   - Understand the intent of BOTH sides
   - Resolve: preserve both sides' intent, combine when possible
   - Use `Edit` tool to write the resolved content (remove all conflict markers)
3. After resolving all files: run `git add <resolved-files>` for each
4. Run `git merge --continue` (with `GIT_EDITOR=true` env var to skip editor) or `git commit --no-edit` if merge state requires it
5. Run `pnpm -s tsc --noEmit` to verify resolution compiles
6. If tsc fails: fix type errors caused by the merge resolution
7. Delete the `merge-conflicts.md` marker file
8. Write `merge-resolve.md` output summary to the task directory

Key rules in the agent:
- This agent IS allowed to run git commands (unlike build agent)
- Must preserve ALL functional changes from both sides
- When in doubt, keep both sides and adapt imports/types
- Never delete functional code from either side
- Always verify with `tsc --noEmit` after resolution

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/agents/merge-resolve-agent.test.ts` (NEW):
  - Agent file exists at `.opencode/agents/merge-resolve.md`
  - Agent file contains YAML frontmatter with `name: merge-resolve`
  - Agent file contains `bash: true` in tools section
  - Agent file contains reference to `merge-conflicts.md`
  - Agent file contains `tsc --noEmit` instruction
  - Agent file contains `merge-resolve.md` as output file name

**Acceptance Criteria**:
- [ ] Agent file exists with correct YAML header (name, description, tools)
- [ ] Agent has explicit git permissions (bash: true enables git commands)
- [ ] Agent instructions reference reading merge-conflicts.md
- [ ] Agent instructions include `tsc --noEmit` verification step
- [ ] Agent instructions include writing `merge-resolve.md` output summary

---

## Step 3: Add resolve-conflicts Stage + MERGE_ORDER Pipeline

**Files to Touch**:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — add `MERGE_ORDER` after L82, add stage to `createStageDefinitions()`, prepend to existing orders)
- `scripts/cody/stage-prompts.ts` (MODIFIED — add to `ALL_STAGES` at L29, `STAGE_CONTEXT_FILES` at L69, `stageInstructions` at L131)
- `scripts/cody/agent-runner.ts` (MODIFIED — add `'resolve-conflicts'` to `STAGE_TIMEOUTS` at L65)
- `src/ui/cody/constants.ts` (MODIFIED — add to `IMPL_STAGES` at L11)
- `src/ui/cody/pipeline-utils.ts` (MODIFIED — add to `stageLabels` at L14, `stageMaxDurations` at L32)

**Behavior**:

1. In `scripts/cody/pipeline/definitions.ts`:
   - Add after L82 (after FIX_FULL_ORDER):
     ```typescript
     // Merge-only pipeline: resolve conflicts, commit, verify, create PR
     export const MERGE_ORDER: PipelineStep[] = ['resolve-conflicts', 'commit', 'verify', 'pr']
     ```
   - Prepend `'resolve-conflicts'` to `IMPL_ORDER_STANDARD` (before 'architect' at L45)
   - Prepend `'resolve-conflicts'` to `IMPL_ORDER_LIGHTWEIGHT` (before 'architect' at L56)
   - Prepend `'resolve-conflicts'` to `FIX_FULL_ORDER` (before 'taskify' at L72)
   - Import `hasConflictMarker`, `hasActiveMergeConflicts`, `removeConflictMarker` from `'../conflict-utils'`
   - Add `resolve-conflicts` stage definition in `createStageDefinitions()`:
     ```typescript
     stages.set('resolve-conflicts', {
       name: 'resolve-conflicts',
       type: 'agent',
       agentName: 'merge-resolve',
       timeout: STAGE_TIMEOUTS['resolve-conflicts'] ?? DEFAULT_TIMEOUT,
       maxRetries: 1,
       shouldSkip: (ctx) => {
         // No marker file → skip (no conflicts detected)
         if (!hasConflictMarker(ctx.taskDir)) {
           return { shouldSkip: true, reason: 'No merge-conflicts.md marker found' }
         }
         // Marker exists but git is NOT in merge state → stale marker, clean up and skip
         try {
           if (!hasActiveMergeConflicts(process.cwd())) {
             removeConflictMarker(ctx.taskDir)
             return { shouldSkip: true, reason: 'Stale merge-conflicts.md marker (no active merge conflicts)' }
           }
         } catch {
           // Can't check git state — proceed with resolution
         }
         return { shouldSkip: false }
       },
       postActions: [
         {
           type: 'commit-task-files',
           stagingStrategy: 'tracked+task',
           push: true,
           ensureBranch: false,
         },
       ],
     })
     ```
   - Add `MERGE_ORDER` to exports

2. In `scripts/cody/stage-prompts.ts`:
   - Add `'resolve-conflicts'` to `ALL_STAGES` array (before 'taskify' at L30, since it runs first)
   - Add `STAGE_CONTEXT_FILES['resolve-conflicts'] = ['merge-conflicts.md']`
   - Add `stageInstructions['resolve-conflicts']` — returns instruction to read merge-conflicts.md and resolve conflicts

3. In `scripts/cody/agent-runner.ts` L65-80:
   - Add `'resolve-conflicts': ms('20m'),` to `STAGE_TIMEOUTS`

4. In `src/ui/cody/constants.ts`:
   - Add `'resolve-conflicts'` to start of `IMPL_STAGES` array (L11)

5. In `src/ui/cody/pipeline-utils.ts`:
   - Add `'resolve-conflicts': 'Resolving Conflicts'` to `stageLabels` (L14)
   - Add `'resolve-conflicts': 20 * 60 * 1000` to `stageMaxDurations` (L32)

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/pipeline/definitions.test.ts` (NEW or add to existing):
  - `MERGE_ORDER` contains exactly `['resolve-conflicts', 'commit', 'verify', 'pr']`
  - `IMPL_ORDER_STANDARD[0]` is `'resolve-conflicts'`
  - `IMPL_ORDER_LIGHTWEIGHT[0]` is `'resolve-conflicts'`
  - `FIX_FULL_ORDER[0]` is `'resolve-conflicts'`
  - `createStageDefinitions()` returns a stage named `'resolve-conflicts'` with `type: 'agent'` and `agentName: 'merge-resolve'`
  - `resolve-conflicts` stage's `shouldSkip` returns `{ shouldSkip: true }` when no marker file exists
  - `resolve-conflicts` stage's `shouldSkip` returns `{ shouldSkip: false }` when marker AND active conflicts exist
  - `resolve-conflicts` stage's `shouldSkip` cleans up stale marker and skips when marker exists but no active conflicts
- `tests/unit/scripts/cody/stage-prompts.test.ts` (add tests):
  - `ALL_STAGES` includes `'resolve-conflicts'`
  - `STAGE_CONTEXT_FILES['resolve-conflicts']` equals `['merge-conflicts.md']`
  - `stageInstructions['resolve-conflicts']` is a function that returns a non-empty string

**Acceptance Criteria**:
- [ ] `resolve-conflicts` stage defined with `type: 'agent'`, `agentName: 'merge-resolve'`
- [ ] Stage auto-skips when `merge-conflicts.md` doesn't exist
- [ ] Stage detects and cleans up stale markers (marker exists but no active git merge conflicts)
- [ ] `MERGE_ORDER` has correct 4-stage sequence
- [ ] `FIX_FULL_ORDER` starts with `resolve-conflicts`
- [ ] `IMPL_ORDER_STANDARD` and `IMPL_ORDER_LIGHTWEIGHT` start with `resolve-conflicts`
- [ ] `ALL_STAGES` includes `'resolve-conflicts'`
- [ ] `STAGE_CONTEXT_FILES` maps `resolve-conflicts` to `['merge-conflicts.md']`
- [ ] `stageInstructions` has `resolve-conflicts` entry
- [ ] Dashboard `stageLabels` includes "Resolving Conflicts" label
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 4: Add merge Mode to Entry Point + Pipeline Resolver

**Files to Touch**:
- `scripts/cody/cody-utils.ts` (MODIFIED — L22) — add `'merge'` to mode union
- `scripts/cody/parse-inputs.ts` (MODIFIED — L33) — add `'merge'` to `VALID_MODES`
- `scripts/cody/engine/pipeline-resolver.ts` (MODIFIED — L18-45, L66) — add `'merge'` to mode type + switch case
- `scripts/cody/entry.ts` (MODIFIED — L30, L319, add `runMergeMode()`) — import + switch case + new function

**Behavior**:

1. In `scripts/cody/cody-utils.ts` L22:
   - Change `mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status'`
   - To: `mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status' | 'merge'`

2. In `scripts/cody/parse-inputs.ts` L33:
   - Change `VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status']`
   - To: `VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status', 'merge']`

3. In `scripts/cody/engine/pipeline-resolver.ts`:
   - L19: Add `| 'merge'` to mode parameter type
   - L24-44: Add case before `default`:
     ```typescript
     case 'merge': {
       const mergePipeline = buildPipeline('impl', profile, clarify, ctx)
       return { stages: mergePipeline.stages, order: MERGE_ORDER }
     }
     ```
   - Import `MERGE_ORDER` from `'../pipeline/definitions'`
   - L66: Add `| 'merge'` to `createRebuildCallback` mode parameter type

4. In `scripts/cody/entry.ts`:
   - Add import: `import { writeConflictMarker } from './conflict-utils'`
   - L319 switch: Add case:
     ```typescript
     case 'merge':
       await runMergeMode(ctx)
       break
     ```
   - Add `runMergeMode()` function:
     ```typescript
     async function runMergeMode(ctx: PipelineContext): Promise<void> {
       const { input } = ctx
       logger.info('Running Cody MERGE pipeline (resolve conflicts and verify)...\n')

       const taskDir = ensureTaskDir(input.taskId)
       ctx.taskDir = taskDir

       // Attempt merge with leaveConflicts to detect conflicts without aborting
       const cwd = process.cwd()
       const merged = mergeDefaultBranch(cwd, { leaveConflicts: true })
       if (!merged) {
         writeConflictMarker(taskDir, cwd)
         logger.info('Merge conflicts detected — resolve-conflicts stage will handle them')
       } else {
         logger.info('No merge conflicts detected — branch is up to date')
       }

       // Resolve and run pipeline
       const pipeline = resolvePipelineForMode('merge', ctx.profile, input.clarify ?? false, ctx)
       const rebuildCallback = createRebuildCallback('merge', input.clarify ?? false)
       await runPipeline(ctx, pipeline, rebuildCallback)

       logger.info('\n✅ Merge resolve complete!')
     }
     ```

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/parse-inputs.test.ts` (add test):
  - `'merge'` is in `VALID_MODES`
- `tests/unit/scripts/cody/pipeline-resolver.test.ts` (NEW or add to existing):
  - `resolvePipelineForMode('merge', 'standard', false, ctx)` returns pipeline with `MERGE_ORDER` order
  - Pipeline stages map contains `'resolve-conflicts'`, `'commit'`, `'verify'`, `'pr'`

**Acceptance Criteria**:
- [ ] `@cody merge` is parsed as mode `'merge'`
- [ ] `CodyInput.mode` type includes `'merge'`
- [ ] `resolvePipelineForMode('merge', ...)` returns pipeline with `MERGE_ORDER`
- [ ] entry.ts switch handles `'merge'` case
- [ ] `runMergeMode()` calls `mergeDefaultBranch` with `{ leaveConflicts: true }`
- [ ] `runMergeMode()` writes conflict marker when merge returns false
- [ ] `runMergeMode()` does NOT write marker when merge returns true
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 5: Fix runFixMode Bug + checkout-task-branch.ts

**Files to Touch**:
- `scripts/cody/entry.ts` (MODIFIED — L750-755) — fix merge error swallowing in `runFixMode()`
- `scripts/cody/checkout-task-branch.ts` (MODIFIED — L287-289) — remove `process.exit(1)` on conflict

**Behavior**:

1. Fix `runFixMode()` in `entry.ts`:
   - The merge attempt is at L750-755, BUT `ctx.taskDir` isn't set until L787. Per clarified.md, we must move the merge AFTER taskDir is resolved.
   - Remove the merge block at L750-756 (the `if (input.isPullRequest) { try { mergeDefaultBranch... } catch ... }`)
   - After L788 (`ctx.taskDir = originalTaskDir`), add:
     ```typescript
     // Step 0b: Merge default branch — moved here so ctx.taskDir is available for marker
     if (input.isPullRequest) {
       const merged = mergeDefaultBranch(process.cwd(), { leaveConflicts: true })
       if (!merged) {
         writeConflictMarker(ctx.taskDir, process.cwd())
         logger.info('Merge conflicts detected — resolve-conflicts stage will handle them')
       }
     }
     ```
   - Add import for `writeConflictMarker` (if not already added in Step 4)

2. Fix `checkout-task-branch.ts` L287-290:
   - **Current code** (L287-290):
     ```typescript
     if (!mergeDefaultBranch(defaultBranch)) {
       logger.info('=== Aborting merge ===')
       process.exit(1)
     }
     ```
   - **New code**:
     ```typescript
     if (!mergeDefaultBranch(defaultBranch)) {
       logger.info('=== Merge conflicts detected — will be resolved by pipeline ===')
       // Don't exit(1) — the merge was already aborted by the local mergeDefaultBranch().
       // The pipeline's entry.ts (runMergeMode/runFixMode) will re-attempt the merge
       // with { leaveConflicts: true } and write the conflict marker for resolution.
     }
     ```
   - **Important sequencing note**: This file's local `mergeDefaultBranch()` (L92-101) already returns boolean and already does `git merge --abort` on conflict. The working tree is left clean after this script exits. When `entry.ts` later runs (for `merge` or `fix` modes), it re-attempts the merge with `{ leaveConflicts: true }` to properly detect and leave conflicts in place for the agent. For other modes (impl, rerun, full), conflicts will be detected by `ensureFeatureBranch()` in the build stage's `preExecute` hook which throws — same as current behavior.
   - The `process.exit(0)` at L292 is now reached on conflict (instead of process.exit(1)). This lets CI continue to entry.ts.

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/checkout-task-branch.test.ts` (add or modify):
  - When `mergeDefaultBranch()` returns false, `process.exit` is NOT called (or is called with 0, not 1)
  - Log message contains "will be resolved by pipeline"

**Acceptance Criteria**:
- [ ] `runFixMode()` no longer swallows merge errors with try/catch
- [ ] `runFixMode()` uses `mergeDefaultBranch(..., { leaveConflicts: true })`
- [ ] `runFixMode()` writes conflict marker when conflicts detected (after taskDir is resolved)
- [ ] `checkout-task-branch.ts` doesn't `process.exit(1)` on merge conflict
- [ ] `checkout-task-branch.ts` logs that pipeline will resolve conflicts
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 6: Dashboard API — Add smart-resolve Action

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — L31-49, add case after L296)

**Behavior**:

1. Add `'smart-resolve'` to the `actionSchema` z.enum array (after `'approve-pr'` at L48):
   ```typescript
   'approve-pr',
   'smart-resolve',
   ```

2. Add case handler in the switch statement (before `default` at L338):
   ```typescript
   case 'smart-resolve': {
     await triggerWorkflow({
       taskId,
       mode: 'merge',
     })
     await postComment(
       issueNumber,
       withActor('🔀 Smart resolve triggered — resolving merge conflicts', actor),
     )
     clearCache()
     return NextResponse.json({ success: true, message: 'Conflict resolution triggered' })
   }
   ```

**Tests** (FAIL before, PASS after):
- `tests/unit/api/cody/actions-smart-resolve.test.ts` (NEW):
  - POST with `{ action: 'smart-resolve' }` returns `{ success: true }` (mock triggerWorkflow + postComment)
  - `triggerWorkflow` called with `{ taskId, mode: 'merge' }`
  - `postComment` called with conflict resolution message
  - `clearCache` called

**Acceptance Criteria**:
- [ ] `actionSchema` accepts `'smart-resolve'` as a valid action
- [ ] Action triggers `triggerWorkflow({ taskId, mode: 'merge' })`
- [ ] Action posts comment on issue for audit trail
- [ ] Action calls `clearCache()`
- [ ] Action returns success response
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 7: Dashboard UI — Types, API Client, Hooks

**Files to Touch**:
- `src/ui/cody/types.ts` (MODIFIED — L267-279) — add to `GitHubAction` union
- `src/ui/cody/api.ts` (MODIFIED — after L213) — add `smartResolve()` to `tasksApi`
- `src/ui/cody/hooks/index.ts` (MODIFIED — L269-412) — add mutation + wire into isPending + return

**Behavior**:

1. In `src/ui/cody/types.ts` L267-279:
   - Add `| 'smart-resolve'` to `GitHubAction` type:
     ```typescript
     export type GitHubAction =
       | 'approve'
       | 'reject'
       // ...existing...
       | 'comment'
       | 'smart-resolve'
     ```

2. In `src/ui/cody/api.ts`, add after `approvePR` method (~L213):
   ```typescript
   smartResolve: async (issueNumber: number, actorLogin?: string): Promise<ActionResponse> => {
     const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'smart-resolve', ...(actorLogin && { actorLogin }) }),
     })
     return handleResponse(res)
   },
   ```

3. In `src/ui/cody/hooks/index.ts`:
   - After `approvePR` mutation (~L348), add:
     ```typescript
     const smartResolve = useMutation({
       mutationFn: () => codyApi.tasks.smartResolve(issueNumber, actorLogin),
       onSuccess: handleSuccess('Conflict resolution started'),
       onError: handleError('resolve conflicts'),
     })
     ```
   - Add `smartResolve.isPending` to the `isPending` OR chain (~L362-374)
   - Add `smartResolve: smartResolve.mutate` to the return object (~L376-388)
   - Add `'smart-resolve'` to the `pendingAction` ternary chain (~L390-410):
     ```typescript
     : smartResolve.isPending
       ? 'smart-resolve'
     ```

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/api-smart-resolve.test.ts` (NEW):
  - `tasksApi.smartResolve(123)` calls fetch with correct endpoint and `action: 'smart-resolve'`
  - `tasksApi.smartResolve(123, 'testuser')` includes actorLogin in body

**Acceptance Criteria**:
- [ ] `GitHubAction` type includes `'smart-resolve'`
- [ ] `tasksApi.smartResolve()` sends correct POST request
- [ ] `useTaskActions()` exposes `smartResolve` mutation
- [ ] `isPending` includes `smartResolve.isPending`
- [ ] `pendingAction` includes `'smart-resolve'`
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 8: Dashboard UI — Smart Resolve Button in TaskDetail + Tooltips + MergeButton

**Files to Touch**:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — imports, L1117-1128 desktop, L1464-1473 mobile) — add Smart Resolve button
- `src/ui/cody/components/tooltip-content.tsx` (MODIFIED — L201-211) — update conflict tooltip text
- `src/ui/cody/components/MergeButton.tsx` (MODIFIED — L19-26 props, L83-139 render) — add `onSmartResolve` prop

**Behavior**:

1. In `TaskDetail.tsx`:
   - Add `GitMerge` to lucide-react imports (L31-56)
   - Add `usePRCIStatus` import from `'../hooks/usePRCIStatus'`
   - In the desktop header section (between MergeButton at L1119-1128 and Approve UI at L1131):
     ```tsx
     {/* Smart Resolve button (when PR has conflicts) */}
     {task.associatedPR && (task.column === 'done' || task.column === 'review') && (() => {
       // Need conflict detection — use usePRCIStatus inline data from MergeButton or pass down
       // Since MergeButton already uses usePRCIStatus, we add the button next to it
       return null // Handled via MergeButton's onSmartResolve prop below
     })()}
     ```
   - Actually, the cleaner approach: add the `onSmartResolve` callback to `MergeButton`:
     - Pass `onSmartResolve={() => taskActions.smartResolve?.()}` to the existing MergeButton components at L1119-1128 (desktop) and L1465-1473 (mobile)
   - Also add a standalone Smart Resolve button in the header for when there's no MergeButton but there are conflicts. Add between the MergeButton and Approve UI blocks for non-review columns (done column):
     ```tsx
     {/* Smart Resolve button (done column with conflicts) */}
     {task.column === 'done' && task.associatedPR && (
       <SmartResolveButton 
         prNumber={task.associatedPR.number}
         onResolve={() => taskActions.smartResolve?.()}
         isPending={taskActions.pendingAction === 'smart-resolve'}
       />
     )}
     ```
   - Create an inline `SmartResolveButton` component that uses `usePRCIStatus` internally:
     - Takes `prNumber`, `onResolve`, `isPending` props
     - Calls `usePRCIStatus(prNumber)` to get `hasConflicts`
     - Renders button only when `hasConflicts === true`
     - Yellow variant, `GitMerge` icon, "Smart Resolve" label

2. In `tooltip-content.tsx` L201-211:
   - Change the text at L206-210 from:
     ```
     "This PR has merge conflicts that must be resolved before merging."
     "Update the branch or resolve conflicts on GitHub."
     ```
   - To:
     ```
     "This PR has merge conflicts that must be resolved before merging."
     "Click Smart Resolve to automatically resolve conflicts, or resolve manually on GitHub."
     ```

3. In `MergeButton.tsx`:
   - Add `onSmartResolve?: () => void` prop to `MergeButtonProps` (L19-26)
   - When `hasConflicts` is true, render a small "Resolve" button/link next to the merge button (inside the span at L98, after the main Button at L99-126):
     ```tsx
     {hasConflicts && onSmartResolve && (
       <Button
         variant="ghost"
         size="sm"
         onClick={(e) => { e.stopPropagation(); onSmartResolve() }}
         onMouseDown={(e) => e.stopPropagation()}
         className="h-8 text-xs px-2 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
       >
         Resolve
       </Button>
     )}
     ```

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/components/TaskDetail-smart-resolve.test.tsx` (NEW):
  - Smart Resolve button renders in `done` column when `hasConflicts` is true (mock usePRCIStatus)
  - Smart Resolve button does NOT render when `hasConflicts` is false
  - Clicking button calls `taskActions.smartResolve()`
- `tests/unit/ui/cody/components/MergeButton-resolve.test.tsx` (NEW):
  - MergeButton renders "Resolve" link when `hasConflicts` is true and `onSmartResolve` provided
  - MergeButton does NOT render "Resolve" when no conflicts

**Acceptance Criteria**:
- [ ] Smart Resolve button appears in TaskDetail when PR has conflicts and task is in done/review column
- [ ] Button does not appear when there are no conflicts
- [ ] Button triggers `smartResolve` mutation on click
- [ ] MergeButton shows "Resolve" action when conflicts detected and onSmartResolve provided
- [ ] Conflict tooltip text updated to mention Smart Resolve
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 9: Workflow YAML + Documentation Updates

**Files to Touch**:
- `.github/workflows/cody.yml` (MODIFIED — L14) — update mode description
- `scripts/cody/README.md` (MODIFIED — if it has a modes table) — add merge mode

**Behavior**:

1. In `.github/workflows/cody.yml` L14:
   - Change: `description: 'Pipeline mode: spec, impl, rerun, full, status'`
   - To: `description: 'Pipeline mode: spec, impl, rerun, fix, full, merge, status'`
   - (Also note that `fix` was already missing from the description — include it now)

2. If `scripts/cody/README.md` has a modes table, add merge mode:
   - `merge` — Resolve merge conflicts on the feature branch and verify

**Tests** (FAIL before, PASS after):
- These are config/doc changes — no automated tests needed. Verified by visual inspection.

**Acceptance Criteria**:
- [ ] Workflow YAML documents `merge` as a valid mode
- [ ] `pnpm -s tsc --noEmit` passes

---

## Summary

| Step | Description | Files | Est. Time |
|------|-------------|-------|-----------|
| 1 | Conflict detection utilities + modify mergeDefaultBranch | 2 files (1 new, 1 mod) | 20 min |
| 2 | Create merge-resolve agent | 1 file (new) | 10 min |
| 3 | Add resolve-conflicts stage + MERGE_ORDER + dashboard display | 5 files (modified) | 25 min |
| 4 | Add merge mode to entry + pipeline resolver | 4 files (modified) | 20 min |
| 5 | Fix runFixMode bug + checkout-task-branch | 2 files (modified) | 15 min |
| 6 | Dashboard API — smart-resolve action | 1 file (modified) | 10 min |
| 7 | Dashboard UI — types/api/hooks | 3 files (modified) | 15 min |
| 8 | Dashboard UI — Smart Resolve button + tooltips | 3 files (modified) | 20 min |
| 9 | Workflow YAML + docs | 2 files (modified) | 5 min |
| **Total** | | **23 files** | **~140 min** |

### Key Design Decisions
1. **`resolve-conflicts` auto-skips** when no `merge-conflicts.md` marker exists — zero overhead for non-conflict runs
2. **Stale marker detection**: `shouldSkip` checks BOTH marker file AND `git ls-files --unmerged` — prevents re-entering resolution when marker wasn't cleaned up
3. **Prepended to ALL impl pipelines** (full, rerun, fix) — any mode that runs build will first check for conflicts
4. **`fix` mode bug is fixed** — merge moved AFTER taskDir resolution per clarified.md feedback
5. **`checkout-task-branch.ts` no longer kills CI** on conflict — lets the pipeline handle it (still aborts the merge to leave clean working tree)
6. **Dedicated agent** (`merge-resolve`) with git permissions — clean separation from build agent
7. **Dashboard button** only shows when GitHub reports `hasConflicts` on the PR (via usePRCIStatus hook)
