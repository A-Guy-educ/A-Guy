# GSD Integration Plan v3 — Replace Cody Orchestration Internals

## Rerun Context

**Updated from v2 based on code-review subagent findings (11 issues)**. Key changes:

1. **🚨 CRITICAL FIX**: Added Phase 6.3 — `gate-handler.ts` line 31 hardcodes `def.name === 'architect'`, must update to `'gsd-plan'`
2. **Added**: `NON_SKIPPABLE_STAGES` / `SKIPPABLE_STAGES` update in Phase 3.1
3. **Added**: `validators.ts` — reassign `createPlanGapValidator` or remove in Phase 3.2
4. **Added**: `taskify.md` — update stage name references in Phase 5.3 (new step)
5. **Added**: `.planning/` to `.gitignore` in Phase 6.4 (new step)
6. **Added**: `src/ui/cody/types.ts` comment update in Phase 7.1
7. **Expanded**: Phase 9 test list — 6 additional test files identified
8. **Added**: `resolveStage()` helper in `rerun-utils.ts` for centralized alias resolution (review suggestion)
9. **Added**: Feature flag consideration documented in Assumptions
10. **Updated**: Time estimate from 2.5h to 4-5h

---

## Overview

Replace Cody's `architect → plan-gap → build` stages with GSD's `gsd-research → gsd-plan → gsd-execute` pipeline, using the **complexity score** to control which GSD sub-workflows activate.

### Architecture

```
CODY  (CI trigger, GitHub API, dashboard, status tracking)
  ↓ invokes
GSD   (research, planning, checker loop, wave execution)
  ↓ spawns agents via
OpenCode  (LLM agent runtime, tool use, MCP)
```

### Complexity-Driven GSD Workflow Control

| Complexity | Tier         | GSD Behavior | Config |
|------------|-------------|--------------|--------|
| 1-9        | trivial     | **No GSD** — direct build (current behavior) | N/A |
| 10-19      | simple      | **gsd-plan only** — skip research, skip checker, skip Nyquist | `research: false, plan_check: false, nyquist_validation: false` |
| 20-34      | moderate    | **gsd-plan + checker** — skip research, skip Nyquist | `research: false, nyquist_validation: false` |
| 35-49      | complex     | **Full GSD** — research + plan + checker + Nyquist | all enabled |
| 50+        | very_complex| **Full GSD + quality model profile** | all enabled, `model_profile: 'quality'` |

### Key Spike Test Findings

1. ✅ **GSD commands work programmatically** — `opencode run --command gsd-health` works
2. ✅ **GSD agents work** — `opencode run --agent gsd-planner` works
3. ✅ **Must clear env vars** — `OPENCODE=`, `OPENCODE_PID=`, `OPENCODE_SERVER_PASSWORD=` must be cleared when spawning from within OpenCode
4. ✅ **Yolo mode works** — `mode: "yolo"` + `workflow.auto_advance: true` = no interactive prompts
5. ⚠️ **Git commit conflict** — GSD executor does per-task `git commit`. Must disable in executor prompt — Cody handles commits.

---

## Phase 1: GSD Config Bridge (~20 min)

### Step 1.1: Create `gsd-bridge.ts` — complexity-to-GSD-config mapper

**Files to Touch**:
- `scripts/cody/gsd-bridge.ts` (NEW)

**Behavior**:
- Export `resolveGsdConfig(complexity: number): GsdConfig` — maps complexity score to GSD workflow config
- Export `writeGsdConfig(projectRoot: string, config: GsdConfig): void` — writes `.planning/config.json`
- Export `cleanGsdState(projectRoot: string): void` — removes `.planning/` between runs
- Export `prepareGsdEnvironment(projectRoot: string, complexity: number): GsdConfig` — convenience combo

**Exact logic**:
```typescript
interface GsdConfig {
  mode: 'yolo'
  commit_docs: false
  model_profile: 'balanced' | 'quality'
  workflow: {
    research: boolean
    plan_check: boolean
    nyquist_validation: boolean
    auto_advance: true
    _auto_chain_active: true
  }
}

function resolveGsdConfig(complexity: number): GsdConfig {
  return {
    mode: 'yolo',
    commit_docs: false,
    model_profile: complexity >= 50 ? 'quality' : 'balanced',
    workflow: {
      research: complexity >= 35,
      plan_check: complexity >= 20,
      nyquist_validation: complexity >= 35,
      auto_advance: true,
      _auto_chain_active: true,
    },
  }
}
```

