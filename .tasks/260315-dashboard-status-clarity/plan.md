# Plan: Dashboard Task Status Clarity

## Research Findings

### File paths verified
- ✅ `src/ui/cody/pipeline-utils.ts` — Contains `stageLabels`, `derivePipelineDisplayState()`, `getTaskSubStatusText()`
- ✅ `src/ui/cody/components/MiniPipelineProgress.tsx` — Renders inline/bar pipeline progress
- ✅ `src/ui/cody/components/CodyStatusBanner.tsx` — Top banner showing current pipeline state
- ✅ `src/ui/cody/components/TaskList.tsx` — Task list with `statusLabel` map
- ✅ `src/ui/cody/components/PipelineStatus.tsx` — Vertical stepper (detail sidebar)
- ✅ `src/ui/cody/components/tooltip-content.tsx` — Tooltip explanations
- ✅ `src/ui/cody/components/FilterBar.tsx` — Status filter dropdown
- ✅ `src/ui/cody/constants.ts` — `COLUMN_DEFS`, `ALL_STAGES`
- ✅ `src/ui/cody/github-client.ts` — `normalizePipelineStatus()` on lines 208-233
- ✅ `tests/unit/ui/cody/pipeline-display-state.test.ts` — Existing tests

### Real GitHub data investigation (critical findings)

Checked actual `status.json` files on branches for 5 issues visible in the screenshot:

| Issue | `pipeline.state` | `pipeline.currentStage` | Actual stages | Dashboard shows |
|-------|------------------|------------------------|---------------|-----------------|
| #838 | `paused` | **null** | taskify:paused | "Gate · Awaiting Analyzing" |
| #835 | `paused` | **null** | taskify:paused | "Risk Gated · Awaiting Analyzing" |
| #824 | `paused` | **null** | taskify✅ gap✅ architect:paused | "Hard Stop · Awaiting Architecting" |
| #839 | `running` | **null** | 8 stages all completed/skipped | "Building · Starting..." |
| #827 | `running` | **null** | taskify:paused architect✅ | "Building · Starting..." |

**Root cause**: `currentStage` is **always null** in real status.json files. The pipeline engine is not writing it.

### Bugs identified

**Bug A — "Awaiting Analyzing" is confusing (label + format)**
- When `pipeline.state === 'paused'` and `currentStage === null`, `derivePipelineDisplayState()` scans stages to find highest non-pending stage → finds `taskify:paused` → resolves label to `stageLabels['taskify'] = 'Analyzing'` → MiniPipelineProgress renders "Awaiting Analyzing"
- "Awaiting Analyzing" is grammatically awkward and unclear
- Fix: (1) Better stage labels, (2) Better gate-paused text format

**Bug B — "Starting..." shown for tasks that are actually done or deep in pipeline**
- When `pipeline.state === 'running'` and `currentStage === null`, `derivePipelineDisplayState()` returns `{kind: 'starting'}` regardless of stage completion data
- #839 has 8 stages done but shows "Starting..."
- #827 has architect done but shows "Starting..."
- Fix: When `currentStage` is null but stages have data, derive the current stage from stage data

**Bug C — `normalizePipelineStatus` in github-client.ts should fix `currentStage: null`**
- `normalizePipelineStatus()` (line 208) already tries to derive `currentStage` from stages data, but only for `running` state, and it looks for `state === 'running'` entries in stages — but the real data has stages that are 'completed'/'paused', not 'running'
- Fix: Improve the heuristic to find the current stage from completed stages too

**Bug D — Duplicate status display for active tasks**
- Each active task (building/retrying/gate-waiting) renders `MiniPipelineProgress` **twice**:
  1. `variant="inline"` in the metadata row (line 314) — shows dots + text label like "⏸ Awaiting Analyzing"
  2. `variant="bar"` in a dedicated progress row below (line 484) — shows bigger dots + **same text** + elapsed time
- This is visually redundant and noisy — the same "Awaiting Analyzing" appears twice per task
- Fix: Remove the text label from the inline variant (keep only dots), since the bar row has the full text

### Patterns observed
- `stageLabels` is a flat `Record<string, string>` in pipeline-utils.ts (line 14-27)
- Gate-paused text rendered in MiniPipelineProgress inline (line 90): `"Awaiting {displayState.label}"`
- Gate-paused text rendered in MiniPipelineProgress bar (line 163): `"Awaiting {displayState.label}"`
- `normalizePipelineStatus` in github-client.ts (line 208) is the only place that tries to fix missing `currentStage`
- TaskList renders both `variant="inline"` (line 314, in metadata) and `variant="bar"` (line 484, separate row) for all active tasks

