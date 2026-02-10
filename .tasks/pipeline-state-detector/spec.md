# Plan: OpenCode Pipeline State Detector (Phase 1)

## Context

The `.opencode/PIPELINE.md` defines a deterministic state machine for task orchestration: detect artifacts, determine state, dispatch agents. Currently this pipeline exists only as documentation — no automation. The user wants a script to implement it, starting with a **Phase 1 that is simple and easy to debug**: a read-only state detector with CLI output. No agent invocation yet.

## Decisions (from user)

- **Location**: `scripts/pipeline.ts` — alongside existing project scripts
- **Task directory**: `.tasks/<task-id>/` (unified) — task file, spec, plan, verify all in one directory
- **Invocation**: `pnpm tsx scripts/pipeline.ts --task-id=<id>` + a `pnpm pipeline` alias

## Phase 1 Scope: Read-Only State Detector

A single TypeScript file that:
1. Reads the filesystem to check which artifacts exist for a given task
2. Resolves the pipeline state using top-down rule evaluation
3. Outputs the DRIVER OUTPUT CONTRACT (markdown or JSON)

**Not in scope for Phase 1**: agent invocation, git state detection, BLOCKED state (requires LLM), the BUILD-VERIFY loop.

---

## File: `scripts/pipeline.ts`

Single file, `#!/usr/bin/env tsx`, matching the project's existing script conventions (see `scripts/verify.ts`, `scripts/check-branch.ts`).

### Structure (sections within the file)

```
1. Types           (~40 lines)  - PipelineState, ArtifactSnapshot, DriverOutput, VerifyReportSummary
2. Config/Paths    (~15 lines)  - buildPaths(projectRoot, taskId) → all artifact paths
3. Verify Parser   (~40 lines)  - parseVerifyReport(filePath) → { hardGate, softGate, finalResult }
4. Artifact Detect (~30 lines)  - detectArtifacts(paths) → ArtifactSnapshot
5. State Resolver  (~35 lines)  - resolveState(artifacts) → PipelineState (pure function, top-down rules)
6. Output Builder  (~50 lines)  - buildOutput(state, artifacts) → DriverOutput + format as markdown/JSON
7. CLI Main        (~30 lines)  - parseArgs, orchestrate, print
                   ~240 lines total
```

### Key Types

```typescript
type PipelineState =
  | 'NO_TASK' | 'TASK_ONLY' | 'SPEC_READY'
  | 'BUILD' | 'VERIFY' | 'DONE'

interface ArtifactSnapshot {
  taskId: string
  taskFileExists: boolean      // .tasks/<task-id>/task.md
  specFileExists: boolean      // .tasks/<task-id>/spec.md
  planFileExists: boolean      // .tasks/<task-id>/plan.md
  latestVerify: VerifyReportSummary | null
}

interface VerifyReportSummary {
  filePath: string
  timestamp: string
  hardGate: 'PASS' | 'FAIL'
  finalResult: 'PASS' | 'FAIL'
}

interface DriverOutput {
  currentState: PipelineState
  blockingCondition: string | null
  nextAgent: string | null
  instruction: string | null
}
```

### State Resolution Logic (top-down, first match wins)

```
1. No task file         → NO_TASK      (stop, no agent)
2. No spec              → TASK_ONLY    (next: spec)
3. No plan              → SPEC_READY   (next: plan)
4. Verify PASS          → DONE         (stop)
5. Verify FAIL          → BUILD        (next: build — "return to build")
6. No verify yet        → BUILD        (next: build — first build)
```

**Phase 1 simplification**: Without git state, we cannot distinguish "needs verify" from "needs build" when there's no verify report. Default to BUILD, which is correct (build hasn't happened yet). The VERIFY state detection (new commits since last verify) is deferred to Phase 2.

### Verify Report Parsing

Based on the actual report at `.tasks/20260702-pipe-001-health-endpoint-badge/verify-20260207-145037.md`:

- Filename pattern: `verify-YYYYMMDD-HHMMSS.md`
- Hard gate line: `**Status:** ❌ FAILED` or `**Status:** ✅ PASSED`
- Summary section with: `Hard Gate (pnpm verify) | ❌ BLOCKED` or `✅ PASS`
- Parse approach: regex for `Hard Gate.*?(PASS|FAIL|BLOCKED|COMPLIANT)` and similar for Final/Overall

Fallback: if the report can't be parsed, treat as FAIL (safe default).

### CLI Interface

```bash
# Basic usage
pnpm pipeline --task-id=20260702-pipe-001-health-endpoint-badge

# JSON output (for scripting)
pnpm pipeline --task-id=my-task --format=json

# List all tasks
pnpm pipeline --list
```

### Task File Convention

Since the user chose unified `.tasks/<task-id>/`, the pipeline expects:

```
.tasks/<task-id>/
  task.md           ← task definition (was at .opencode/tasks/<task-id>.md in PIPELINE.md)
  spec.md           ← spec (matches existing convention)
  plan.md           ← plan (matches existing convention)
  verify-*.md       ← verify reports (matches existing convention)
```

**Note**: Existing tasks like `20260702-pipe-001-health-endpoint-badge` already have spec.md, plan.md, and verify-*.md but NOT a task.md file. The pipeline script will also check for any `.md` file matching common task file names (task.md, prd.md, hls.md, llp.md) as a "task exists" signal — since existing tasks use varied naming.

### package.json Addition

```json
"pipeline": "pnpm tsx scripts/pipeline.ts"
```

---

## Phase 2 (Future): Git State + VERIFY Detection

- Add `git log` / `git rev-parse` calls to detect commits since last verify
- Enable proper VERIFY state (new commits exist → run verify agent)
- Add `--watch` mode for continuous state monitoring

## Phase 3 (Future): Agent Invocation

- Dispatch agents via OpenCode CLI/API
- Implement BUILD-VERIFY loop with max iteration safety
- Create missing agent definitions (build.md, plan.md)

---

## Verification (Phase 1)

```bash
# 1. Run against existing task (has spec + plan + failed verify → BUILD)
pnpm pipeline --task-id=20260702-pipe-001-health-endpoint-badge

# 2. Run against nonexistent task → NO_TASK
pnpm pipeline --task-id=nonexistent

# 3. Create minimal test fixtures and verify each state:
mkdir -p .tasks/test-pipeline
echo "# Test Task" > .tasks/test-pipeline/task.md
pnpm pipeline --task-id=test-pipeline           # → TASK_ONLY

echo "# Test Spec" > .tasks/test-pipeline/spec.md
pnpm pipeline --task-id=test-pipeline           # → SPEC_READY

echo "# Test Plan" > .tasks/test-pipeline/plan.md
pnpm pipeline --task-id=test-pipeline           # → BUILD

# 4. JSON output works
pnpm pipeline --task-id=test-pipeline --format=json

# 5. Cleanup
rm -rf .tasks/test-pipeline
```

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `scripts/pipeline.ts` | CREATE | ~240 |
| `package.json` | EDIT | +1 (add `pipeline` script) |