**Tests** (`tests/unit/scripts/cody/gsd-bridge.test.ts`):
- `resolveGsdConfig(5)` → `{ research: false, plan_check: false, nyquist_validation: false }`
- `resolveGsdConfig(25)` → `{ research: false, plan_check: true, nyquist_validation: false }`
- `resolveGsdConfig(40)` → `{ research: true, plan_check: true, nyquist_validation: true }`
- `resolveGsdConfig(70)` → `{ model_profile: 'quality', research: true, ... }`
- `writeGsdConfig()` creates `.planning/config.json` with valid JSON
- `cleanGsdState()` removes `.planning/` directory
- `prepareGsdEnvironment()` does clean + write in one call
- All configs have `mode: 'yolo'`, `commit_docs: false`
- **Boundary tests**: exact values at 9, 10, 19, 20, 34, 35, 49, 50

**Acceptance Criteria**:
- [ ] Correct config for each tier boundary (9, 10, 19, 20, 34, 35, 49, 50)
- [ ] `writeGsdConfig` creates `.planning/config.json`
- [ ] `cleanGsdState` removes `.planning/`
- [ ] `commit_docs` always false
- [ ] `mode` always `'yolo'`

---

## Phase 2: Modify Executor Agent Prompt — Disable Git Commits (~10 min)

### Step 2.1: Create local gsd-executor override

**Files to Touch**:
- `.opencode/agents/gsd-executor.md` (NEW — local override of global `~/.config/opencode/agents/gsd-executor.md`)

**Behavior**:
- Copy the global executor agent, but:
  - Remove `<task_commit_protocol>` section (lines 316-347 in global)
  - Remove `<final_commit>` section (lines 456-462 in global)
  - Remove `<self_check>` git commit verification (lines 384-400)
  - Remove `<state_updates>` GSD state management (lines 402-454) — Cody manages state
  - Add explicit: "Do NOT make git commits. Do NOT run `git add` or `git commit`. All version control is handled by the external Cody pipeline."
  - Keep: `<execution_flow>`, `<deviation_rules>`, `<tdd_execution>`, `<checkpoint_protocol>`, `<summary_creation>`, `<analysis_paralysis_guard>`, `<completion_format>`

**Tests** (`tests/unit/scripts/cody/gsd-executor-prompt.test.ts`):
- Read `.opencode/agents/gsd-executor.md`, assert no `git commit` or `git add` instructions
- Assert it contains "Do NOT make git commits"
- Assert it contains `<execution_flow>` and `<deviation_rules>` (sanity check)

**Acceptance Criteria**:
- [ ] Local `.opencode/agents/gsd-executor.md` exists
- [ ] No `git commit` or `git add` instructions
- [ ] Contains explicit "do not commit" instruction
- [ ] Deviation rules, TDD, checkpoints, summary creation preserved

---

## Phase 3: Pipeline Definitions — Replace architect/plan-gap/build (~30 min)

### Step 3.1: Add GSD entries to complexity thresholds, timeouts, output map, and skippability constants

**Files to Touch**:
- `scripts/cody/pipeline-utils.ts` (MODIFIED)
  - `STAGE_COMPLEXITY_THRESHOLDS` (~line 67): Replace `architect: 10` with `'gsd-plan': 10`, `'plan-gap': 40` with `'gsd-research': 35`, `build: 0` with `'gsd-execute': 0`. Remove old `architect`, `plan-gap`, `build` entries.
  - `STAGE_OUTPUT_MAP` (~line 766): add `'gsd-plan': 'plan.md'`, `'gsd-execute': 'build.md'`, `'gsd-research': 'gsd-research.md'`
  - `IMPL_PIPELINE` (~line 877): replace `['architect', 'plan-gap', 'build', ...]` with `['gsd-research', 'gsd-plan', 'gsd-execute', ...]`
  - `LIGHTWEIGHT_IMPL_PIPELINE` (~line 904): replace `['architect', 'build', ...]` with `['gsd-plan', 'gsd-execute', ...]`
  - `DRY_RUN_OUTPUTS` (~line 790): add entries for `'gsd-research'`, `'gsd-plan'`, `'gsd-execute'`; keep `architect`/`build` entries for backward compat
  - **🆕 `NON_SKIPPABLE_STAGES` (~line 36)**: Replace `'plan-gap', 'build'` with `'gsd-execute'`. New value: `['gap', 'gsd-execute', 'commit', 'verify', 'pr']`
  - **🆕 `SKIPPABLE_STAGES` (~line 39)**: Replace `'architect'` with `'gsd-plan', 'gsd-research'`. New value: `['spec', 'gsd-plan', 'gsd-research']`
  - Update comments (~lines 59-65) to reference GSD stage names in tier descriptions
- `scripts/cody/agent-runner.ts` (MODIFIED)
  - `STAGE_TIMEOUTS` (~line 41): add `'gsd-research': ms('20m')`, `'gsd-plan': ms('30m')`, `'gsd-execute': ms('45m')`