### Integration points
- `stageLabels` imported by: `CodyStatusBanner.tsx`, `PipelineStatus.tsx`
- `normalizePipelineStatus` is internal to `github-client.ts`, called when reading status.json from branches
- `derivePipelineDisplayState` called by `MiniPipelineProgress` and `getTaskSubStatusText`
- The bar variant is only shown on `sm:` screens (hidden on mobile), but the inline variant is always shown

## Reuse Inventory
- Reuse `derivePipelineDisplayState()` from `src/ui/cody/pipeline-utils.ts` — modify logic
- Reuse `normalizePipelineStatus()` from `src/ui/cody/github-client.ts` — improve heuristic
- Reuse `ALL_STAGES` from `src/ui/cody/constants.ts` — for stage ordering
- Reuse test helpers from `tests/unit/ui/cody/pipeline-display-state.test.ts`
- No new utilities needed

---

## Step 1: Fix `normalizePipelineStatus` to derive `currentStage` from stage data (Bug C)

**Root Cause**: `normalizePipelineStatus()` in `github-client.ts` only looks for stages with `state === 'running'` or `state === 'paused'`, but real data has `currentStage: null` with stages that are `completed`/`paused`/`pending`. It never derives the actual position from completed stages.

**Files to Touch:**
- `src/ui/cody/github-client.ts` (MODIFIED — lines 208-233, `normalizePipelineStatus`)

**Behavior:**
Improve `normalizePipelineStatus` to derive `currentStage` when it's null:

1. If any stage has `state === 'running'` → that's `currentStage` (existing logic, works)
2. If pipeline is `paused`, find the stage with `state === 'paused'` → that's `currentStage` (existing logic for paused, may need fixing)
3. **NEW**: If `currentStage` is still null and stages have data, find the *first stage in `ALL_STAGES` order that is NOT completed/skipped* → that's the current stage (it's the next one to run or is currently active)
4. **NEW**: If ALL stages are completed/skipped but `state === 'running'` → set `currentStage` to the last completed stage (stale status — pipeline probably finished)

This normalizes the data before it reaches the dashboard, fixing **all downstream display issues**.

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/ui/cody/pipeline-normalize.test.ts` (NEW)
- Test: `normalizePipelineStatus with null currentStage and paused taskify stage should set currentStage to taskify`
  - Input: `{ state: 'paused', currentStage: null, stages: { taskify: { state: 'paused' } } }`
  - Expected: `currentStage === 'taskify'`
  - Why it fails: Current code only checks for `'running'` entries when pipeline state is not `'paused'`, misses paused stages
- Test: `normalizePipelineStatus with null currentStage and multiple completed stages should set currentStage to first non-completed`
  - Input: `{ state: 'running', currentStage: null, stages: { taskify: { state: 'completed' }, gap: { state: 'completed' }, architect: { state: 'completed' }, build: { state: 'pending' } } }`
  - Expected: `currentStage === 'build'` (first pending stage after completed ones)
  - Why it fails: Current code only looks for `'running'` stage entries, returns null when none found
- Test: `normalizePipelineStatus with null currentStage and ALL stages completed should set currentStage to last completed`
  - Input: `{ state: 'running', currentStage: null, stages: { taskify: completed, gap: completed, ..., review: completed } }`
  - Expected: `currentStage === last completed stage name`
  - Why it fails: Falls through all checks, returns null

**Acceptance Criteria:**
- [ ] `normalizePipelineStatus` always returns a non-null `currentStage` when stages data is present
- [ ] Paused pipeline with `taskify: paused` → `currentStage = 'taskify'`
- [ ] Running pipeline with completed stages → `currentStage` = first non-completed stage or last completed
- [ ] New tests pass

---

## Step 2: Fix `derivePipelineDisplayState` for running + no currentStage (Bug B)

**Root Cause**: When `pipeline.state === 'running'` and `currentStage === null`, the function returns `{kind: 'starting'}` even when stages have extensive completion data (e.g., 8/12 stages done). After Step 1, `normalizePipelineStatus` should fix most cases, but `derivePipelineDisplayState` should also be defensive.

**Files to Touch:**
- `src/ui/cody/pipeline-utils.ts` (MODIFIED — lines 246-250, Case 3 in `derivePipelineDisplayState`)

**Behavior:**
In Case 3 (running, no currentStage), before returning `'starting'`, check if stages have data:
1. If stages exist, find the first non-completed/non-skipped stage in `ALL_STAGES` order → use as current stage → return `'stage-progress'`
2. If all stages are completed/skipped → return `'stage-progress'` with last completed stage (pipeline is finishing up)
3. Only return `'starting'` if stages object is empty or has no entries

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/ui/cody/pipeline-display-state.test.ts` (MODIFIED)
- Test: `derivePipelineDisplayState returns stage-progress (not starting) when running with null currentStage but stages have data`
  - Input: `makeTask({ pipeline: makePipeline({ state: 'running', currentStage: null, stages: { taskify: { state: 'completed', retries: 0 }, gap: { state: 'completed', retries: 0 }, architect: { state: 'completed', retries: 0 }, build: { state: 'running', retries: 0 } } }) })`
  - Expected: `kind === 'stage-progress'`, `label === 'Building'`
  - Why it fails: Current code returns `{kind: 'starting'}` because `currentStage` is null
