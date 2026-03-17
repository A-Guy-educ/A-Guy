# Build Agent Report: Cody CLI System Test

## Changes

- **Created CLI test runner**: `scripts/cody-cli-test/run.ts` - Main entry point for running CLI system tests
- **Created CLI test scenarios**:
  - `scripts/cody-cli-test/scenarios/01-status-mode.ts` - Tests `--mode=status` with a valid task
  - `scripts/cody-cli-test/scenarios/02-help-mode.ts` - Tests `--help` flag
  - `scripts/cody-cli-test/scenarios/03-error-handling.ts` - Tests CLI behavior without task-id
- **Created CLI test lib**: `scripts/cody-cli-test/lib/index.ts` - Shared utilities (runCodyCli, assertCliSuccess, assertCliFailure)
- **Created GitHub workflow**: `.github/workflows/cody-cli-test.yml` - CI workflow to run CLI tests
- **Created inspector plugin**: `scripts/inspector/plugins/cody/cli-test/index.ts` - Daily trigger for CLI tests
- **Updated `package.json`**: Added `cody:cli-test` and `cody:cli-test:run` scripts
- **Updated inspector**: Added `cliTestPlugin` to inspector index.ts

## Tests Written

- All 3 scenarios pass locally:
  - ✅ 01-status-mode: Tests status mode with valid status.json
  - ✅ 02-help-mode: Tests help output
  - ✅ 03-error-handling: Tests auto-generation of task ID

## Usage

```bash
# Run CLI test locally
pnpm cody:cli-test

# Run specific scenario
pnpm cody:cli-test:run

# Run via GitHub workflow
gh workflow run cody-cli-test.yml

# Or trigger via inspector (runs daily)
```

## Quality

- TypeScript: PASS
- Lint: PASS
