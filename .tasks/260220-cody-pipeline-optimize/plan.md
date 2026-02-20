# Plan: 260220-cody-pipeline-optimize

## Overview

Optimize the Cody pipeline by removing waste, automating what's manual, and shifting test-writing into the build agent via a TDD subagent.

**Current pipeline** (12 stages):
```
taskify → spec → clarify → architect → plan-review → build → commit → test → verify → autofix → auditor → pr
```

**Target pipeline** (10 stages, but faster/smarter):
```
taskify → spec → [clarify: opt-in] → architect → plan-review(→loops back) → build(+TDD subagent) → commit(scripted) → verify → autofix(conditional) → [auditor → apply-audit, pr] (parallel) 
```

**Changes summary:**
1. Clarify becomes opt-in via `--clarify` flag (default: skip)
2. Auditor output auto-applied by new `apply-audit` agent stage
3. Build agent invokes `test-writer` subagent for TDD
4. Plan-review loops feedback back to architect (keep current behavior)
5. Commit becomes a scripted stage via `git-utils.ts` (no LLM)
6. Clean up dead `verify.md` agent definition

---

## Step 1: Clarify becomes opt-in (`--clarify` flag)

**Files to touch:**
- `scripts/cody/cody-utils.ts` (MODIFIED, lines 16-32, 334-478) — add `clarify` to CodyInput, parse `--clarify` flag
- `scripts/cody/cody.ts` (MODIFIED, lines 338, 351-363, 431-501) — gate clarify stage on flag
- `scripts/cody/run-cody.sh` (MODIFIED) — pass `--clarify` flag from env
- `.github/workflows/cody.yml` (MODIFIED, lines 6-33) — add `clarify` dispatch input
- `scripts/cody/parse-inputs.sh` (MODIFIED) — forward `DISPATCH_CLARIFY` 

**Behavior:**
- Default: clarify stage is **skipped entirely**. `clarified.md` is auto-created with "Use recommended answers."
- `--clarify` flag (or `/cody --clarify` in comment): runs clarify agent, halts on questions, waits for human answers
- `CLARIFY=true` env var in workflow_dispatch also enables it
- No change to `clarified.md` consumption by downstream stages — architect still reads it

**Tests (integration):**

1. **Test: default skips clarify**
   ```
   pnpm cody:run --task-id=test-001 --mode=spec --dry-run --local
   # Assert: clarify stage status = 'completed' (skipped)
   # Assert: clarified.md exists with default content
   # Assert: questions.md does NOT exist
   ```

2. **Test: --clarify flag enables clarify stage**
   ```
   pnpm cody:run --task-id=test-002 --mode=spec --dry-run --local --clarify
   # Assert: clarify stage status = 'completed' (ran in dry-run)
   ```

**Acceptance criteria:**
- [ ] `--clarify` CLI flag parsed in `parseCliArgs()`
- [ ] `clarify?: boolean` added to `CodyInput` interface
- [ ] Spec pipeline skips clarify by default (no LLM call)
- [ ] `clarified.md` auto-created with "Use recommended answers." when clarify skipped
- [ ] `--clarify` enables the old behavior (run clarify agent, halt on questions)
- [ ] workflow_dispatch has optional `clarify` boolean input
- [ ] `/cody --clarify` comment syntax works
- [ ] `run-cody.sh` passes `CLARIFY` env var as `--clarify` flag

---

## Step 2: Create `test-writer` subagent for TDD inside build

**Files to touch:**
- `.opencode/agents/test-writer.md` (NEW) — subagent definition
- `.opencode/agents/build.md` (MODIFIED) — add TDD workflow instructions referencing test-writer subagent
- `scripts/cody/stage-prompts.ts` (MODIFIED, line 66) — add plan.md to build context (already there), ensure build reads test file patterns
- `scripts/cody/pipeline-utils.ts` (MODIFIED, lines 360-368) — remove `test` from IMPL_PIPELINE
- `scripts/cody/cody-utils.ts` (MODIFIED, lines 66-79) — remove `test` from VALID_STAGES
- `scripts/cody/stage-prompts.ts` (MODIFIED, lines 24-37, 67) — remove `test` from ALL_STAGES, STAGE_CONTEXT_FILES
- `.opencode/agents/test.md` (DELETED or renamed to `test.md.deprecated`)

