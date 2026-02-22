# Build Agent Report: Cody Pipeline Fixes

## Changes

### Core Pipeline Fixes

- **`scripts/cody/agent-runner.ts`**: Removed OPENCODE_MODEL and STAGE_MODELS - models are now only defined in opencode.json, Cody only selects agent. Also implemented proper FILE_STABLE_CHECKS (2 consecutive stable size checks) for file detection. Added SKIP_HOOKS=1 for ALL agent processes (not just spec stages).

- **`scripts/cody/stage-prompts.ts`**: Added documentation note that some context files (e.g., rerun-feedback.md) may not exist and agents should handle this gracefully.

- **`scripts/cody/cody-utils.ts`**: Fixed hardcoded OWNER/REPO in editComment() - now uses GITHUB_REPOSITORY environment variable.

- **`scripts/cody/git-utils.ts`**: Fixed over-staging - now only stages files in specific task directory (.tasks/{taskId}) instead of all files in src/tests.

- **`scripts/cody/stage-hooks.ts`**: Made build validation a hard error instead of warning - throws if build.md is missing Changes section.

- **`scripts/cody/scripted-stages.ts`**: Added comment noting integration tests run in CI after PR creation (not in verify stage due to MongoDB requirement).

### Workflow Fixes

- **`.github/workflows/cody.yml`**: Removed OPENCODE_MODEL environment variable (models only in opencode.json).

- **`.github/workflows/supervisor.yml`**: Added validate job with safety filter (same as main Cody workflow) to prevent unauthorized triggers.

- **`scripts/cody/checkout-task-branch.sh`**: Added security and test prefixes to branch search.

### Agent Instructions

- **`.opencode/agents/build.md`**: Added instruction to run `pnpm generate:importmap` after creating/modifying admin components.

### Test Updates

- **`tests/unit/scripts/cody/agent-runner.test.ts`**: Removed resolveModel tests (no longer relevant after model config removal).

- **`tests/unit/scripts/cody/bug-exposure.test.ts`**: Removed BUG-6 tests for resolveModel.

- **`tests/unit/scripts/cody/stage-hooks.test.ts`**: Updated test to expect error throw when build.md is missing Changes section.

## Quality

- TypeScript: PASS
- Lint: PASS (warnings only, no errors)
- Unit Tests: PASS (1864 tests)

## Issues Fixed (Except #1)

| Issue | Description | Status |
|-------|-------------|--------|
| #4 | Model mismatch (OPENCODE_MODEL vs opencode.json) | ✅ Fixed - removed runtime model selection |
| #5 | Missing optional files error in architect | ✅ Fixed - added graceful handling note |
| #6 | File detection race condition | ✅ Fixed - implemented stable size checks |
| #7 | Over-staging files in git-utils | ✅ Fixed - only stage task-specific files |
| #8 | Hardcoded OWNER/REPO in editComment | ✅ Fixed - uses GITHUB_REPOSITORY |
| #9 | No SKIP_HOOKS for impl stages | ✅ Fixed - added for all agent processes |
| #14 | No generate:importmap in build | ✅ Fixed - added to build.md instructions |
| #17 | Checkout missing prefixes | ✅ Fixed - added security/test |
| #18 | Supervisor no safety filter | ✅ Fixed - added validate job |
| #19 | Build validation only warning | ✅ Fixed - now throws error |

Note: Issue #1 (pre-commit hooks blocking commits) was NOT fixed per user request - should be fixed differently.