- Test: `derivePipelineDisplayState returns stage-progress when all stages completed but state is still running`
  - Input: task with 8 completed stages, state: running, currentStage: null
  - Expected: `kind === 'stage-progress'` with last completed stage
  - Why it fails: Returns `{kind: 'starting'}`

**Acceptance Criteria:**
- [ ] Task #839 scenario (8 stages done, running, no currentStage) → shows actual stage progress, not "Starting..."
- [ ] Task #827 scenario (mixed states, running, no currentStage) → shows actual position
- [ ] Empty stages + running + no currentStage → still shows "Starting..."
- [ ] Existing tests still pass

---

## Step 3: Improve stage labels and gate-paused text format (Bug A)

**Files to Touch:**
- `src/ui/cody/pipeline-utils.ts` (MODIFIED — lines 14-27, stageLabels; lines 272-274, getTaskSubStatusText)
- `src/ui/cody/components/MiniPipelineProgress.tsx` (MODIFIED — lines 88-92, 160-165)

**Behavior:**

### 3a: Update `stageLabels` for clarity

| Stage | Old Label | New Label |
|-------|-----------|-----------|
| taskify | Analyzing | Classifying |
| gap | Gap Analysis | Checking Gaps |
| clarify | Clarifying | Clarifying |
| architect | Architecting | Planning |
| plan-gap | Reviewing Plan | Reviewing Plan |
| build | Building | Building |
| commit | Committing | Committing |
| review | Reviewing | Reviewing |
| fix | Fixing | Fixing |
| verify | Verifying | Verifying |
| pr | Creating PR | Creating PR |
| autofix | Auto-fixing | Auto-fixing |

Key change: `taskify → 'Classifying'` eliminates "Awaiting Analyzing". `architect → 'Planning'` is shorter and clearer.

### 3b: Change gate-paused text format

**MiniPipelineProgress InlineVariant** (line 90):
- Old: `"Awaiting {displayState.label}"` → e.g. "Awaiting Analyzing"
- New: `"Paused · {displayState.label}"` → e.g. "Paused · Classifying"

**MiniPipelineProgress BarVariant** (line 163):
- Old: `"Awaiting {displayState.label}"` → e.g. "Awaiting Analyzing"
- New: `"Paused · {displayState.label}"` → e.g. "Paused · Classifying"

**getTaskSubStatusText** (line 274):
- Old: `"Awaiting approval${state.label ? \` at ${state.label}\` : ''}"`
- New: `"Paused · ${state.label}"`