**Behavior:**
- Build agent follows TDD per plan step: for each step in plan.md, it invokes `@test-writer` subagent to write failing tests, then implements code to make them pass
- `test-writer` subagent has `mode: subagent`, read+write tools, no bash (build agent runs tests)
- Build agent runs `pnpm test:unit` after each step to verify tests pass
- Separate `test` stage removed from pipeline — tests are written during build
- Build report (`build.md`) includes test summary section
- Build timeout stays at 30 min (subagent runs within same session)

**test-writer.md agent definition:**
```yaml
---
name: test-writer
description: TDD test writer. Writes failing tests before implementation. Invoked by build agent per plan step.
mode: subagent
tools:
  read: true
  write: true
  edit: true
  bash: false
---
```
The prompt instructs: read the plan step + spec requirement, write vitest tests that assert the expected behavior, place in `tests/unit/` or `tests/int/` following project patterns. Tests MUST fail before implementation (TDD red phase).

**Tests:**

1. **Test: pipeline no longer includes `test` stage**
   ```typescript
   // tests/unit/pipeline-utils.test.ts
   import { ALL_IMPL_STAGE_NAMES } from '../../scripts/cody/pipeline-utils'
   expect(ALL_IMPL_STAGE_NAMES).not.toContain('test')
   ```

2. **Test: test-writer agent file exists and is valid**
   ```typescript
   // tests/unit/agent-definitions.test.ts  
   const content = fs.readFileSync('.opencode/agents/test-writer.md', 'utf-8')
   expect(content).toContain('mode: subagent')
   expect(content).toContain('name: test-writer')
   ```

**Acceptance criteria:**
- [ ] `.opencode/agents/test-writer.md` created with `mode: subagent`
- [ ] `build.md` agent prompt updated with TDD workflow (invoke @test-writer per step)
- [ ] `test` removed from `IMPL_PIPELINE` in pipeline-utils.ts
- [ ] `test` removed from `ALL_STAGES` in stage-prompts.ts
- [ ] `test` removed from `VALID_STAGES` in cody-utils.ts
- [ ] `test` removed from `STAGE_CONTEXT_FILES` in stage-prompts.ts
- [ ] `.opencode/agents/test.md` deleted or deprecated
- [ ] Build report template includes `## Tests` section
- [ ] Dry-run pipeline completes without `test` stage

---

## Step 3: Commit becomes scripted stage (no LLM)

**Files to touch:**
- `scripts/cody/git-utils.ts` (MODIFIED) — add `commitAndPush()` function
- `scripts/cody/scripted-stages.ts` (MODIFIED) — add `runCommitStage()` function
- `scripts/cody/cody.ts` (MODIFIED, ~line 638-648) — add `commit` to scripted stage routing (alongside `verify` and `pr`)
- `scripts/cody/agent-runner.ts` (MODIFIED, lines 56-61) — remove `commit` from `STAGE_MODELS`
- `.opencode/agents/commit.md` (MODIFIED) — mark as scripted/documentation-only (like pr.md)
- `scripts/cody/stage-prompts.ts` (MODIFIED, lines 44-45) — add `commit` to `SCRIPTED_STAGES`

**Behavior:**
- `runCommitStage(taskDir, outputFile)` in scripted-stages.ts:
  1. Read `task.json` → derive commit type (`implement_feature` → `feat`, `fix_bug` → `fix`, etc.)
  2. Read first line of `task.md` → use as commit subject (truncate to 72 chars)
  3. Read `build.md` → extract `## Changes` section as commit body
  4. Run: `git add -A && git commit -m "<type>(<taskId>): <subject>\n\n<body>" && git push -u origin HEAD`
  5. Write `commit.md` with branch name, commit hash, push status
