# Spec: Cody Pipeline Crash Recovery & Stale State Detection

## Overview

The Cody pipeline has a **4% completion rate** (1/24 successful). Analysis of 24 pipeline runs reveals that **zero failures are caused by build quality** — build succeeds 100% of the time. All failures are caused by **stale "running" state** after process interruption and **missing stages from older pipeline definitions**.

This spec addresses three bugs that together account for 92% of pipeline failures.

## Problem Analysis

### Data (24 pipeline runs analyzed)

| Outcome | Count | % |
|---------|-------|---|
| ✅ Completed | 1 | 4% |
| ❌ Explicitly failed | 1 | 4% |
| 🔄 Stuck as "running" | 22 | 92% |

### Where pipelines get stuck

| Location | Count | Root Cause |
|----------|-------|------------|
| All stages done, no PR | 8 | Ran on older pipeline code missing `apply-audit`/`pr`, OR process killed after auditor but before PR |
| `apply-audit` stuck running | 5 | Process killed during agent execution |
| `auditor` stuck running | 4 | Process killed during agent execution |
| `verify` stuck running | 2 | Process killed during scripted stage |
| Other (clarify, architect, commit) | 3 | Process killed during execution |

**Key observation**: ALL 22 stuck pipelines are **local runs** (no feature branches). When the process is killed (Ctrl+C, terminal close, machine sleep), `status.json` stays in "running" state with no recovery.

## Requirements

### FR-001: Stale "running" state detection on startup

When the pipeline starts (or resumes), detect stages stuck in "running" state from a previous interrupted run and reset them to "pending" so they can be re-executed.

**Behavior**:
- On pipeline startup, scan `status.json` for any stage with `state: "running"`
- If `state.state` (pipeline-level) is "running" but no process is actively executing, these are stale
- Reset stale "running" stages to `state: "pending"` 
- Log: `⚠️ Recovered stale stage <name>: running → pending`
- Continue normal execution (resolveNextStep will pick them up)

**Detection heuristic**: A stage is "stale running" if:
1. Its state is `"running"` AND
2. The pipeline is being freshly started (not mid-execution) — i.e., this is the initial `loadState()` call at the start of `runPipeline()`

This is safe because: if the pipeline is freshly starting, no stage can legitimately be "running" — that state only exists during active execution.

### FR-002: Pipeline-level state recovery

When status.json shows `state: "running"` but all stages are `completed`/`skipped`/`failed`:
- Detect this as an incomplete pipeline run
- If all stages in the current pipeline order are `completed` or `skipped`: mark pipeline as `"completed"`
- If any stage is `"failed"` (non-advisory): mark pipeline as `"failed"`
- Log: `⚠️ Recovered pipeline state: running → <new_state>`

### FR-003: Graceful signal handling with commit+push

Improve the existing SIGTERM/SIGINT handler in `entry.ts` to:
1. Mark current running stage(s) as `"failed"` (not just pipeline-level)
2. Mark pipeline as `"failed"` 
3. In CI mode (not local): attempt to commit and push `status.json` to the branch
4. Log clearly: `⚠️ Pipeline interrupted at <stage>, status saved`

### NFR-001: Zero impact on happy path

Recovery logic MUST NOT change behavior when the pipeline is running normally. It only activates when loading state from a previous interrupted run.

### NFR-002: Idempotent recovery

Running recovery multiple times on the same status.json produces the same result. No data loss, no duplicate stage executions.

### NFR-003: Backward compatible

Recovery works with existing status.json files (v2 format). No schema changes required.

## Acceptance Criteria

- [FR-001] Stages stuck as "running" from previous run are reset to "pending" on startup
- [FR-001] Stages currently being executed (mid-pipeline) are NOT reset
- [FR-002] Pipeline stuck as "running" with all stages done is auto-completed
- [FR-002] Pipeline stuck as "running" with a failed stage is auto-failed
- [FR-003] SIGTERM handler marks individual running stages as failed
- [FR-003] SIGTERM handler commits status.json in CI mode
- [NFR-001] Normal pipeline execution is unchanged
- [NFR-002] Recovery is idempotent
- [NFR-003] Works with existing v2 status.json format

## Files Likely Affected

| File | Change |
|------|--------|
| `scripts/cody/engine/state-machine.ts` | Add `recoverStaleState()` call at start of `runPipeline()` |
| `scripts/cody/engine/status.ts` | Add `recoverStaleState()` and `recoverPipelineState()` functions |
| `scripts/cody/entry.ts` | Improve signal handler to mark individual stages + commit in CI |
| `tests/unit/cody/status-recovery.test.ts` | NEW — unit tests for recovery logic |

## Out of Scope

- Automatic rerun of failed pipelines (user must trigger)
- Recovery of tasks from older pipeline versions (pre-state-machine)
- Changing the pipeline order or stage definitions
- CI-specific retry logic (GitHub Actions already handles job-level retries)