**Tests** (update `tests/unit/scripts/cody/pipeline-utils.test.ts`):
- `getStagesForComplexity(5)` includes `gsd-execute` but NOT `gsd-research`, `gsd-plan`
- `getStagesForComplexity(15)` includes `gsd-plan`, `gsd-execute` but NOT `gsd-research`
- `getStagesForComplexity(40)` includes all three GSD stages
- `ALL_IMPL_STAGE_NAMES` contains `gsd-research`, `gsd-plan`, `gsd-execute`
- `ALL_IMPL_STAGE_NAMES` does NOT contain `architect`, `plan-gap`, `build`
- `ALL_LIGHTWEIGHT_IMPL_STAGE_NAMES` contains `gsd-plan`, `gsd-execute` but NOT `gsd-research`
- `NON_SKIPPABLE_STAGES` contains `'gsd-execute'`, NOT `'build'` or `'plan-gap'`
- `SKIPPABLE_STAGES` contains `'gsd-plan'`, `'gsd-research'`, NOT `'architect'`

**Acceptance Criteria**:
- [ ] GSD stages in thresholds, timeouts, output map
- [ ] `IMPL_PIPELINE` and `LIGHTWEIGHT_IMPL_PIPELINE` use GSD stages
- [ ] `ALL_IMPL_STAGE_NAMES` derived correctly from updated pipelines
- [ ] `NON_SKIPPABLE_STAGES` updated (no `build`, `plan-gap`)
- [ ] `SKIPPABLE_STAGES` updated (no `architect`)

### Step 3.2: Replace stage definitions in definitions.ts

**Files to Touch**:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED)
  - `IMPL_ORDER_STANDARD` (~line 43): `['gsd-research', 'gsd-plan', 'gsd-execute', 'commit', 'review', 'fix', 'commit-fix', 'verify', 'pr']`
  - `IMPL_ORDER_LIGHTWEIGHT` (~line 54): `['gsd-plan', 'gsd-execute', 'commit', 'review', 'fix', 'commit-fix', 'verify', 'pr']`
  - Replace `stages.set('architect', ...)` with `stages.set('gsd-research', ...)` and `stages.set('gsd-plan', ...)`
  - Replace `stages.set('plan-gap', ...)` and `stages.set('build', ...)` with `stages.set('gsd-execute', ...)`
  - Add import: `import { prepareGsdEnvironment } from '../gsd-bridge'` and `import { logger } from '../logger'`
  - `gsd-research.preExecute`: calls `prepareGsdEnvironment(process.cwd(), complexity)`
  - `gsd-plan.preExecute`: if `.planning/config.json` missing (research was skipped), calls `prepareGsdEnvironment()`
  - `gsd-plan.postActions`: `[{ type: 'archive-rerun-feedback' }, { type: 'check-gate', gate: 'architect', includeArtifact: 'plan.md' }]` (reuse architect gate name)
  - `gsd-execute.preExecute`: same as old build (ensureFeatureBranch + branch name capture)
  - `gsd-execute.postActions`: same as old build (validate-src-changes, validate-build-content, commit-task-files, run-quality-with-autofix)
  - `gsd-execute.validator`: `createBuildValidator()` (reuse)
  - **🆕 `validators.ts` impact**: `createPlanGapValidator()` is no longer referenced by any stage definition since `plan-gap` stage is removed. The function can stay as dead code for now (no test breakage) but should NOT be wired to any GSD stage since GSD handles its own plan validation via the checker loop.

**Tests** (update `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts`):
- `IMPL_ORDER_STANDARD` contains GSD stages, NOT old stages
- `IMPL_ORDER_LIGHTWEIGHT` contains GSD stages, NOT old stages
- `buildPipeline('impl', 'standard', false, ctx)` returns pipeline with GSD stages
- `buildPipeline('impl', 'lightweight', false, ctx)` returns pipeline without `gsd-research`

**Acceptance Criteria**:
- [ ] Old stage definitions (`architect`, `plan-gap`, `build`) removed from `createStageDefinitions()`
- [ ] New GSD stage definitions added with correct skip/timeout/postActions
- [ ] `gsd-plan` has architect gate postAction
- [ ] `gsd-execute` has same preExecute and postActions as old build
- [ ] `.planning/config.json` written in preExecute of first GSD stage
- [ ] `createPlanGapValidator()` NOT wired to any GSD stage (dead code, kept for reference)

---

## Phase 4: Runner Backend — Clear OpenCode Env Vars (~10 min)

### Step 4.1: Fix env var leakage in runner backends

**Files to Touch**:
- `scripts/cody/runner-backend.ts` (MODIFIED — lines 28-68)

**Behavior**:
- Extract helper: `function cleanOpenCodeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv`
- Strips `OPENCODE`, `OPENCODE_PID`, `OPENCODE_SERVER_PASSWORD` from env
- Use in both `GitHubRunner.spawn()` and `LocalRunner.spawn()`

**Tests** (`tests/unit/scripts/cody/runner-backend.test.ts` — UPDATE existing file):
- Mock `spawn`, call `GitHubRunner.spawn()` with env containing the 3 vars
- Assert the spawned process env does NOT contain them
- Same for `LocalRunner.spawn()`
- Assert other env vars (PATH, ANTHROPIC_API_KEY) preserved

