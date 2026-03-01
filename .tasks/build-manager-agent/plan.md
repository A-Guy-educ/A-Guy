# Plan: Build-Manager Agent Architecture

## Overview

Create a `build-manager` agent (Claude Opus) that orchestrates `build` (MiniMax) and `test-writer` (MiniMax) in parallel, with retry logic and direct verification.

## Architecture

```
[Plan] → build-manager (Claude Opus)
              │
    ┌─────────┴─────────┐
    ↓                   ↓
test-writer          build
(MiniMax)           (MiniMax)
    ↓                   ↓
    └─────────┬─────────┘
              ↓
        verify (pnpm verify)
              ↓
        [pass] → done
        [fail] → manager retries (max 3)
```

## Token/Work Distribution

| Agent | Model | Tokens | Work % |
|-------|-------|--------|--------|
| build-manager | Claude Opus | ~15-20% | Orchestration, decisions, retries |
| test-writer | MiniMax M2.5 | ~25-30% | Write failing tests |
| build | MiniMax M2.5 | ~50-55% | Implementation + verify |

---

## Step 1: Update opencode.json

**File**: `opencode.json` (MODIFIED)

**Changes**:
- Add `build-manager` agent config with `anthropic/claude-opus-4-6`
- Add explicit `test-writer` agent config with `minimax-coding-plan/MiniMax-M2.5`
- Keep existing `build` config unchanged

**Add after existing agents**:
```json
"build-manager": {
  "model": "anthropic/claude-opus-4-6",
  "description": "Orchestrates build and test-writer agents in parallel, handles retries and verification"
},
"test-writer": {
  "model": "minimax-coding-plan/MiniMax-M2.5",
  "description": "TDD test writer - writes failing tests before implementation"
}
```

**Acceptance Criteria**:
- [ ] `build-manager` config exists with Claude Opus model
- [ ] `test-writer` config exists with MiniMax model
- [ ] Existing `build` config unchanged

---

## Step 2: Create build-manager.md

**File**: `.opencode/agents/build-manager.md` (NEW)

**Agent Definition**:

```yaml
---
name: build-manager
description: Orchestrates build and test-writer agents in parallel, handles retries and verification
mode: primary
tools:
  bash: true
  read: true
  write: true
  edit: true
---
```

**Core Behavior**:

1. **Input**: Receives ready-made plan from pipeline (spec.md + plan.md)
2. **Parse**: Extract plan steps
3. **Parallel Invocation**:
   - Invoke `@test-writer` with plan + source context
   - Invoke `@build` with plan
   - Both run simultaneously on same plan
4. **Verification**: After both complete, run `pnpm verify` directly
5. **Retry Logic**:
   - Max 3 retries on failure
   - On test failure: re-invoke build with failure context
   - On verify failure: re-invoke build with error output
6. **Output**: Write `.tasks/<taskId>/build-manager.md` report

**Key Sections in the Agent File**:

- **Role**: You are the Build Manager. You orchestrate, you do NOT write code.
- **Workflow**: Parse plan → invoke test-writer + build in parallel → verify → retry if needed
- **Retry Strategy**: Max 3 attempts. Pass failure context to build on retry.
- **Verification**: Run `pnpm -s tsc --noEmit && pnpm -s lint && pnpm test:unit` directly
- **Output Format**: Summary of what was built, tests written, verification results
- **Rules**:
  - Do NOT write implementation code yourself
  - Do NOT modify test files yourself
  - Only orchestrate and validate
  - Pass full error context on retries

**Acceptance Criteria**:
- [ ] File exists at `.opencode/agents/build-manager.md`
- [ ] Defines parallel invocation of test-writer + build
- [ ] Includes retry logic (max 3)
- [ ] Runs verification commands directly
- [ ] Writes output report
- [ ] Does NOT write code itself

---

## Step 3: Refactor build.md to Subagent

**File**: `.opencode/agents/build.md` (MODIFIED)

**Changes**:
- Change `mode: primary` → `mode: subagent`
- Update description to "Pure executor - implements code changes from plan"
- Remove: "Invoke @test-writer subagent" section (lines ~29-88) — manager handles this
- Remove: "How to Invoke Test Writer" template
- Keep: Pure implementation workflow
- Keep: Quality checks (tsc, lint)
- Keep: "Never Weaken Tests" rules
- Keep: Domain-specific subagent invocation (payload-expert, etc.)
- Keep: Bug fix workflow
- Keep: Edit tool guidance
- Keep: Skills section
- Update: Exit criteria to reflect subagent role

**Acceptance Criteria**:
- [ ] `mode: subagent` in frontmatter
- [ ] No references to invoking test-writer
- [ ] Keeps implementation + verify responsibilities
- [ ] Keeps all quality rules (never weaken tests, etc.)
- [ ] Works when invoked by build-manager

---

## Estimated Effort

| Step | Time | Lines Changed |
|------|------|---------------|
| Step 1: opencode.json | 2 min | ~8 lines added |
| Step 2: build-manager.md | 15 min | ~120 lines new |
| Step 3: build.md refactor | 10 min | ~60 lines removed/modified |
| **Total** | **~27 min** | **~190 lines** |
