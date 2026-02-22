# Spec: 260220-cody-bug-fixes

## Overview

Fixes critical integration bugs and reliability issues in the Cody pipeline. These are not new features, but corrections to broken functionality where the CI script (`run-cody.sh`), the TypeScript runner (`cody.ts`), and the configuration (`agent-runner.ts`) are out of sync or implementing logic incorrectly.

## Requirements

### FIX-001: Fix broken comment triggers in CI (`--comment-body-env`)

**Priority**: MUST
**Type**: Bug Fix
**Context**: The CI script `run-cody.sh` passes `--comment-body-env=COMMENT_BODY` to avoid shell injection when passing comment content. However, `cody-utils.ts` does not implement parsing for this flag.
**Impact**: All `/cody` commands triggered from GitHub comments in CI are currently ignored (defaulting to "full" mode) because the runner never sees the comment body.
**Fix**:
- Update `parseCliArgs` in `cody-utils.ts` to handle `--comment-body-env`.
- It should read the env var specified by the value and pass it to `parseCommentBody`.

### FIX-002: Fix `rerun --from autofix` broken logic

**Priority**: MUST
**Type**: Bug Fix
**Context**: `autofix` is a valid stage but is not listed in `ALL_IMPL_STAGE_NAMES` because it's a conditional sub-stage of `verify`.
**Impact**: Running `pnpm cody rerun --from autofix` causes `indexOf` to return `-1`. The pipeline then slices the array incorrectly (running only the last stage `pr`), effectively skipping the work intended to be rerun.
**Fix**:
- In `runRerunPipeline` (cody.ts), explicitly map `fromStage === 'autofix'` to start at `verify`.
- Alternatively, ensure `indexOf` logic handles unknown stages gracefully or aliases them correctly.

### FIX-003: Fix `verify` stage ignoring configured timeouts

**Priority**: SHOULD
**Type**: Bug Fix
**Context**: `agent-runner.ts` configures a 10-minute timeout for `verify`. However, `scripted-stages.ts` hardcodes a 120s (2m) timeout for `execSync`.
**Impact**: Valid test suites taking >2 minutes fail the pipeline, despite the configuration explicitly allowing 10 minutes.
**Fix**:
- Remove hardcoded `120_000` timeout in `runVerifyStage`.
- Pass the actual timeout value from `STAGE_TIMEOUTS` to the `verify` execution function.

### FIX-004: Fix `E2BIG` crash on Local Runner with large prompts

**Priority**: SHOULD
**Type**: Reliability Fix
**Context**: `LocalRunner` passes the full LLM prompt as a CLI argument.
**Impact**: On large codebases or complex tasks, the prompt exceeds the OS `ARG_MAX` limit, causing the runner to crash with `E2BIG` before the agent even starts.
**Fix**:
- Change `LocalRunner` to pass the prompt via `PROMPT` environment variable (matching `GitHubRunner` behavior).

### FIX-005: Fix "False Success" when agent produces no output

**Priority**: SHOULD
**Type**: Robustness Fix
**Context**: The runner relies on process exit code `0` to determine success.
**Impact**: If an LLM "hallucinates" completion and exits without writing the `result.md` file, the runner marks the stage as "Completed". The *next* stage then crashes immediately because it can't find its input file.
**Fix**:
- In `agent-runner.ts`, add a check: if `exitCode === 0` but `!fs.existsSync(outputFile)`, treat as failure (or retry).

## Acceptance Criteria

- [ ] CI comment trigger `/cody spec ...` correctly parses the comment body via env var.
- [ ] `cody rerun --from autofix` correctly restarts execution from the verification stage.
- [ ] Verification stage runs successfully for tasks taking 5+ minutes (verifying timeout fix).
- [ ] Local runner successfully executes tasks with very large context/prompts.
- [ ] Pipeline fails gracefully (and retries) if an agent exits without producing its output file.

## Guardrails

- **Backward Compatibility**: Existing flags must still work.
- **No Logic Changes**: Do not change *what* the stages do, only *how* they are invoked/managed.