**Acceptance Criteria**:
- [ ] 3 env vars stripped from both runners
- [ ] Other env vars preserved
- [ ] Tests verify env cleaning

---

## Phase 5: Stage Prompts & Agent Wrappers (~30 min)

### Step 5.1: Update stage-prompts.ts

**Files to Touch**:
- `scripts/cody/stage-prompts.ts` (MODIFIED)
  - `ALL_STAGES` (~line 29): replace `'architect', 'plan-gap', 'build'` with `'gsd-research', 'gsd-plan', 'gsd-execute'`
  - `STAGE_CONTEXT_FILES` (~line 69): add GSD entries, remove old entries
    ```typescript
    'gsd-research': ['spec.md', 'clarified.md', 'task.json'],
    'gsd-plan': ['spec.md', 'clarified.md', 'task.json'],
    'gsd-execute': ['spec.md', 'clarified.md', 'task.json', 'plan.md'],
    ```
  - `stageInstructions` (~line 108): add entries for GSD stages, remove old
    - `'gsd-research'`: empty (behavioral instructions in agent .md)
    - `'gsd-plan'`: empty
    - `'gsd-execute'`: same critical instruction as old `build` ("IMPLEMENTATION STAGE - NOT DOCUMENTATION")
  - `buildStagePrompt()` (~line 226): update `taskTypeSection` condition from `stage === 'architect' || stage === 'build'` to `stage === 'gsd-plan' || stage === 'gsd-execute'`

**Tests** (update `tests/unit/scripts/cody/stage-prompts.test.ts`):
- `ALL_STAGES` contains GSD stages, NOT old stages
- `STAGE_CONTEXT_FILES['gsd-research']` includes `spec.md`, `clarified.md`
- `STAGE_CONTEXT_FILES['gsd-plan']` includes `task.json`
- `STAGE_CONTEXT_FILES['gsd-execute']` includes `plan.md`
- `stageInstructions['gsd-execute']` contains "IMPLEMENTATION STAGE"
- `buildStagePrompt(input, 'gsd-execute')` includes task type

**Acceptance Criteria**:
- [ ] `ALL_STAGES` updated (no `architect`, `plan-gap`, `build`)
- [ ] Context files mapped correctly for GSD stages
- [ ] `gsd-execute` has build-like instruction
- [ ] Task type section included for `gsd-plan` and `gsd-execute`

### Step 5.2: Create GSD wrapper agent prompts

**Files to Touch**:
- `.opencode/agents/gsd-research.md` (NEW)
- `.opencode/agents/gsd-plan.md` (NEW)
- `.opencode/agents/gsd-execute.md` (NEW)

**Behavior**:
- `gsd-research.md`: Agent that reads spec.md + clarified.md, runs GSD research workflow via `/gsd-plan-phase` command's research sub-steps, writes findings to `.planning/` and `gsd-research.md` in task dir
- `gsd-plan.md`: Agent that reads spec + research output, runs GSD planning, writes `plan.md` to task dir (Cody convention). Invokes GSD planner + checker loop
- `gsd-execute.md`: Agent that reads plan.md, implements code changes. References local `gsd-executor` agent behavior (no commits). Writes `build.md` summary to task dir

Each wrapper reads Cody task context → maps to GSD inputs → invokes GSD → maps output back to Cody artifacts.

**Acceptance Criteria**:
- [ ] Three agent .md files exist in `.opencode/agents/`
- [ ] Each has correct `tools` and `description` frontmatter
- [ ] `gsd-execute.md` explicitly forbids git commits

### Step 5.3: 🆕 Update taskify.md — stage name references

**Files to Touch**:
- `.opencode/agents/taskify.md` (MODIFIED)

**Behavior**:
- **Line 120-121**: `skip_stages` example `["spec", "architect"]` → `["spec", "gsd-plan"]`
  - `detailed_plan` row: "Stages Skipped" column: `spec, architect` → `spec, gsd-plan`
  - `spec_and_plan` row: "Stages Skipped" column: `spec, architect` → `spec, gsd-plan`
- **Line 207**: `skip_stages: ["spec"]` example in pipeline profile section references `architect` in pipeline description → update `architect → build` to `gsd-plan → gsd-execute`
- **Line 230**: "The pipeline will run: taskify → architect → build → commit → verify → pr" → "The pipeline will run: taskify → gsd-plan → gsd-execute → commit → verify → pr"
- **Line 252-257**: Complexity table stage names:
  - "Trivial" → `taskify → gsd-execute → commit → verify → pr`
  - "Simple" → `+ gsd-plan`
  - "Moderate" → `+ gsd-plan, gsd-execute` (already included)
  - "Complex" → `+ spec, gap`
  - "Very Complex" → `+ gsd-research, clarify`
- These are **documentation/prompt changes only** — the actual stage names in the JSON schema (`skip_stages`) must match what the pipeline code validates

