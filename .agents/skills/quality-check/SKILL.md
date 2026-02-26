---
name: quality-check
description: Run all quality gates (typecheck, lint, format, tests) and provide detailed results
allowed-tools: Bash
---

# Quality Check

Run all project quality gates and provide comprehensive pass/fail report with actionable recommendations.

## What This Skill Does

1. Runs TypeScript type checking
2. Runs ESLint for code quality
3. Checks code formatting
4. Runs test suites
5. Generates detailed report with errors
6. Suggests fixes for common issues

## Workflow

### Step 1: Run All Quality Gates

Execute all checks in sequence, capturing output:

#### 1. TypeScript Check

```bash
pnpm -s tsc --noEmit
```

**Captures**:

- Type errors with file locations
- Missing type definitions
- Invalid type usage

#### 2. Lint Check

```bash
pnpm -s lint
```

**Captures**:

- Code style violations
- Potential bugs
- Best practice violations
- Unused variables/imports

#### 3. Format Check

```bash
pnpm -s format || pnpm -s prettier:check
```

**Captures**:

- Formatting inconsistencies
- Files that need formatting

#### 4. Run Tests

```bash
pnpm -s test
```

Or if integration tests exist:

```bash
pnpm -s test:int
```

**Captures**:

- Test failures
- Test errors
- Coverage information

### Step 2: Generate Report

Create structured report with results:

```markdown
# Quality Check Report

**Date**: YYYY-MM-DD HH:MM:SS
**Status**: [✅ PASSED | ❌ FAILED]

## Summary

- TypeScript: [✅ PASSED | ❌ FAILED]
- Lint: [✅ PASSED | ❌ FAILED]
- Format: [✅ PASSED | ❌ FAILED]
- Tests: [✅ PASSED | ❌ FAILED (X/Y passed)]

---

## TypeScript Check

**Status**: [✅ PASSED | ❌ FAILED]

[If failed, show errors with file:line references]

---

## Lint Check

**Status**: [✅ PASSED | ❌ FAILED]

[If failed, show violations grouped by severity]

---

## Format Check

**Status**: [✅ PASSED | ❌ FAILED]

[If failed, show files that need formatting]

---

## Tests

**Status**: [✅ PASSED | ❌ FAILED]

[If failed, show failing tests with error messages]

---

## Recommendations

[Actionable steps to fix failures]
```

### Step 3: Provide Fix Recommendations

For each type of failure, suggest fixes:

#### TypeScript Errors

Common fixes:

- Run `pnpm generate:types` if Payload types are stale
- Add missing type imports
- Fix type annotations
- Update tsconfig.json if needed

Example:

```
Error: Property 'title' does not exist on type 'Post'

Fix: Run `pnpm generate:types` to regenerate Payload types
```

#### Lint Errors

Common fixes:

- Run `pnpm lint:fix` for auto-fixable issues
- Remove unused imports/variables
- Fix ESLint rule violations
- Add necessary type annotations

Example:

```
Error: 'React' is defined but never used

Fix: Remove the unused import or use it:
- Remove: Delete `import React from 'react'`
- Use: Add JSX that requires React
```

#### Format Errors

Common fixes:

- Run `pnpm format:fix` or `pnpm prettier:write`
- Configure editor to format on save

Example:

```
Files with formatting issues:
- src/app/page.tsx
- src/components/Header.tsx

Fix: Run `pnpm format:fix` to auto-format all files
```

#### Test Failures

Common fixes:

- Review test error messages
- Update snapshots if needed
- Fix implementation bugs
- Update tests if API changed

Example:

```
FAIL tests/integration/users.test.ts
  × should create user

Expected: 201
Received: 400

Fix: Check validation - the request may be missing required fields
```

### Step 4: Offer Auto-Fix

Ask user if they want to auto-fix:

```
Found auto-fixable issues. Would you like me to:
1. Run auto-fix commands (lint:fix, format:fix)
2. Show manual fixes needed
3. Both
```

If user chooses auto-fix:

```bash
pnpm lint:fix && pnpm format:fix
```

Then re-run quality checks to verify fixes worked.

## Quality Gate Details

### TypeScript (`pnpm -s tsc --noEmit`)

**What it checks**:

- Type correctness
- Missing types
- Invalid type usage
- Compiler errors

**Common issues**:

1. Stale Payload types → Run `pnpm generate:types`
2. Missing type imports → Add import statements
3. `any` usage → Add proper types
4. Incorrect type assertions → Fix or add type guards

### Lint (`pnpm -s lint`)

**What it checks**:

- Code style (ESLint rules)
- Potential bugs
- Best practices
- React patterns
- Import ordering

**Common issues**:

1. Unused variables → Remove or prefix with `_`
2. Missing dependencies in hooks → Add to dependency array
3. Console statements → Remove or use proper logger
4. Missing return types → Add explicit return types

### Format (`pnpm -s format`)

**What it checks**:

- Consistent spacing
- Indentation
- Line length
- Semicolons/quotes
- Import sorting

**Common issues**:

1. Inconsistent indentation → Auto-fix with Prettier
2. Mixed quotes → Auto-fix with Prettier
3. Trailing whitespace → Auto-fix with Prettier

### Tests (`pnpm -s test`)

**What it checks**:

- Unit tests pass
- Integration tests pass
- Expected behavior matches actual

**Common issues**:

1. API changes → Update tests
2. Missing mocks → Add proper test setup
3. Async issues → Use proper async test patterns
4. Environment setup → Check test environment config

## Exit Codes

- **0**: All checks passed ✅
- **Non-zero**: One or more checks failed ❌