- Falls back gracefully: if task.md missing, uses "implement changes"; if build.md missing, uses generic body
- Respects `--no-gpg-sign` for CI (already used in current codebase)

**`commitAndPush()` in git-utils.ts:**
```typescript
export function commitAndPush(taskId: string, taskDir: string, cwd?: string): { hash: string; branch: string }
```

**Tests:**

1. **Test: commit type derivation**
   ```typescript
   // tests/unit/git-utils.test.ts
   import { deriveCommitType } from '../../scripts/cody/git-utils'
   expect(deriveCommitType('implement_feature')).toBe('feat')
   expect(deriveCommitType('fix_bug')).toBe('fix')
   expect(deriveCommitType('refactor')).toBe('refactor')
   expect(deriveCommitType('docs')).toBe('docs')
   expect(deriveCommitType('ops')).toBe('chore')
   ```

2. **Test: commit subject extraction from task.md**
   ```typescript
   // tests/unit/git-utils.test.ts
   import { extractCommitSubject } from '../../scripts/cody/git-utils'
   expect(extractCommitSubject('# Task\n\nAdd YouTube embed support')).toBe('Add YouTube embed support')
   expect(extractCommitSubject('# Task\n\n' + 'x'.repeat(100))).toHaveLength(72)
   ```

3. **Test: scripted commit stage routing**
   ```typescript
   // tests/unit/scripted-stages.test.ts
   import { SCRIPTED_STAGES } from '../../scripts/cody/stage-prompts'
   expect(SCRIPTED_STAGES).toContain('commit')
   ```

**Acceptance criteria:**
- [ ] `deriveCommitType(taskType)` exported from git-utils.ts
- [ ] `extractCommitSubject(taskMdContent)` exported from git-utils.ts  
- [ ] `extractCommitBody(buildMdContent)` exported from git-utils.ts
- [ ] `commitAndPush(taskId, taskDir, cwd)` exported from git-utils.ts
- [ ] `runCommitStage(taskDir, outputFile)` added to scripted-stages.ts
- [ ] `commit` routed to `runCommitStage` in cody.ts `runSingleStage()`
- [ ] `commit` added to `SCRIPTED_STAGES` in stage-prompts.ts
- [ ] `commit` removed from `STAGE_MODELS` in agent-runner.ts
- [ ] `.opencode/agents/commit.md` updated to note scripted nature
- [ ] Conventional commit format: `<type>(<taskId>): <Subject>\n\n<body 20+ chars>`
- [ ] Handles "nothing to commit" gracefully (no error)

---

## Step 4: Plan-review loops back to architect (keep current behavior)

**Files to touch:**
- None — current behavior already correct

**Behavior (already implemented):**
- Plan-review returns FAIL → deletes plan.md + plan-review.md → throws `PlanReviewFailError`
- Catch block in `runImplPipeline` re-runs architect → re-runs plan-review (max 2 retries)
- This is exactly the behavior you want: plan-review feedback goes back to architect (plan)

**Verification test:**

1. **Test: plan-review FAIL triggers architect re-run**
   ```typescript
   // Existing behavior — verify with dry-run that pipeline structure is correct
   import { IMPL_PIPELINE } from '../../scripts/cody/pipeline-utils'
   const stages = IMPL_PIPELINE.map(s => typeof s === 'string' ? s : s.parallel)
   expect(stages[0]).toBe('architect')
   expect(stages[1]).toBe('plan-review')
   // Plan-review retry logic exists in cody.ts — verified by code inspection
   ```

**Acceptance criteria:**
- [ ] No changes needed — current plan-review → architect loop is correct
- [ ] PlanReviewFailError → delete plan.md → re-run architect → re-run plan-review (max 2 retries)
- [ ] Verified by code review that loop exists at cody.ts lines 854-889

---

## Step 5: Auditor output auto-applied by new `apply-audit` stage

