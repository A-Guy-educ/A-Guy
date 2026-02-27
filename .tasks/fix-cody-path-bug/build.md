# Build Agent Report: fix-cody-path-bug

## Changes

- **`scripts/cody/stage-prompts.ts`** - Changed relative paths to absolute paths in agent prompts to fix OpenCode path interpretation bug with task IDs containing hyphens
  - `buildStagePrompt`: Changed `taskDir` from `.tasks/${taskId}` to absolute path using `path.join(process.cwd(), '.tasks', taskId)`
  - `stageInstructions`: Updated `specOnlyInstructionTemplate` to use absolute paths instead of `.tasks/{TASK_ID}/`

- **`scripts/cody/handlers/agent-handler.ts`** - Fixed output file path to use `stageOutputFile` instead of hardcoded `def.name + '.md'`
  - This ensures the correct output file is expected (e.g., `task.json` for taskify stage instead of `taskify.md`)

## Tests Written

- Updated existing test file: `tests/unit/scripts/cody/stage-prompts.test.ts` to handle absolute paths

## Root Cause

Two issues were causing the pipeline to fail:

1. **Path interpretation bug**: OpenCode was misinterpreting relative paths with task IDs containing hyphens (e.g., `260224-auto-22`). Error showed:
   ```
   external_directory (/home/runner/work/A-Guy/A-Guy224-auto-22/.tasks/260/*); auto-rejecting
   ```

2. **Wrong output file detection**: The agent-handler was using a hardcoded `${def.name}.md` instead of consulting `STAGE_OUTPUT_MAP`. For the taskify stage, this meant expecting `taskify.md` when the agent actually writes `task.json`.

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: PASS (2322 tests pass)