This produces clear, grammatically correct status text:
- "Paused · Classifying" (was "Awaiting Analyzing")
- "Paused · Planning" (was "Awaiting Architecting")

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/ui/cody/pipeline-display-state.test.ts` (MODIFIED)
- Update existing test: `'formats gate-paused with stage name'` — old assertion: `'Awaiting approval at Architecting'` → new: `'Paused · Planning'`
- Update existing test: `'formats stage-progress as "Label · N/12"'` — assertion for `build` stage label stays `'Building'` (unchanged)
- New test: `'getTaskSubStatusText for gate-paused at taskify shows "Paused · Classifying"'`
  - Input: task with paused pipeline at taskify
  - Expected: `'Paused · Classifying'`
  - Why it fails: Current code produces `'Awaiting approval at Analyzing'`

**Acceptance Criteria:**
- [ ] No "Awaiting Analyzing" text anywhere in the codebase
- [ ] Gate-paused tasks show "Paused · {Stage}" format
- [ ] Stage labels are clear and grammatically correct
- [ ] Updated test assertions pass

---

## Step 4: Remove duplicate status text from inline variant (Bug D)

**Root Cause**: For every active task, `TaskList.tsx` renders `MiniPipelineProgress` **twice** — once as `variant="inline"` in the metadata row (line 314) and once as `variant="bar"` in a dedicated progress row below (line 484). Both display dots AND text labels (e.g., "⏸ Awaiting Analyzing"), causing the same status to appear twice per task.

**Files to Touch:**
- `src/ui/cody/components/MiniPipelineProgress.tsx` (MODIFIED — InlineVariant function, lines 65-112)

**Behavior:**
Simplify the inline variant to show **only dots** (no text label), since the bar row already has the full label + elapsed time. The inline dots serve as a compact progress indicator in the metadata line; the full text lives in the bar below.

Specifically for each case in InlineVariant:
- `stage-progress`: Keep `StageDots`, **remove** the text span with `{displayState.label}`
- `gate-paused`: Keep `StageDots`, keep `Pause` icon (as visual indicator), **remove** the `"Awaiting {displayState.label}"` text span
- `starting`: Keep `Loader2` spinner, **remove** `"Starting"` text
- `no-data`: Keep `Loader2` spinner, **remove** `"Queued"/"Running"` text

The bar variant (shown on `sm:` and above, in the dedicated row) keeps all text.

On mobile (where bar is `hidden`), the inline dots + status icon column label (e.g., "Building", "Needs Approval") already communicate state without the redundant inline text.

**Tests:**
- This is a visual/layout change — no unit test needed. Visual verification: each task card should show status text **once** (in the bar row), not twice.

**Acceptance Criteria:**
- [ ] Active tasks show status text only once (in the bar progress row)
- [ ] Inline dots remain as a compact progress indicator in metadata row
- [ ] Mobile view still communicates state via status icon + column label
- [ ] No regression in bar variant display

---

## Step 5: Update column labels, tooltips, and filter text for consistency

**Files to Touch:**
- `src/ui/cody/components/TaskList.tsx` (MODIFIED — line 118, statusLabel)
- `src/ui/cody/components/tooltip-content.tsx` (MODIFIED — lines 33-37)
- `src/ui/cody/components/FilterBar.tsx` (MODIFIED — line 34)
- `src/ui/cody/constants.ts` (MODIFIED — line 52)
- `src/ui/cody/components/CodyStatusBanner.tsx` (MODIFIED — lines 222-223)

**Behavior:**

Update "Gate Waiting" / "Gate" labels everywhere to "Needs Approval":

| Location | Old | New |
|----------|-----|-----|
| `TaskList.statusLabel['gate-waiting']` | `'Gate'` | `'Needs Approval'` |
| `COLUMN_DEFS['gate-waiting'].label` | `'Gate Waiting'` | `'Needs Approval'` |
| `FilterBar STATUS_FILTERS` | `'Gate Waiting'` | `'Needs Approval'` |
| `tooltip-content statusExplanations['gate-waiting'].title` | `'Gate Waiting'` | `'Needs Approval'` |
| `tooltip-content statusExplanations['gate-waiting'].description` | `'Pipeline paused at a quality gate awaiting approval.'` | `'Pipeline paused — your approval is needed before Cody continues.'` |
| `CodyStatusBanner gate-waiting text` | `'Waiting for approval'` | `'Approval needed'` |

**Tests:**
- Test location: `tests/unit/ui/cody/dashboard-status-labels.test.ts` (NEW)
- Test: Import `COLUMN_DEFS` and verify `COLUMN_DEFS['gate-waiting'].label === 'Needs Approval'`
- Test: Import `stageLabels` and verify `stageLabels.taskify !== 'Analyzing'`
- Test: Verify `getTaskSubStatusText` never produces "Awaiting Analyzing" for any gate-paused scenario

**Acceptance Criteria:**
- [ ] "Gate Waiting" / "Gate" replaced with "Needs Approval" in all UI text
- [ ] Tooltip explains clearly what approval means
- [ ] Banner text is actionable ("Approval needed")
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

## Step 6: Run quality gates and verify

**Files to Touch:** None (verification only)

**Commands:**
```bash
pnpm tsc --noEmit
pnpm vitest run tests/unit/ui/cody/
pnpm lint
```

**Acceptance Criteria:**
- [ ] TypeScript compilation succeeds
- [ ] All unit tests pass
- [ ] Lint passes
- [ ] `grep -r "Awaiting Analyzing" src/` returns no results
- [ ] `grep -r "Gate Waiting" src/` returns no results (except type definitions)
- [ ] Each active task shows status text only once (visual check)
