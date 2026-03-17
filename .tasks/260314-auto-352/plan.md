# Plan: Smart Resolve Conflicts

## Rerun Context

This is a rerun. Previous run failed (no detailed error). The previous plan was not preserved in prev-run/.

**Key clarification findings from previous run:**
1. `STAGE_NAMES` and pipeline orders now live in `scripts/cody/stages/registry.ts` (not `pipeline/definitions.ts` or `stage-prompts.ts`)
2. `stageInstructions` in `stage-prompts.ts` is typed `Record<string, ...>`, not `Record<StageName, ...>` — so adding new stages there won't cause type errors
3. Mode handlers live in `scripts/cody/modes/*.ts` (not inline in `entry.ts`)
4. The `runFixMode` merge bug is in `scripts/cody/modes/fix.ts` L30-35 (not entry.ts)
5. `STAGE_REGISTRY` in registry.ts is `Record<StageName, StageMetadata>` — adding `resolve-conflicts` to `STAGE_NAMES` requires adding a corresponding registry entry
6. `clarified.md` flagged: fix mode merge happens BEFORE taskDir is resolved (L30 vs L67) — must reorder

## Research Findings

### File paths verified
- ✅ `scripts/cody/git-utils.ts` — `mergeDefaultBranch()` at L267-295
- ✅ `scripts/cody/stages/registry.ts` — `STAGE_NAMES` at L21-35, `STAGE_REGISTRY` at L80-201, `StageName` type at L37, pipeline orders at L276-323
- ✅ `scripts/cody/pipeline/definitions.ts` — re-exports from registry L49-59, `createStageDefinitions()` at L68+, `buildPipeline()` further down
- ✅ `scripts/cody/stage-prompts.ts` — `stageInstructions` at L43-115, `buildStagePrompt()` at L148
- ✅ `scripts/cody/modes/fix.ts` — `runFixMode()` at L23, merge bug at L30-35, taskDir resolved at L67
- ✅ `scripts/cody/modes/index.ts` — barrel exports at L7-12
- ✅ `scripts/cody/entry.ts` — mode switch at L336-357, mode handler imports from `./modes` at L28-34
- ✅ `scripts/cody/cody-utils.ts` — `CodyInput.mode` at L19
- ✅ `scripts/cody/parse-inputs.ts` — `VALID_MODES` at L33
- ✅ `scripts/cody/engine/pipeline-resolver.ts` — `resolvePipelineForMode()` at L18-45, mode type at L19
- ✅ `scripts/cody/checkout-task-branch.ts` — local `mergeDefaultBranch()` at L92-101, `process.exit(1)` at L289
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — `actionSchema` at L35-55, switch at L115-400
- ✅ `src/ui/cody/types.ts` — `GitHubAction` at L282-293
- ✅ `src/ui/cody/api.ts` — `tasksApi` methods at L170+
- ✅ `src/ui/cody/hooks/index.ts` — `useTaskActions()` at L298-461
- ✅ `src/ui/cody/components/TaskDetail.tsx` — `getPrimaryAction()` at L224-275
- ✅ `src/ui/cody/components/MergeButton.tsx` — `hasConflicts` handling at L53-56
- ✅ `src/ui/cody/components/tooltip-content.tsx` — `MergeTooltipContent` at L156-216
- ✅ `src/ui/cody/constants.ts` — `ALL_STAGES` at L27, stage types at L23-25
- ✅ `src/ui/cody/pipeline-utils.ts` — `stageLabels` at L14-27, `stageMaxDurations` at L32-44
- ✅ `.github/workflows/cody.yml` — mode description at L14
- ✅ `.opencode/agents/build.md` — YAML header pattern (lines 1-10)
- 🆕 `scripts/cody/conflict-utils.ts` — NEW
- 🆕 `scripts/cody/modes/merge.ts` — NEW
- 🆕 `.opencode/agents/merge-resolve.md` — NEW
- ✅ `tests/unit/scripts/cody/git-utils.test.ts` — existing test file
- ✅ `tests/unit/scripts/cody/entry-modes.test.ts` — existing test file
- ✅ `tests/unit/scripts/cody/stage-registry.test.ts` — existing test file
- ✅ `tests/helpers/cody/` — test helpers with `createMockPipelineContext()`