**Tests**: No direct test — taskify is an agent prompt, not executable code. However:
- `tests/unit/scripts/cody/zod-task-schema.test.ts` validates that `skip_stages` values are valid stage names. If this test hardcodes `'architect'` as valid, it must be updated to accept `'gsd-plan'` and `'gsd-research'` instead.

**Acceptance Criteria**:
- [ ] `taskify.md` references `gsd-plan`, `gsd-execute`, `gsd-research` instead of old names
- [ ] Pipeline description in lightweight section updated
- [ ] Complexity table stage names updated
- [ ] `skip_stages` examples use new names

---

## Phase 6: OpenCode Config & Hardcoded References (~20 min)

### Step 6.1: Add GSD agents to opencode.json

**Files to Touch**:
- `opencode.json` (MODIFIED)

**Behavior**:
- Add agent entries:
  ```json
  "gsd-research": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "description": "GSD research phase - parallel codebase analysis"
  },
  "gsd-plan": {
    "model": "anthropic/claude-opus-4-6",
    "description": "GSD planning phase - plan creation + checker loop"
  },
  "gsd-execute": {
    "model": "minimax-coding-plan/MiniMax-M2.5",
    "description": "GSD execution phase - implements plan (same model as old build)"
  }
  ```
- Keep old `architect`, `plan-gap`, `build` entries for backward compat (they still exist in STAGE_TIMEOUTS)

**Acceptance Criteria**:
- [ ] All 3 GSD agents registered in `opencode.json`
- [ ] `gsd-plan` uses opus (highest-value stage)
- [ ] `gsd-execute` uses same model as old `build`

### Step 6.2: Update hardcoded stage references across codebase

**Files to Touch**:
- `scripts/cody/entry.ts` (MODIFIED)
  - Line 542: `|| 'build'` → `|| 'gsd-execute'`
  - Line 549: `|| 'build'` → `|| 'gsd-execute'`
  - Line 601: `|| 'build'` → `|| 'gsd-execute'`
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED)
  - Line 456-457: `currentState.stages?.build` and `updateStage(currentState, 'build', ...)` → `currentState.stages?.['gsd-execute']` and `updateStage(currentState, 'gsd-execute', ...)`
  - Line 641: `stage === 'architect' || stage === 'plan-gap'` → `stage === 'gsd-plan' || stage === 'gsd-research'`
- `scripts/cody/pipeline/skip-conditions.ts` (MODIFIED)
  - Line 26: type union `'spec' | 'gap' | 'clarify' | 'architect' | 'plan-gap' | 'build'` → `'spec' | 'gap' | 'clarify' | 'gsd-research' | 'gsd-plan' | 'gsd-execute'`

**Tests**: Covered by existing tests + integration tests in Phase 9

**Acceptance Criteria**:
- [ ] No hardcoded `'build'` fallbacks in entry.ts
- [ ] Post-actions reference new stage names
- [ ] Skip conditions handle GSD stages

### Step 6.3: 🚨 CRITICAL — Fix gate-handler.ts hardcoded 'architect'

**Files to Touch**:
- `scripts/cody/handlers/gate-handler.ts` (MODIFIED — line 31)

**Root Cause**: Line 31 hardcodes `def.name === 'architect' ? 'architect' : 'taskify'`. After the rename, the stage name will be `'gsd-plan'`, so this condition will NEVER match 'architect', causing ALL gsd-plan gates to resolve as `'taskify'` gate instead. This would approve the wrong gate or skip approval entirely.

**Fix**:
```typescript
// OLD (line 31):
const gate = def.name === 'architect' ? 'architect' : 'taskify'

// NEW:
const gate = def.name === 'gsd-plan' ? 'architect' : 'taskify'
// NOTE: gate NAME stays 'architect' (it's a named approval point in GitHub comments)
// but the STAGE that triggers it is now 'gsd-plan'
```

**Tests** (update `tests/unit/scripts/cody/clarify-workflow.test.ts` and `tests/unit/scripts/cody/rerun-gate-approval.test.ts`):
- When `def.name === 'gsd-plan'`, gate resolves to `'architect'`
- When `def.name === 'taskify'`, gate resolves to `'taskify'`
- When `def.name === 'anything-else'`, gate resolves to `'taskify'` (fallback)

**Acceptance Criteria**:
- [ ] `gsd-plan` stage triggers `'architect'` gate
- [ ] `taskify` stage still triggers `'taskify'` gate
- [ ] Gate approval flow works end-to-end for renamed stage

### Step 6.4: 🆕 Add `.planning/` to .gitignore

**Files to Touch**:
- `.gitignore` (MODIFIED — append after line 47)

**Behavior**:
- Add:
  ```
  # GSD planning state (ephemeral, regenerated per run)
  .planning/
  ```

**Acceptance Criteria**:
- [ ] `.planning/` in .gitignore
- [ ] Comment explains purpose