**Files to touch:**
- `.opencode/agents/apply-audit.md` (NEW) — agent that reads auditor.md and implements the suggestion
- `scripts/cody/pipeline-utils.ts` (MODIFIED, lines 360-368) — add `apply-audit` after auditor, before pr
- `scripts/cody/stage-prompts.ts` (MODIFIED) — add `apply-audit` to ALL_STAGES, STAGE_CONTEXT_FILES
- `scripts/cody/cody-utils.ts` (MODIFIED) — add `apply-audit` to VALID_STAGES
- `scripts/cody/agent-runner.ts` (MODIFIED) — add timeout for `apply-audit`, use FAST_MODEL

**Behavior:**
- After auditor writes `auditor.md`, `apply-audit` agent reads it and implements the improvement
- apply-audit reads the `## Chosen Improvement` section: `Type`, `Where` (file path), `Acceptance Criteria`
- It edits/creates the file specified in `Where:` (e.g., `.opencode/agents/spec.md`, `AGENTS.md`)
- Changes go into the same PR branch — visible in PR diff for review
- If auditor.md has no actionable improvement or `Run State: FAILURE`, apply-audit writes a no-op report
- Output: `.tasks/<taskId>/apply-audit.md` with what was changed
- Timeout: 5 minutes (same as auditor)
- Model: FAST_MODEL (targeted edit, not complex generation)
- Guardrail: apply-audit can ONLY edit files mentioned in `Where:` field — prompt enforces this

**Pipeline change:**
```typescript
// Before:
{ parallel: ['auditor', 'pr'] }

// After:
'auditor',
'apply-audit',
{ parallel: ['pr'] }  // or just 'pr' since it's alone now
```

Note: auditor and apply-audit must be sequential (apply-audit reads auditor.md). PR can still run in parallel with apply-audit since PR only needs build/verify outputs.

Actually, apply-audit modifies files that should be in the PR. So the order must be:
```
auditor → apply-audit → pr
```
All sequential. Or: `auditor → [apply-audit, pr-prep] → pr` but that's over-complicated. Keep it simple: sequential.

**Tests:**

1. **Test: apply-audit in pipeline after auditor**
   ```typescript
   // tests/unit/pipeline-utils.test.ts
   import { ALL_IMPL_STAGE_NAMES } from '../../scripts/cody/pipeline-utils'
   const auditorIdx = ALL_IMPL_STAGE_NAMES.indexOf('auditor')
   const applyIdx = ALL_IMPL_STAGE_NAMES.indexOf('apply-audit')
   const prIdx = ALL_IMPL_STAGE_NAMES.indexOf('pr')
   expect(applyIdx).toBeGreaterThan(auditorIdx)
   expect(prIdx).toBeGreaterThan(applyIdx)
   ```

2. **Test: apply-audit stage has correct context files**
   ```typescript
   // tests/unit/stage-prompts.test.ts
   import { STAGE_CONTEXT_FILES } from '../../scripts/cody/stage-prompts'
   expect(STAGE_CONTEXT_FILES['apply-audit']).toContain('auditor.md')
   ```

**Acceptance criteria:**
- [ ] `.opencode/agents/apply-audit.md` created with `mode: primary`
- [ ] Agent prompt: read `auditor.md` → extract `Where:` path → edit that file → write report
- [ ] `apply-audit` added to `IMPL_PIPELINE` after `auditor`, before `pr`
- [ ] `apply-audit` added to `ALL_STAGES`, `VALID_STAGES`, `STAGE_CONTEXT_FILES`
- [ ] `STAGE_CONTEXT_FILES['apply-audit']` = `['auditor.md']`
- [ ] `apply-audit` timeout = 5 min in `STAGE_TIMEOUTS`
- [ ] `apply-audit` uses `FAST_MODEL` in `STAGE_MODELS`
- [ ] Output file: `apply-audit.md`
- [ ] Skipped on reruns (same as auditor — existing logic filters both)
- [ ] Pipeline order: `auditor → apply-audit → pr` (all sequential now)
- [ ] Changes included in PR diff for human review

---

## Step 6: Clean up dead verify agent definition

