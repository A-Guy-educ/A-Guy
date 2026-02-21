# TASK-21: Quality Gates & Final Cleanup

## Summary
Ensure all quality gates pass, add GH_TOKEN to .env.example, and verify the complete dashboard works end-to-end.

## Task Type
implement_feature

## Dependencies
- All previous tasks

## Requirements

### R1: TypeScript
- Run `pnpm tsc --noEmit`
- Fix ALL type errors
- No `any` types (use `unknown` where needed)

### R2: Linting
- Run `pnpm lint`
- Fix all lint errors
- Run `pnpm lint:fix` for auto-fixable issues

### R3: Formatting
- Run `pnpm format:fix`
- Ensure all new files match project formatting

### R4: Environment variables
- Add to `.env.example`:
```
# Cody Operations Dashboard
CODY_DASHBOARD_SECRET=
GH_TOKEN=
CODY_DASHBOARD_SECRET=
```

### R5: Existing tests
- Run `pnpm vitest run tests/unit/lib/cody/` — all new tests pass
- Run `pnpm vitest run` — no regression in existing tests

### R6: Import map
- Run `pnpm generate:importmap` if any admin components were registered

### R7: Smoke test checklist
Manual verification:
- [ ] `/cody` loads
- [ ] Auth redirects work
- [ ] Board shows with columns
- [ ] Board switcher works
- [ ] Clicking card shows detail
- [ ] Pipeline visualization renders
- [ ] Chat opens and responds
- [ ] Chat can list tasks
- [ ] Create task dialog works
- [ ] Action buttons function (approve, rerun, abort)

## Files to Modify
- `.env.example` (MODIFIED — add GH_TOKEN)
- Various files (type fixes, lint fixes, format fixes)

## Acceptance Criteria
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm format` exits 0 (no changes needed)
- [ ] `pnpm vitest run tests/unit/lib/cody/` all pass
- [ ] `pnpm vitest run` no regression
- [ ] GH_TOKEN in .env.example
- [ ] All smoke test items checked