---

## Phase 7: Dashboard Updates (~15 min)

### Step 7.1: Update dashboard stage constants, labels, and types

**Files to Touch**:
- `src/ui/cody/constants.ts` (MODIFIED — lines 10-18)
  - `IMPL_STAGES`: replace `['architect', 'plan-review', 'build', 'commit', 'verify', 'pr']` with `['gsd-research', 'gsd-plan', 'gsd-execute', 'commit', 'review', 'fix', 'commit-fix', 'verify', 'pr']`
- `src/ui/cody/pipeline-utils.ts` (MODIFIED — lines 14-41)
  - Add labels: `'gsd-research': 'Researching'`, `'gsd-plan': 'Planning'`, `'gsd-execute': 'Executing'`
  - Add durations: `'gsd-research': 20 * 60 * 1000`, `'gsd-plan': 30 * 60 * 1000`, `'gsd-execute': 45 * 60 * 1000`
  - Keep old labels/durations for backward compat (dashboard may show historical data)
- **🆕 `src/ui/cody/types.ts` (MODIFIED — line 217)**
  - Update comment from `'taskify' | 'architect'` to `'taskify' | 'gsd-plan'`

**Tests**: Visual verification + existing dashboard renders without crash

**Acceptance Criteria**:
- [ ] Dashboard IMPL_STAGES updated
- [ ] Labels are human-readable
- [ ] Max durations set
- [ ] Old pipelines still render (graceful fallback for unknown stages already works)
- [ ] Types comment updated

---

## Phase 8: Rerun Support & Stage Aliases (~15 min)

### Step 8.1: Update rerun-utils.ts with GSD stage names and centralized alias resolution

**Files to Touch**:
- `scripts/cody/rerun-utils.ts` (MODIFIED)

**Behavior**:
- `resolveRerunFromStage()` currently hardcodes `'architect'` and `'plan-gap'`:
  - Line 26: `implStages.indexOf('architect')` → `implStages.indexOf('gsd-plan')`
  - Line 34: `implStages.indexOf('plan-gap')` → needs rethinking: threshold becomes `gsd-plan` index (since gsd-plan replaces both architect and plan-gap)
  - Line 38: `return 'architect'` → `return 'gsd-plan'`
- Add `STAGE_ALIASES` at top:
  ```typescript
  export const STAGE_ALIASES: Record<string, string> = {
    architect: 'gsd-plan',
    'plan-gap': 'gsd-plan',
    build: 'gsd-execute',
  }
  ```
- Add `resolveStageAlias(stage: string): string` — **centralized mapping function** (review suggestion). All other files that need to resolve old → new stage names should import and use this.
  ```typescript
  export function resolveStageAlias(stage: string): string {
    return STAGE_ALIASES[stage] ?? stage
  }
  ```
- Apply alias resolution at the START of `resolveRerunFromStage()` for `fromStage`

**Tests** (update existing `tests/unit/scripts/cody/rerun-utils.test.ts` or new file):
- `resolveStageAlias('architect')` → `'gsd-plan'`
- `resolveStageAlias('build')` → `'gsd-execute'`
- `resolveStageAlias('plan-gap')` → `'gsd-plan'`
- `resolveStageAlias('gsd-plan')` → `'gsd-plan'` (passthrough)
- `resolveStageAlias('commit')` → `'commit'` (passthrough)
- `resolveRerunFromStage('build', feedback, implStages)` backs up to `'gsd-plan'`
- `resolveRerunFromStage('gsd-execute', feedback, implStages)` backs up to `'gsd-plan'`
- `resolveRerunFromStage('gsd-plan', feedback, implStages)` stays at `'gsd-plan'`

**Acceptance Criteria**:
- [ ] Old stage names work as aliases
- [ ] New stage names work directly
- [ ] Feedback routing backs up to `gsd-plan` (not `architect`)
- [ ] `resolveStageAlias()` exported for reuse in other files

---

## Phase 9: Tests & Quality Gates (~30 min)

### Step 9.1: Run and fix ALL existing tests

**Files to Touch** (MODIFIED — update expectations from old to new stage names):
- `tests/unit/scripts/cody/pipeline-utils.test.ts` — Stage name expectations throughout
- `tests/unit/scripts/cody/stage-prompts.test.ts` — ALL_STAGES expectations
- `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` — Pipeline expectations
- `tests/unit/scripts/cody/parse-inputs.test.ts` — CHECK for stage references, update if found
- **🆕 `tests/unit/scripts/cody/rerun-feedback-routing.test.ts`** — Hardcodes old stage names
- **🆕 `tests/unit/scripts/cody/rerun-gate-approval.test.ts`** — Hardcodes `'architect'` gate tests
- **🆕 `tests/unit/scripts/cody/complexity-scoring.test.ts`** — 46 matches with old names (stage name strings in complexity tier assertions)
- **🆕 `tests/unit/scripts/cody/clarify-workflow.test.ts`** — Tests architect gate flow
- **🆕 `tests/unit/scripts/cody/zod-task-schema.test.ts`** — `skip_stages` validation with old names
- **🆕 `tests/unit/scripts/cody/post-actions.test.ts`** — `architect`/`plan-gap`/`build` references