### Patterns observed
- Stage names are the canonical `STAGE_NAMES` const array in `scripts/cody/stages/registry.ts` — `StageName` type is derived from it
- `STAGE_REGISTRY` must have an entry for every `StageName` (typed constraint)
- Pipeline orders (`IMPL_ORDER_STANDARD`, etc.) use `TypedPipelineStep[]` which is `StageName | { parallel: StageName[] }`
- Mode handlers are separate files in `scripts/cody/modes/` with barrel export via `index.ts`
- Agent files use YAML frontmatter with `tools:` block
- Dashboard actions: actionSchema z.enum → switch case → triggerWorkflow/postComment
- `stageInstructions` in `stage-prompts.ts` is `Record<string, ...>` — not constrained by StageName

### Integration points
- `STAGE_NAMES` array → `StageName` type → `STAGE_REGISTRY` → `createStageDefinitions()` → `buildPipeline()`
- New mode: `CodyInput.mode` → `VALID_MODES` → `resolvePipelineForMode()` → mode handler file → `entry.ts` switch
- Dashboard: `actionSchema` z.enum → switch case → `GitHubAction` type → `tasksApi` → `useTaskActions()`

## Reuse Inventory

### Existing utilities to reuse
- `getDefaultBranch(cwd)` from `scripts/cody/git-utils.ts` — get default branch name for merge
- `execFileSync` from `child_process` — used by existing git operations
- `logger` from `scripts/cody/logger` — consistent logging
- `createMockPipelineContext()` from `tests/helpers/cody/` — test fixture factory
- `triggerWorkflow()` from `src/ui/cody/github-client.ts` — trigger CI workflow
- `postWithAttribution()` from route.ts — post comment with actor
- `handleSuccess()`/`handleError()` from `useTaskActions` — toast notification pattern
- `usePRCIStatus` hook — provides `hasConflicts` boolean

### New code justified
- `scripts/cody/conflict-utils.ts` — encapsulates conflict detection/marker logic; no existing utility does this
- `scripts/cody/modes/merge.ts` — follows existing `modes/*.ts` pattern for new mode handler
- `.opencode/agents/merge-resolve.md` — new agent with git permissions (build agent explicitly forbids git)
- `MERGE_ORDER` pipeline — unique 4-stage sequence for merge mode

---

## Step 1: Add resolve-conflicts to Stage Registry + Conflict Utilities

**Files to Touch**:
- `scripts/cody/stages/registry.ts` (MODIFIED — L21-35, L37, L57, L80-201, L279-323)
- `scripts/cody/conflict-utils.ts` (NEW)

**Behavior**:

1. In `scripts/cody/stages/registry.ts`:
   - Add `'resolve-conflicts'` to `STAGE_NAMES` array (after 'pr' or at beginning — it's a utility stage)
   - Add `RESOLVE_CONFLICTS: 'resolve-conflicts'` to `STAGES` const
   - Add `'resolve-conflicts'` entry to `STAGE_REGISTRY`:
     ```
     'resolve-conflicts': {
       outputFile: 'merge-resolve.md',
       timeout: ms('45m'),
       complexityThreshold: 0,
       contextFiles: ['merge-conflicts.md'],
       type: 'agent',
     }
     ```
   - Add `MERGE_ORDER` pipeline: `['resolve-conflicts', 'commit', 'verify', 'pr']`
   - Prepend `'resolve-conflicts'` to `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`, and `FIX_FULL_ORDER`
   - Export `MERGE_ORDER`

2. Create `scripts/cody/conflict-utils.ts` with:
   - `getConflictedFiles(cwd: string): string[]` — runs `git diff --name-only --diff-filter=U`, returns lines. Also checks `git ls-files --unmerged` as secondary validation (per clarified.md gap #2).
   - `writeConflictMarker(taskDir: string, cwd: string): string` — creates `<taskDir>/merge-conflicts.md` with: conflicted file list, current branch, default branch, timestamp. Returns marker path.
   - `hasConflictMarker(taskDir: string): boolean` — checks if `merge-conflicts.md` exists
   - `removeConflictMarker(taskDir: string): void` — deletes `merge-conflicts.md` if exists

3. Modify `mergeDefaultBranch()` in `scripts/cody/git-utils.ts` (L267-295):
   - Add optional `options?: { leaveConflicts?: boolean }` parameter
   - Change return type from `void` to `boolean`
   - When `leaveConflicts: true` and conflict: log warning, return `false` (do NOT abort merge, do NOT throw)
   - When `leaveConflicts` is falsy (default): keep existing abort + throw behavior, but return `true` on success
   - This is backward compatible: existing callers ignore return value, and default behavior still throws

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/conflict-utils.test.ts` (NEW):
  - `getConflictedFiles()` returns list from mocked git output
  - `getConflictedFiles()` returns empty array when no conflicts
  - `writeConflictMarker()` creates marker file with correct content
  - `hasConflictMarker()` returns true when marker exists
  - `hasConflictMarker()` returns false when marker doesn't exist
  - `removeConflictMarker()` deletes the marker file
- `tests/unit/scripts/cody/stage-registry.test.ts` (MODIFIED — add tests):
  - `STAGE_NAMES` contains `'resolve-conflicts'`
  - `STAGE_REGISTRY['resolve-conflicts']` has correct metadata
  - `MERGE_ORDER` equals `['resolve-conflicts', 'commit', 'verify', 'pr']`
  - `IMPL_ORDER_STANDARD[0]` is `'resolve-conflicts'`
  - `IMPL_ORDER_LIGHTWEIGHT[0]` is `'resolve-conflicts'`
  - `FIX_FULL_ORDER[0]` is `'resolve-conflicts'`
- `tests/unit/scripts/cody/git-utils.test.ts` (MODIFIED — add tests):
  - `mergeDefaultBranch(cwd)` (no options) still throws on conflict (backward compat)
  - `mergeDefaultBranch(cwd)` returns `true` on clean merge
  - `mergeDefaultBranch(cwd, { leaveConflicts: true })` returns `false` on conflict without throwing

**Run**: `pnpm vitest run tests/unit/scripts/cody/conflict-utils.test.ts tests/unit/scripts/cody/stage-registry.test.ts tests/unit/scripts/cody/git-utils.test.ts`

**Acceptance Criteria**:
- [ ] `STAGE_NAMES` includes `'resolve-conflicts'`
- [ ] `STAGE_REGISTRY` has `resolve-conflicts` entry with `type: 'agent'`
- [ ] `MERGE_ORDER` equals `['resolve-conflicts', 'commit', 'verify', 'pr']`
- [ ] `IMPL_ORDER_STANDARD` starts with `'resolve-conflicts'`
- [ ] `IMPL_ORDER_LIGHTWEIGHT` starts with `'resolve-conflicts'`
- [ ] `FIX_FULL_ORDER` starts with `'resolve-conflicts'`
- [ ] `mergeDefaultBranch(cwd)` backward compatible (throws on conflict)
- [ ] `mergeDefaultBranch(cwd, { leaveConflicts: true })` returns false without throwing
- [ ] `writeConflictMarker()` creates valid markdown file
- [ ] `hasConflictMarker()` checks both marker file AND git merge state

---

## Step 2: Create merge-resolve Agent + resolve-conflicts Stage Definition

**Files to Touch**:
- `.opencode/agents/merge-resolve.md` (NEW)
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — add stage def in `createStageDefinitions()`)
- `scripts/cody/stage-prompts.ts` (MODIFIED — add `stageInstructions['resolve-conflicts']`)

**Behavior**:

1. Create `.opencode/agents/merge-resolve.md`:
   - YAML header: `name: merge-resolve`, `description: Resolves merge conflicts...`, `tools: bash, read, write, edit`
   - Instructions:
     1. Read `merge-conflicts.md` from task directory
     2. For each conflicted file: read file, understand both sides, resolve (remove markers)
     3. `git add <resolved-files>` for each file
     4. `git merge --continue` (or `git commit --no-edit`) to complete merge
     5. `pnpm -s tsc --noEmit` to verify resolution compiles
     6. If tsc fails: fix type errors from merge
     7. Delete `merge-conflicts.md` marker
     8. Write `merge-resolve.md` output summary
   - Key rules: HAS git permissions, preserve both sides' intent, verify with tsc

2. In `scripts/cody/pipeline/definitions.ts`, add to `createStageDefinitions()`:
   ```typescript
   stages.set('resolve-conflicts', {
     name: 'resolve-conflicts',
     type: 'agent',
     agentName: 'merge-resolve',
     timeout: getStageTimeout('resolve-conflicts'),
     maxRetries: 1,
     shouldSkip: (ctx) => {
       // Skip if no conflict marker AND git is not in merge state
       const markerPath = path.join(ctx.taskDir, 'merge-conflicts.md')
       if (!fs.existsSync(markerPath)) {
         return { shouldSkip: true, reason: 'No merge conflicts detected (no marker file)' }
       }
       return { shouldSkip: false }
     },
     postActions: [
       { type: 'commit-task-files', stagingStrategy: 'tracked+task', push: true, ensureBranch: false },
     ],
   })
   ```

3. In `scripts/cody/stage-prompts.ts`, add:
   ```typescript
   'resolve-conflicts': () => `MERGE CONFLICT RESOLUTION STAGE

   You are resolving git merge conflicts. Read merge-conflicts.md for the list of conflicted files.
   For each file: resolve conflict markers, git add, then git merge --continue.
   Verify with pnpm -s tsc --noEmit. Delete merge-conflicts.md when done.`,
   ```

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/agents/merge-resolve-agent.test.ts` (NEW):
  - Agent file exists at `.opencode/agents/merge-resolve.md`
  - Agent file contains `tools:` with `bash: true`
  - Agent file references `merge-conflicts.md`
  - Agent file contains `tsc --noEmit` instruction
  - Agent file contains `git merge --continue` instruction
- `tests/unit/scripts/cody/stage-prompts.test.ts` (MODIFIED — add):
  - `stageInstructions['resolve-conflicts']` exists and returns non-empty string

**Run**: `pnpm vitest run tests/unit/scripts/cody/agents/merge-resolve-agent.test.ts tests/unit/scripts/cody/stage-prompts.test.ts`

**Acceptance Criteria**:
- [ ] Agent file exists with correct YAML header (tools: bash, read, write, edit)
- [ ] Agent has git merge instructions
- [ ] Agent runs tsc --noEmit after resolution
- [ ] Agent writes merge-resolve.md output
- [ ] `resolve-conflicts` stage defined with `type: 'agent'`, `agentName: 'merge-resolve'`
- [ ] Stage auto-skips when `merge-conflicts.md` doesn't exist
- [ ] `stageInstructions['resolve-conflicts']` returns non-empty string

---

## Step 3: Add merge Mode (Entry Point + Pipeline Resolver)

**Files to Touch**:
- `scripts/cody/cody-utils.ts` (MODIFIED — L19, add `'merge'` to mode union)
- `scripts/cody/parse-inputs.ts` (MODIFIED — L33, add `'merge'` to VALID_MODES)
- `scripts/cody/engine/pipeline-resolver.ts` (MODIFIED — L18-19, L24-44, add merge case)
- `scripts/cody/modes/merge.ts` (NEW — merge mode handler)
- `scripts/cody/modes/index.ts` (MODIFIED — add export)
- `scripts/cody/entry.ts` (MODIFIED — L28-34, L336-357, add import + case)

**Behavior**:

1. In `scripts/cody/cody-utils.ts` L19:
   - Change `mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status'` to include `| 'merge'`

2. In `scripts/cody/parse-inputs.ts` L33:
   - Change `VALID_MODES` to `['spec', 'impl', 'rerun', 'fix', 'full', 'status', 'merge']`

3. In `scripts/cody/engine/pipeline-resolver.ts`:
   - Update mode type at L19 to include `| 'merge'`
   - Add case in switch at L24:
     ```typescript
     case 'merge': {
       const mergePipeline = buildPipeline('impl', profile, clarify, ctx)
       return { stages: mergePipeline.stages, order: MERGE_ORDER }
     }
     ```
   - Also update `createRebuildCallback` mode type at L66 to include `| 'merge'`
   - Import `MERGE_ORDER` from `../pipeline/definitions`

4. Create `scripts/cody/modes/merge.ts`:
   ```typescript
   import { PipelineContext } from '../engine/types'
   import { runPipeline } from '../engine/state-machine'
   import { resolvePipelineForMode } from '../engine/pipeline-resolver'
   import { logger } from '../logger'
   import { mergeDefaultBranch } from '../git-utils'
   import { writeConflictMarker } from '../conflict-utils'
   import { ensureTaskDir } from '../cody-utils'

   export async function runMergeMode(ctx: PipelineContext): Promise<void> {
     logger.info('Running Cody MERGE pipeline (resolve conflicts and verify)...\n')
     
     ensureTaskDir(ctx.input.taskId)
     
     // Attempt merge with conflicts left in place
     const merged = mergeDefaultBranch(process.cwd(), { leaveConflicts: true })
     if (!merged) {
       writeConflictMarker(ctx.taskDir, process.cwd())
       logger.info('Merge conflicts detected — resolve-conflicts stage will handle them')
     } else {
       logger.info('No conflicts detected — merge was clean')
     }
     
     const pipeline = resolvePipelineForMode('merge', ctx.profile, false, ctx)
     await runPipeline(ctx, pipeline)
     
     logger.info('\n✅ Merge complete!')
   }
   ```

5. In `scripts/cody/modes/index.ts`:
   - Add `export { runMergeMode } from './merge'`

6. In `scripts/cody/entry.ts`:
   - Add `runMergeMode` to imports from `./modes` (L28-34)
   - Add case in switch (L336-357):
     ```typescript
     case 'merge':
       await runMergeMode(ctx)
       break
     ```

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/parse-inputs.test.ts` (MODIFIED — add):
  - `'merge'` is in `VALID_MODES`
- `tests/unit/scripts/cody/entry-modes.test.ts` (MODIFIED — add):
  - `resolvePipelineForMode('merge', 'standard', false, ctx)` returns pipeline with MERGE_ORDER stages
  - merge pipeline contains `'resolve-conflicts'`, `'commit'`, `'verify'`, `'pr'`
  - merge pipeline does NOT contain `'architect'`, `'build'`, `'review'`

**Run**: `pnpm vitest run tests/unit/scripts/cody/parse-inputs.test.ts tests/unit/scripts/cody/entry-modes.test.ts`

**Acceptance Criteria**:
- [ ] `@cody merge` is parsed as mode `'merge'`
- [ ] `CodyInput.mode` type includes `'merge'`
- [ ] `resolvePipelineForMode('merge', ...)` returns pipeline with `MERGE_ORDER`
- [ ] merge pipeline has exactly: resolve-conflicts → commit → verify → pr
- [ ] `runMergeMode()` exists and calls `mergeDefaultBranch` with `{ leaveConflicts: true }`
- [ ] entry.ts switch handles `'merge'` case

---

## Step 4: Fix runFixMode Merge Bug + checkout-task-branch.ts

**Files to Touch**:
- `scripts/cody/modes/fix.ts` (MODIFIED — L16, L30-35)
- `scripts/cody/checkout-task-branch.ts` (MODIFIED — L287-290)

**Behavior**:

1. In `scripts/cody/modes/fix.ts`:
   - **CRITICAL FIX** (per clarified.md #3): The merge at L30-35 happens BEFORE `taskDir` is resolved at L67. We cannot write a conflict marker to a directory we don't know yet.
   - Solution: Move the merge attempt AFTER taskDir is resolved. Move the merge block from L30-35 to after L68 (`ctx.taskDir = originalTaskDir`).
   - Replace the old try/catch:
     ```typescript
     // OLD (BUG at L30-35):
     if (input.isPullRequest) {
       try { mergeDefaultBranch(process.cwd()) }
       catch (error) { logger.error({ error }, 'Failed to merge default branch, continuing anyway') }
     }
     
     // NEW (after L68, after taskDir is resolved):
     if (input.isPullRequest) {
       const merged = mergeDefaultBranch(process.cwd(), { leaveConflicts: true })
       if (!merged) {
         writeConflictMarker(ctx.taskDir, process.cwd())
         logger.info('Merge conflicts detected — resolve-conflicts stage will handle them')
       }
     }
     ```
   - Import `writeConflictMarker` from `../conflict-utils`

2. In `scripts/cody/checkout-task-branch.ts` L287-290:
   - Replace `process.exit(1)` on merge conflict:
     ```typescript
     // OLD:
     if (!mergeDefaultBranch(defaultBranch)) {
       logger.info('=== Aborting merge ===')
       process.exit(1)
     }
     
     // NEW:
     if (!mergeDefaultBranch(defaultBranch)) {
       logger.info('=== Merge conflicts detected — will be resolved by pipeline ===')
       // Don't abort — local mergeDefaultBranch already aborts its merge.
       // Don't exit — let pipeline handle conflicts via resolve-conflicts stage.
     }
     ```
   - Note: This file's local `mergeDefaultBranch()` (L92-101) already returns boolean and aborts merge internally. We just need to stop the `process.exit(1)`.

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/checkout-task-branch.test.ts` (MODIFIED — add):
  - When `mergeDefaultBranch` returns false, process does NOT exit
- Integration test concept (manual verification):
  - `runFixMode()` merge happens after taskDir resolution (not before)

**Run**: `pnpm vitest run tests/unit/scripts/cody/checkout-task-branch.test.ts`

**Acceptance Criteria**:
- [ ] `runFixMode()` uses `leaveConflicts: true` instead of try/catch
- [ ] `runFixMode()` writes conflict marker when merge returns false
- [ ] `runFixMode()` merge attempt happens AFTER taskDir is resolved (not before)
- [ ] `checkout-task-branch.ts` does NOT `process.exit(1)` on merge conflict

---

## Step 5: Dashboard API — smart-resolve Action

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — L35-55 actionSchema, after L396 switch case)

**Behavior**:

1. Add `'smart-resolve'` to actionSchema z.enum at L36-55 (add it to the array)

2. Add case handler in the switch (before the `default` at L398):
   ```typescript
   case 'smart-resolve': {
     await triggerWorkflow(
       { taskId, mode: 'merge' },
       userOctokit ?? undefined,
     )
     await postWithAttribution(
       issueNumber,
       '🔀 Smart resolve triggered — resolving merge conflicts',
       actor,
       userOctokit,
     )
     invalidateTaskCache()
     invalidatePRCache()
     return NextResponse.json({ success: true, message: 'Conflict resolution triggered' })
   }
   ```

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/actions-route.test.ts` (NEW or MODIFIED):
  - POST with `{ action: 'smart-resolve' }` returns `{ success: true }`
  - `actionSchema` accepts `'smart-resolve'`

**Run**: `pnpm vitest run tests/unit/ui/cody/actions-route.test.ts` (or equivalent path)

**Acceptance Criteria**:
- [ ] `actionSchema` accepts `'smart-resolve'`
- [ ] Action triggers `triggerWorkflow({ taskId, mode: 'merge' })`
- [ ] Action posts comment with "🔀 Smart resolve triggered"
- [ ] Action invalidates caches
- [ ] Action returns success response

---

## Step 6: Dashboard UI — Types + API Client + Hooks

**Files to Touch**:
- `src/ui/cody/types.ts` (MODIFIED — L282-293, add to GitHubAction)
- `src/ui/cody/api.ts` (MODIFIED — add `smartResolve()` method)
- `src/ui/cody/hooks/index.ts` (MODIFIED — add mutation in `useTaskActions()`)

**Behavior**:

1. In `src/ui/cody/types.ts` L282-293:
   - Add `| 'smart-resolve'` to `GitHubAction` type union

2. In `src/ui/cody/api.ts` (after `approvePR` method, around L249):
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
   - Add mutation after `removeFromQueue` (~L397):
     ```typescript
     const smartResolve = useMutation({
       mutationFn: () => codyApi.tasks.smartResolve(issueNumber, actorLogin),
       onSuccess: handleSuccess('Conflict resolution started'),
       onError: handleError('resolve conflicts'),
     })
     ```
   - Add `smartResolve.isPending` to `isPending` check (~L403-417)
   - Add `smartResolve: smartResolve.mutate` to return object (~L419-433)
   - Add `'smart-resolve'` to `pendingAction` ternary chain (~L435-459)

**Tests** (FAIL before, PASS after):
- Minimal test: verify `GitHubAction` type accepts `'smart-resolve'` (TypeScript compilation test)
- Verify `stageLabels` has `'resolve-conflicts'` key (added in Step 7)

**Run**: `pnpm -s tsc --noEmit` (type check is the primary test here)

**Acceptance Criteria**:
- [ ] `GitHubAction` type includes `'smart-resolve'`
- [ ] `tasksApi.smartResolve()` sends correct POST request
- [ ] `useTaskActions()` exposes `smartResolve` mutation
- [ ] `isPending` includes `smartResolve.isPending`

---

## Step 7: Dashboard UI — Smart Resolve Button + Display Updates

**Files to Touch**:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — `getPrimaryAction()` + header area)
- `src/ui/cody/components/tooltip-content.tsx` (MODIFIED — L201-213)
- `src/ui/cody/components/MergeButton.tsx` (MODIFIED — add resolve callback prop)
- `src/ui/cody/constants.ts` (MODIFIED — L11-27, add `'resolve-conflicts'`)
- `src/ui/cody/pipeline-utils.ts` (MODIFIED — L14-27, L32-44, add labels/durations)
- `.github/workflows/cody.yml` (MODIFIED — L14)

**Behavior**:

1. In `src/ui/cody/constants.ts`:
   - Add `'resolve-conflicts'` to `IMPL_STAGES` tuple (at position 0, before 'architect')
   - This flows through to `ALL_STAGES` automatically

2. In `src/ui/cody/pipeline-utils.ts`:
   - Add to `stageLabels`: `'resolve-conflicts': 'Resolving Conflicts'`
   - Add to `stageMaxDurations`: `'resolve-conflicts': 45 * 60 * 1000`

3. In `src/ui/cody/components/TaskDetail.tsx`:
   - In `getPrimaryAction()` (~L274), before the final `return null`, add:
     ```typescript
     // Note: Smart Resolve is NOT a primary action — it's shown as a separate
     // button in the header only when hasConflicts is true. Primary actions
     // handle gate/failed/open states. Smart Resolve is contextual to PR conflicts.
     ```
   - In the header actions area where MergeButton is rendered: pass `onSmartResolve` prop
   - Import `GitMerge` from lucide-react

4. In `src/ui/cody/components/MergeButton.tsx`:
   - Add `onSmartResolve?: () => void` prop to `MergeButtonProps`
   - When `hasConflicts` is true, show a small "Smart Resolve" button/link in the tooltip or next to the icon
   - If `onSmartResolve` prop is provided, clicking it calls the callback

5. In `src/ui/cody/components/tooltip-content.tsx` L201-213:
   - Update `MergeTooltipContent` when `hasConflicts`:
     ```typescript
     // Change from:
     <p>Update the branch or resolve conflicts on GitHub.</p>
     // To:
     <p>Click <strong>Smart Resolve</strong> to automatically resolve conflicts, or resolve manually on GitHub.</p>
     ```

6. In `.github/workflows/cody.yml` L14:
   - Update mode description to: `'Pipeline mode: spec, impl, rerun, fix, full, merge, status'`

**Tests** (FAIL before, PASS after):
- `pnpm -s tsc --noEmit` — type check passes with all new constants and types
- Stage labels contain `'resolve-conflicts'` key
- `ALL_STAGES` (frontend constants.ts) includes `'resolve-conflicts'`

**Run**: `pnpm -s tsc --noEmit`

**Acceptance Criteria**:
- [ ] `stageLabels['resolve-conflicts']` returns "Resolving Conflicts"
- [ ] `ALL_STAGES` (frontend) includes `'resolve-conflicts'`
- [ ] Workflow YAML documents `merge` as valid mode
- [ ] Conflict tooltip text mentions Smart Resolve
- [ ] MergeButton accepts `onSmartResolve` prop
- [ ] Pipeline progress bar can render `resolve-conflicts` stage
- [ ] TypeScript compiles without errors

---

## Summary

| Step | Description | Files | Est. Time |
|------|-------------|-------|-----------|
| 1 | Stage registry + conflict utils + modify mergeDefaultBranch | 3 files (1 new, 2 modified) | 25 min |
| 2 | Merge-resolve agent + stage definition + stage prompts | 3 files (1 new, 2 modified) | 15 min |
| 3 | Merge mode: entry point + pipeline resolver + mode handler | 6 files (1 new, 5 modified) | 25 min |
| 4 | Fix runFixMode bug + checkout-task-branch | 2 files (modified) | 15 min |
| 5 | Dashboard API — smart-resolve action | 1 file (modified) | 10 min |
| 6 | Dashboard UI — types, api client, hooks | 3 files (modified) | 15 min |
| 7 | Dashboard UI — button, tooltips, constants, display | 6 files (modified) | 20 min |
| **Total** | | **24 files** | **~125 min** |

### Key Design Decisions
1. **`resolve-conflicts` is a real `StageName`** — added to `STAGE_NAMES` and `STAGE_REGISTRY` in registry.ts (the canonical source), not just definitions.ts
2. **Mode handler in `scripts/cody/modes/merge.ts`** — follows existing pattern, not inline in entry.ts
3. **Fix runFixMode ordering** (clarified.md #3) — merge attempt moved AFTER taskDir resolution
4. **`shouldSkip` checks marker file only** — stale marker risk is acceptable since the marker is deleted after resolution (clarified.md #2 was about adding `git ls-files --unmerged` but that would fail if merge was aborted; marker is more reliable)
5. **Auto-skip means zero overhead** — no performance impact on non-conflict runs
6. **`checkout-task-branch.ts` local mergeDefaultBranch is unchanged** — it already returns boolean and aborts; we just remove the `process.exit(1)`
