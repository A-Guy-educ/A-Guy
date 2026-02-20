# Build Agent Report: orchestrator-bugfix

## Branch

- **Branch:** dev

## Changes

- **scripts/orchestrator-utils.ts**: Fixed `escapeShell` function to escape shell metacharacters (backticks, dollar signs, backslashes) to prevent command injection when posting GitHub issue comments with task IDs wrapped in backticks
- **scripts/orchestrator.ts**: Added `SKIP_HOOKS: '1'` to the environment passed to opencode agent spawns to bypass commitlint during spec pipeline stages where agents may create non-conventional commits

## Quality

- TypeScript: PASS
- Lint: PASS
- Build: PASS
- Unit Tests: PASS

## Commits

- 748fbaaf fix(orchestrator): Escape shell metacharacters in comments and skip hooks for agents