**Files to touch:**
- `.opencode/agents/verify.md` (MODIFIED) — rewrite to document scripted nature (like pr.md)

**Behavior:**
- The verify stage already runs as a script (`runVerifyStage()` in scripted-stages.ts)
- The current `.opencode/agents/verify.md` describes an LLM-based verify with "soft gate: spec compliance" — this is misleading because it never runs as an LLM agent
- Rewrite to match the pattern of `pr.md`: brief note that this is scripted

**Tests:**

1. **Test: verify is in SCRIPTED_STAGES**
   ```typescript
   // tests/unit/stage-prompts.test.ts
   import { SCRIPTED_STAGES } from '../../scripts/cody/stage-prompts'
   expect(SCRIPTED_STAGES).toContain('verify')
   ```

**Acceptance criteria:**
- [ ] `.opencode/agents/verify.md` rewritten to ~20 lines documenting scripted behavior
- [ ] No LLM instructions remain in verify.md
- [ ] Matches pattern of `pr.md` (documentation-only)

---

## Step 7: Update documentation

**Files to touch:**
- `.opencode/PIPELINE.md` (MODIFIED) — update pipeline diagram, stage table, remove test stage, add apply-audit, note clarify is opt-in
- `.opencode/DRIVER.md` (DELETED) — redundant with PIPELINE.md, removed
- `scripts/cody/pipeline-utils.ts` (MODIFIED) — update DRY_RUN_OUTPUTS (remove test, add apply-audit)

**Tests:**

1. **Test: dry-run outputs match pipeline stages**
   ```typescript
   // tests/unit/pipeline-utils.test.ts
   import { ALL_IMPL_STAGE_NAMES } from '../../scripts/cody/pipeline-utils'
   // Every impl stage should have a dry-run output generator
   for (const stage of ALL_IMPL_STAGE_NAMES) {
     // DRY_RUN_OUTPUTS is not exported, but writeDryRunOutput should not throw
     expect(() => writeDryRunOutput('/tmp/test', stage, 'test-task')).not.toThrow()
   }
   ```

**Acceptance criteria:**
- [ ] PIPELINE.md reflects new pipeline: `taskify → spec → [clarify: opt-in] → architect → plan-review → build(+TDD) → commit(scripted) → verify → autofix → auditor → apply-audit → pr`
- [ ] DRIVER.md file-detection table updated (no test.md)
- [ ] DRY_RUN_OUTPUTS has entries for `apply-audit`, no entry for `test`
- [ ] All stage lists are consistent across: pipeline-utils.ts, stage-prompts.ts, cody-utils.ts

---

## Implementation Order

Execute steps in this order (dependencies):

1. **Step 6** (cleanup verify.md) — no dependencies, quick win
2. **Step 1** (clarify opt-in) — independent, modifies spec pipeline only
3. **Step 4** (plan-review) — no changes needed, verify only
4. **Step 3** (scripted commit) — independent, modifies impl pipeline
5. **Step 2** (TDD subagent) — removes test stage, modifies build agent
6. **Step 5** (apply-audit) — adds new stage, modifies pipeline structure
7. **Step 7** (documentation) — must be last, references all changes

Steps 1-4 can be done in parallel. Steps 5-6 depend on pipeline structure being stable.

---

## Assumptions

- OpenCode `github run` supports subagent invocation via Task tool within a single session (verified via docs)
- `test-writer` subagent runs within build's 30-minute timeout budget
- `apply-audit` changes are safe to include in PR (human reviews before merge)
- The `commit` scripted stage can derive sufficient commit message quality from task.md + build.md without LLM
- Auditor improvements target files that exist in the repo (agent prompts, docs, config)

## Risk Mitigation

- **apply-audit editing wrong files**: Prompt constrains to ONLY the `Where:` path from auditor.md
- **TDD subagent timing out**: Build agent has 30-min timeout; if subagent is slow, build can fall back to writing tests inline
- **Scripted commit message quality**: If commit is rejected by commitlint, pipeline fails at verify; autofix can retry
