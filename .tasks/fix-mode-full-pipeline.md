# Fix Mode as Full Pipeline — Implementation Plan

**Date**: 2026-03-14  
**Branch**: dev (work directly, no feature branch)  
**Issue**: PR #813 timeout — fix mode runs short pipeline without planning, agent spirals on tests

---

## Problem Summary

When `@cody fix` is triggered on a PR:
1. Current fix mode runs `FIX_ORDER = ['review', 'fix', 'commit', 'verify', 'pr']` — no planning stages
2. The agent must figure out a multi-file change (schema → types → editor → renderer) on its own
3. Agent wrote tests, got stuck debugging test infrastructure, timed out after 10 minutes
4. Previous run's artifacts (spec.md, plan.md, build.md) exist but aren't used as context

---

## Solution

Transform fix mode to run the **full pipeline** on the **original task ID**, with previous artifacts archived and injected as context. All existing pipeline mechanics (gates, complexity, validators, post-actions, timeouts) remain unchanged.

### Key Design Decisions

1. **Reuse original task ID** — Switch to the task that created the PR, not a new fix task
2. **Archive previous artifacts** — Copy existing task files to `prev-run/` for context
3. **Compose taskify input** — Issue body + fix comment + PR review feedback
4. **Run full pipeline** — Same order as `IMPL_ORDER_STANDARD` with taskify prepended
5. **Existing PR** — PR stage detects existing PR and updates it, doesn't create new

### Task Resolution Flow

```
@cody fix on PR #813
  │
  ├─ parse-inputs discovers task from PR → 260314-auto-530 (previous fix task)
  │
  ├─ runFixMode():
  │   ├─ Get linked issue: gh pr view 813 → #780
  │   ├─ Get original task: discoverTaskIdFromIssue(780) → 260313-auto-475
  │   ├─ Switch to original task ID: input.taskId = 260313-auto-475
  │   ├─ Archive artifacts to prev-run/
  │   ├─ Compose task.md: issue body + fix comment
  │   └─ Run full pipeline on task 260313-auto-475
  │
  └─ PR stage: existing PR #813 updated
```

---

## Files to Modify

### 1. `scripts/cody/github-api.ts` — Add 2 functions

**`getLinkedIssueFromPR(prNumber: number): number | null`**
- Calls `gh pr view <prNumber> --json closingIssuesReferences`
- Returns linked issue number, or null

**`getIssueBody(issueNumber: number): string | null`**
- Calls `gh issue view <issueNumber> --json body`
- Returns issue body text, or null

### 2. `scripts/cody/pipeline/definitions.ts` — New pipeline order

```typescript
export const FIX_FULL_ORDER: PipelineStep[] = [
  'taskify',
  'architect',
  'plan-gap',
  { parallel: ['test', 'build'] },
  'commit',
  'review',
  'fix',
  'commit',
  'verify',
  'pr',
]
```

### 3. `scripts/cody/engine/pipeline-resolver.ts` — Fix mode uses new order

```typescript
case 'fix': {
  const fixPipeline = buildPipeline('full', profile, clarify, ctx)
  return { stages: fixPipeline.stages, order: FIX_FULL_ORDER }
}
```

### 4. `scripts/cody/entry.ts` → `runFixMode()` — Major rewrite

**Step 1: Resolve original task ID**
- If PR: get linked issue → discover original task ID
- Switch `input.taskId` to original task

**Step 2: Archive previous artifacts**
- `mkdir .tasks/<taskId>/prev-run/`
- Copy `*.md`, `task.json`, `status.json` to `prev-run/`

**Step 3: Compose taskify input**
- Get issue body from linked issue
- Get fix comment from PR
- Write `task.md` combining all three

**Step 4: Reset state and run pipeline**
- `resetFromStage('taskify', ...)` for fresh run
- `runPipeline(ctx, pipeline)`

### 5. `scripts/cody/stage-prompts.ts` — Add prev-run context

```typescript
architect: [..., 'prev-run/plan.md', 'prev-run/build.md', 'prev-run/review.md'],
build: [..., 'prev-run/build.md', 'prev-run/review.md'],
```

### 6. `.opencode/agents/build.md` — Prompt improvements

Add sections:
- **Test Infrastructure** — vitest context, no jest-dom
- **Test Debugging Budget** — bail after 3 failed test attempts

---

## Implementation Steps

### Phase 1: Core Infrastructure

- [ ] Add `getLinkedIssueFromPR` to `github-api.ts`
- [ ] Add `getIssueBody` to `github-api.ts`
- [ ] Add `FIX_FULL_ORDER` to `definitions.ts`
- [ ] Update `pipeline-resolver.ts` to use `FIX_FULL_ORDER`

### Phase 2: Fix Mode Rewrite

- [ ] Rewrite `runFixMode()` in `entry.ts`:
  - [ ] Original task ID resolution
  - [ ] Archive logic
  - [ ] Task composition
  - [ ] Pipeline execution

### Phase 3: Context Injection

- [ ] Update `STAGE_CONTEXT_FILES` in `stage-prompts.ts`

### Phase 4: Prompt Improvements

- [ ] Add test infrastructure section to `build.md`
- [ ] Add test debugging budget section to `build.md`

### Phase 5: Verification

- [ ] Run `pnpm -s tsc --noEmit`
- [ ] Run `pnpm vitest run --config vitest.config.unit.mts`
- [ ] Run `pnpm lint`

---

## What Does NOT Change

- All pipeline mechanics (state machine, gates, complexity thresholds, validators, post-actions)
- All stage definitions (timeouts, maxRetries, shouldSkip)
- `parse-inputs.ts` — fix mode detection stays the same
- `ensureFeatureBranch` — no-op when branch exists
- `runRerunMode` — untouched
- The `fix` stage definition
- Dashboard/status tracking
- Commit/PR handlers

---

## Edge Cases

| Case | Handling |
|---|---|
| PR has no linked issue | Fall back to PR description. Log warning. |
| Original artifacts not on branch | Run without prev-run. Log warning. |
| Second `@cody fix` | Archive includes prev-fix artifacts. Chain of context. |
| Taskify gate pauses | Normal behavior — pause and resume |
| Low complexity fix | Architect/plan-gap skip. Build runs directly. |
| `@cody fix --fresh` | Skip discovery, new task ID, no archive |
| `--fresh` flag in parse-inputs.ts | Already exists, passes through |

---

## Testing

Add unit tests for:
- `getLinkedIssueFromPR` — mock `gh pr view`
- `getIssueBody` — mock `gh issue view`
- Archive logic — verify files copied to `prev-run/`
- `runFixMode` integration — verify pipeline order

---

## Verification Commands

```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```

---

## Related: Prompt Improvements (Same PR)

Also included in this implementation:

1. **Test infrastructure context** — Agent knows this is vitest, not jest
2. **Test debugging budget** — Agent bails after 3 failed test attempts, prevents spiral

These are low-risk prompt changes that directly address the PR #813 failure mode.