## Report Examples

### All Passing

```markdown
# Quality Check Report

**Date**: 2026-01-07 10:30:00
**Status**: ✅ PASSED

## Summary

- TypeScript: ✅ PASSED
- Lint: ✅ PASSED
- Format: ✅ PASSED
- Tests: ✅ PASSED (45/45 passed)

All quality gates passed! Code is ready for commit/PR.
```

### With Failures

```markdown
# Quality Check Report

**Date**: 2026-01-07 10:30:00
**Status**: ❌ FAILED

## Summary

- TypeScript: ❌ FAILED (3 errors)
- Lint: ✅ PASSED
- Format: ❌ FAILED (2 files need formatting)
- Tests: ❌ FAILED (43/45 passed)

---

## TypeScript Check

**Status**: ❌ FAILED (3 errors)
```

src/app/api/posts/route.ts:15:12 - error TS2339: Property 'title' does not exist on type 'Post'.

src/components/Header.tsx:23:18 - error TS2322: Type 'string | undefined' is not assignable to type 'string'.

src/lib/utils.ts:42:7 - error TS7006: Parameter 'data' implicitly has an 'any' type.

```

**Fix**:
1. Run `pnpm generate:types` to regenerate Payload types
2. Add type guard for undefined check in Header.tsx
3. Add explicit type annotation in utils.ts

---

## Format Check

**Status**: ❌ FAILED

Files needing formatting:
- src/app/api/posts/route.ts
- src/components/Header.tsx

**Fix**: Run `pnpm format:fix`

---

## Tests

**Status**: ❌ FAILED (43/45 passed)

```

FAIL tests/integration/posts.test.ts
× should create post with valid data

Expected: 201
Received: 400
Error: Validation failed: title is required

FAIL tests/unit/utils.test.ts
× should format date correctly

Expected: "2026-01-07"
Received: "01/07/2026"

```

**Fix**:
1. Check post creation test - ensure title is provided
2. Update date formatting test to match new format

---

## Recommendations

1. **Immediate**:
   - Run `pnpm generate:types`
   - Run `pnpm format:fix`

2. **Then fix**:
   - TypeScript errors in Header.tsx and utils.ts
   - Test failures in posts.test.ts and utils.test.ts

3. **Re-run**: `pnpm quality-check` (or use this skill again)
```

## Integration with /implement Skill

The `/implement` skill calls this skill as part of its workflow:

```markdown
Before committing:

1. Invoke /quality-check skill
2. If failures, fix issues
3. Re-run /quality-check
4. Only commit when all checks pass
```

## Quick Fixes Cheat Sheet

| Issue            | Command                   | Alternative           |
| ---------------- | ------------------------- | --------------------- |
| Stale types      | `pnpm generate:types`     | -                     |
| Lint errors      | `pnpm lint:fix`           | Manual fixes          |
| Format errors    | `pnpm format:fix`         | `pnpm prettier:write` |
| Test failures    | Fix code/tests            | Update snapshots      |
| Import map stale | `pnpm generate:importmap` | -                     |

## Common Workflows

### Pre-Commit Check

```bash
# Run quality check before committing
/quality-check

# If passed:
git add .
git commit -m "feat: add feature"

# If failed:
# Fix issues, then re-run quality check
```

### Pre-PR Check

```bash
# Ensure all quality gates pass before PR
/quality-check

# All must pass before creating PR
```

### CI Debugging

```bash
# CI failed? Run locally to debug
/quality-check

# Reproduces same checks as CI
```

## Automated Script

This skill includes an automated script that runs all quality gates and generates a structured report.

### Usage

```bash
# Run all checks
npx tsx .agents/skills/quality-check/scripts/quality-check.ts

# Run with auto-fix
npx tsx .agents/skills/quality-check/scripts/quality-check.ts --fix

# Skip tests for faster check
npx tsx .agents/skills/quality-check/scripts/quality-check.ts --skip-tests

# Output to file
npx tsx .agents/skills/quality-check/scripts/quality-check.ts --output report.md

# JSON output (for programmatic use)
npx tsx .agents/skills/quality-check/scripts/quality-check.ts --json
```

### Options

| Option            | Description                                 | Default     |
| ----------------- | ------------------------------------------- | ----------- |
| `--fix`           | Run lint:fix and format:fix before checking | false       |
| `--skip-tests`    | Skip test suite                             | false       |
| `--output <file>` | Write report to file                        | stdout      |
| `--json`          | Output JSON instead of markdown             | false       |
| `--tsc <cmd>`     | Override tsc command                        | auto-detect |
| `--lint <cmd>`    | Override lint command                       | auto-detect |
| `--format <cmd>`  | Override format command                     | auto-detect |
| `--test <cmd>`    | Override test command                       | auto-detect |

The script auto-detects commands from `package.json` scripts. Use `--tsc`, `--lint`, etc. to override.

### Exit Codes

- `0` - All checks passed
- `1` - One or more checks failed

## Success Criteria

- [ ] All quality gates executed
- [ ] Results captured and displayed
- [ ] Clear pass/fail status shown
- [ ] Specific errors/failures listed with locations
- [ ] Actionable fix recommendations provided
- [ ] User understands what needs fixing

## Performance

Typical execution times:

- TypeScript: 5-15 seconds
- Lint: 3-10 seconds
- Format: 1-3 seconds
- Tests: 10-60 seconds (depends on test count)

**Total**: ~20-90 seconds for full check

## Related Documentation

- Project setup: [AGENTS.md](../../../AGENTS.md)
- CI/CD: `.github/workflows/`
- Test patterns: `tests/`
