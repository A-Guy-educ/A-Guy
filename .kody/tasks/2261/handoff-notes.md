# Task 2261 - Merge Conflict Resolution

## What was done
Resolved one asymmetric merge conflict in `.github/workflows/doc-link-fixer.yml`.

## Conflict details
- **File**: `.github/workflows/doc-link-fixer.yml`
- **Type**: Asymmetric — HEAD kept `version: 10.33.0` pin; origin/dev removed it (commit `e97a29323` titled "fix(ci): align pnpm version in doc-link-fixer workflow with package.json")
- **Resolution**: Took `origin/dev` side — removed the version pin so the workflow uses the pnpm version declared in `package.json`

## Why origin/dev wins
Commit `e97a29323` (on `origin/dev`) is the fix for the same CI issue (aligning pnpm version with package.json). The HEAD branch was based on a commit before that fix was applied. Removing the hardcoded version is the correct behavior — it lets the workflow use whatever pnpm version `package.json` specifies, avoiding version drift.
