# Cody CI Pipeline Fixes

Date: 2026-02-25
Issue: https://github.com/A-Guy-educ/A-Guy/issues/521

## Summary

Fixed multiple CI infrastructure issues that prevented the Cody pipeline from running.

## Fixes Applied

### 1. Parse Job Missing pnpm Setup

- **Problem**: `pnpm: command not found` in parse job
- **Fix**: Added pnpm/setup, node setup, and dependency install to parse job in `.github/workflows/cody.yml`

### 2. Husky Scripts Failing

- **Problem**: Sparse checkout doesn't include `.husky` directory, causing `prepare` script to fail
- **Fix**: Added `--ignore-scripts` flag to `pnpm install` in parse job

### 3. Checkout-task-branch Running Before pnpm Available

- **Problem**: Script was trying to run before pnpm was installed
- **Fix**: Reordered steps - setup pnpm before checkout-task-branch step in orchestrate job

### 4. ESM Module Errors

- **Problem**: `require is not defined in ES module scope`
- **Fix**: Changed `require.main === module` to `import.meta.url === file://${process.argv[1]}` in:
  - `scripts/cody/parse-inputs.ts`
  - `scripts/cody/checkout-task-branch.ts`
  - `scripts/cody/parse-safety-supervisor.ts`

### 5. CI Environment Variables Not Read

- **Problem**: Pipeline was ignoring CI workflow inputs (TASK_ID, MODE, etc.) and auto-generating task IDs
- **Fix**: Added environment variable fallback in `parseCliArgs()` function in `scripts/cody/cody-utils.ts`

## Result

Cody pipeline now runs successfully in CI via `@cody` command on issues.