**Behavior**:
- Run `pnpm -s tsc --noEmit` — fix any type errors
- Run `pnpm -s test:unit` — fix any failing tests (mostly updating assertions from old to new stage names)
- Run `pnpm -s lint` — fix any lint issues
- For `complexity-scoring.test.ts`: The complexity thresholds table changed. Update the expected stage lists. E.g., `expect(getStagesForComplexity(15)).toContain('architect')` → `expect(getStagesForComplexity(15)).toContain('gsd-plan')`
- For `zod-task-schema.test.ts`: If the Zod schema validates `skip_stages` against a list of valid names, update that list from `['spec', 'architect']` to `['spec', 'gsd-plan', 'gsd-research']`

### Step 9.2: Add new GSD integration tests

**Files to Touch**:
- `tests/unit/scripts/cody/gsd-bridge.test.ts` (NEW)
- `tests/unit/scripts/cody/gsd-executor-prompt.test.ts` (NEW)

**Tests**:
- Full gsd-bridge coverage (all complexity tiers, file operations)
- Executor prompt validation (no git commits, essential sections present)

**Acceptance Criteria**:
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm -s test:unit` passes
- [ ] `pnpm -s lint` passes
- [ ] New GSD tests pass
- [ ] All 11 review findings addressed

---

## Complete File Change Summary

### NEW files (5):
| File | Purpose |
|------|---------|
| `scripts/cody/gsd-bridge.ts` | Complexity → GSD config mapper |
| `.opencode/agents/gsd-executor.md` | Local executor override (no git commits) |
| `.opencode/agents/gsd-research.md` | Research wrapper agent |
| `.opencode/agents/gsd-plan.md` | Planning wrapper agent |
| `.opencode/agents/gsd-execute.md` | Execution wrapper agent |

### MODIFIED files (15):
| File | What Changes |
|------|-------------|
| `scripts/cody/pipeline-utils.ts` | STAGE_COMPLEXITY_THRESHOLDS, STAGE_OUTPUT_MAP, IMPL_PIPELINE, LIGHTWEIGHT_IMPL_PIPELINE, DRY_RUN_OUTPUTS, NON_SKIPPABLE_STAGES, SKIPPABLE_STAGES |
| `scripts/cody/agent-runner.ts` | STAGE_TIMEOUTS |
| `scripts/cody/pipeline/definitions.ts` | IMPL_ORDER_STANDARD/LIGHTWEIGHT, createStageDefinitions (replace 3 old stages with 3 GSD stages) |
| `scripts/cody/runner-backend.ts` | Clean OPENCODE env vars |
| `scripts/cody/stage-prompts.ts` | ALL_STAGES, STAGE_CONTEXT_FILES, stageInstructions, buildStagePrompt |
| `scripts/cody/rerun-utils.ts` | STAGE_ALIASES, resolveStageAlias(), resolveRerunFromStage (gsd-plan instead of architect) |
| `scripts/cody/entry.ts` | Hardcoded `'build'` fallbacks → `'gsd-execute'` |
| `scripts/cody/pipeline/post-actions.ts` | Stage name references (build→gsd-execute, architect/plan-gap→gsd-plan/gsd-research) |
| `scripts/cody/pipeline/skip-conditions.ts` | Type union update |
| `scripts/cody/handlers/gate-handler.ts` | **🚨 CRITICAL** — `def.name === 'architect'` → `def.name === 'gsd-plan'` |
| `.opencode/agents/taskify.md` | Stage name references in docs/examples |
| `opencode.json` | Add 3 GSD agent entries |
| `src/ui/cody/constants.ts` | IMPL_STAGES |
| `src/ui/cody/pipeline-utils.ts` | stageLabels, stageMaxDurations |
| `src/ui/cody/types.ts` | Comment update (line 217) |
| `.gitignore` | Add `.planning/` |

### NEW test files (2):
| File | Purpose |
|------|---------|
| `tests/unit/scripts/cody/gsd-bridge.test.ts` | GSD config bridge tests |
| `tests/unit/scripts/cody/gsd-executor-prompt.test.ts` | Executor prompt validation |

### MODIFIED test files (~11):
| File | What Changes |
|------|-------------|
| `tests/unit/scripts/cody/pipeline-utils.test.ts` | Update stage name expectations |
| `tests/unit/scripts/cody/stage-prompts.test.ts` | Update ALL_STAGES expectations |
| `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` | Update pipeline expectations |
| `tests/unit/scripts/cody/parse-inputs.test.ts` | Check/update stage references |
| `tests/unit/scripts/cody/rerun-feedback-routing.test.ts` | Update old stage names |
| `tests/unit/scripts/cody/rerun-gate-approval.test.ts` | Update architect gate tests |
| `tests/unit/scripts/cody/complexity-scoring.test.ts` | Update 46+ stage name references |
| `tests/unit/scripts/cody/clarify-workflow.test.ts` | Update architect gate flow tests |
| `tests/unit/scripts/cody/zod-task-schema.test.ts` | Update skip_stages validation |
| `tests/unit/scripts/cody/post-actions.test.ts` | Update architect/plan-gap/build references |
| `tests/unit/scripts/cody/runner-backend.test.ts` | Add env var cleaning tests |

---

## Review Findings Checklist (all 11 addressed)

| # | Finding | Severity | Where Addressed |
|---|---------|----------|----------------|
| 1 | `gate-handler.ts` line 31 hardcodes `'architect'` | 🚨 Critical | Phase 6.3 |
| 2 | `NON_SKIPPABLE_STAGES` / `SKIPPABLE_STAGES` still reference old names | ❌ Missing | Phase 3.1 |
| 3 | `taskify.md` generates `skip_stages: ["architect"]` | ❌ Missing | Phase 5.3 |
| 4 | 6+ test files not listed | ❌ Missing | Phase 9.1 |
| 5 | `validators.ts` — `createPlanGapValidator` not reassigned | ❌ Missing | Phase 3.2 (kept as dead code) |
| 6 | `buildPromotedStub()` in post-actions.ts needs GSD stage names | ❌ Missing | Phase 6.2 |
| 7 | `.planning/` not in `.gitignore` | ❌ Missing | Phase 6.4 |
| 8 | `src/ui/cody/types.ts` line 217 comment references `'architect'` | ❌ Missing | Phase 7.1 |
| 9 | Create `resolveStage()` mapping function | 💡 Suggestion | Phase 8.1 (`resolveStageAlias()`) |
| 10 | Feature flag (`USE_GSD_PIPELINE`) for safe rollout | 💡 Suggestion | Documented in Assumptions |
| 11 | Time estimate 4-5h (not 2.5h) | 💡 Suggestion | Updated |

---

## Assumptions

1. GSD commands installed globally at `~/.config/opencode/` (already done)
2. `.planning/` directory lives in project root (not inside `.tasks/`)
3. `gsd-plan` stage reuses the existing `architect` approval gate name (gate is a named approval point, stage name changes but gate name stays `'architect'`)
4. Review/fix/commit-fix stages from dev branch are included in the orders
5. The DeepSeek balance issue won't affect CI (different API keys)
6. GSD's `gsd-tools.cjs` binary is available in CI via global install
7. `.planning/` cleanup between runs handled by `prepareGsdEnvironment()` in preExecute
8. `gsd-execute` uses same model as old `build` (MiniMax) to keep cost same for execution
9. Gate name stays `'architect'` even though stage is now `'gsd-plan'` (gate is a named approval point, not a stage)
10. **Feature flag**: A `USE_GSD_PIPELINE` env var feature flag was considered (review suggestion) but deemed unnecessary for v1 since this is behind a feature branch and the changes are all-or-nothing (no partial migration path makes sense). Can be added in a follow-up if needed.
11. `createPlanGapValidator()` in `validators.ts` becomes dead code — kept for reference but not wired to any GSD stage since GSD handles its own plan validation via the checker loop.
12. The `SKIPPABLE_STAGES` constant in `pipeline-utils.ts` is used by `taskify.md` prompt to inform what stages can be skipped. `gsd-research` and `gsd-plan` should be skippable (high-quality input can bypass them), `gsd-execute` should NOT be skippable (code must always be written).

## Estimated Time: 4-5 hours

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| GSD executor commits code | Local agent override removes commit instructions (Phase 2) |
| `.planning/` pollution between tasks | `cleanGsdState()` in preExecute (Phase 1) |
| `opencode run` "Session not found" | Clear OPENCODE env vars in runner (Phase 4) |
| API cost increase | Complexity-driven config disables research/checker for simple tasks (Phase 1) |
| Old `--from architect` commands break | Stage aliases provide backward compat (Phase 8) |
| Dashboard shows stale stage names | Dashboard update replaces old with new (Phase 7) |
| Post-actions reference old stage names | Updated in Phase 6.2 |
| `entry.ts` hardcoded `'build'` fallback | Updated in Phase 6.2 |
| `rerun-utils.ts` hardcoded `'architect'` | Updated in Phase 8 |
| **🚨 Gate handler routes to wrong gate** | **Fixed in Phase 6.3** |
| **`NON_SKIPPABLE_STAGES` stale** | **Fixed in Phase 3.1** |
| **`taskify.md` generates invalid skip_stages** | **Fixed in Phase 5.3** |
| **`.planning/` committed to git** | **Fixed in Phase 6.4** |
