# PR-C: Cody Dashboard — Integration + Quality (SEQUENTIAL)

**Branch**: `feat/cody-dash-integration`
**Created**: 2026-02-21
**Status**: Planned
**Runs after**: PR-A AND PR-B both merged
**Consolidates**: TASK-21 + integration wiring

---

## Summary

Lightweight cleanup PR that runs after both PR-A (backend) and PR-B (UI) have merged. Dedupes any shared files, wires the real APIs into the UI (if needed), runs all quality gates, and performs a smoke test. Estimated: 2-3 hours.

---

## Step 1: Dedupe Shared Files

Both PR-A and PR-B create identical files in `src/lib/cody/`. After both merge, verify they're consistent:

### Files to check

- `src/lib/cody/types.ts` — should be identical. If any divergence, keep PR-A's version (canonical).
- `src/lib/cody/constants.ts` — same.
- `src/lib/cody/utils.ts` — same.
- `src/lib/cody/auth.ts` — same.
- `src/app/api/cody/auth/route.ts` — both PRs create this. Keep the one with more features (PR-A likely has fuller implementation).

### Merge conflict resolution

If git merge conflicts arose, resolve by:

1. Keeping PR-A's `src/lib/cody/*` files (they're the canonical data layer)
2. Keeping PR-B's `src/ui/admin/*` files (they're the canonical UI)
3. For `package.json`: combine all deps from both PRs

---

## Step 2: Verify API Wiring

After both PRs merge, the UI should automatically work with the real APIs (they share the same endpoint paths). Verify:

- [ ] `/api/cody/tasks` returns real task data
- [ ] `/api/cody/boards` returns boards
- [ ] `/api/cody/pipeline/{taskId}` returns pipeline status
- [ ] `/api/cody/workflows` returns workflow runs
- [ ] `/api/cody/prs` returns PRs
- [ ] `/api/cody/tasks/{taskId}/actions` handles all 9 actions
- [ ] CopilotKit chat actions call real APIs

If PR-B used mock data or stubs, replace them with real API calls here.

---

## Step 3: Board Mapper Integration

PR-B's `KanbanBoard` component may use inline column derivation logic or import from `src/lib/cody/board-mapper.ts`. After PR-A merges:

- Verify `import { organizeBoard, getVisibleColumns } from '@/lib/cody/board-mapper'` works
- Verify `import { deriveColumn } from '@/lib/cody/board-mapper'` is used in API routes
- Remove any duplicate logic from UI components

---

## Step 4: TypeScript (from TASK-21 R1)

```bash
pnpm tsc --noEmit
```

- Fix ALL type errors
- No `any` types (use `unknown` where needed)
- Verify imports between PR-A and PR-B code work correctly

---

## Step 5: Linting (from TASK-21 R2)

```bash
pnpm lint
pnpm lint:fix
```

- Fix all lint errors across all new files

---

## Step 6: Formatting (from TASK-21 R3)

```bash
pnpm format:fix
```

- Ensure all new files match project formatting

---

## Step 7: Environment Variables (from TASK-21 R4)

Add to `.env.example`:

```
# Cody Operations Dashboard
CODY_DASHBOARD_SECRET=
GH_TOKEN=
```

---

## Step 8: Tests (from TASK-21 R5)

```bash
# New tests
pnpm vitest run tests/unit/lib/cody/

# No regression
pnpm vitest run
```

---

## Step 9: Import Map (from TASK-21 R6)

```bash
pnpm generate:importmap
```

Only needed if admin components were registered in Payload config (unlikely for this dashboard, but check).

---

## Step 10: Smoke Test (from TASK-21 R7)

Manual verification checklist:

- [ ] `/cody` loads
- [ ] `/cody/login` shows login form
- [ ] Wrong password shows error
- [ ] Correct password redirects to dashboard
- [ ] Auth redirects work (unauthenticated -> login)
- [ ] Kanban board shows with correct columns
- [ ] Tasks appear in correct columns based on state
- [ ] Board switcher tabs work
- [ ] Clicking card shows task detail panel
- [ ] Pipeline visualization renders with correct stage states
- [ ] Supervisor log shows retry timeline (for tasks with retries)
- [ ] Chat panel opens via toggle button
- [ ] Chat responds to messages
- [ ] Chat can list tasks ("what tasks are building?")
- [ ] Chat can get task status ("status of 260219-auto-98")
- [ ] Create task dialog opens (via button or `n` key)
- [ ] Create task submits and refreshes board
- [ ] Action buttons visible based on task state:
  - Approve/Reject for gate-waiting
  - Rerun for failed
  - Abort for building
- [ ] Polling adjusts: 5s when building, 30s when idle
- [ ] Loading skeletons show during fetches
- [ ] Error states show for API failures (disconnect network to test)
- [ ] Keyboard shortcuts work (n, a, r, Escape, ?)
- [ ] No console errors
- [ ] Responsive layout works on narrow screens

---

## Files Summary

### Modified Files (~5-10)

- `.env.example` (add env vars)
- Various files for type fixes, lint fixes, format fixes
- Possibly `src/ui/admin/CodyDashboard/index.tsx` (wiring adjustments)
- Possibly `src/lib/cody/types.ts` (dedup if needed)

### No New Files Expected

This PR is cleanup and verification only.

---

## Acceptance Criteria

- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm format` exits 0 (no changes needed)
- [ ] `pnpm vitest run tests/unit/lib/cody/` all pass
- [ ] `pnpm vitest run` no regression
- [ ] `.env.example` has `GH_TOKEN` and `CODY_DASHBOARD_SECRET`
- [ ] All smoke test items checked
- [ ] No merge artifacts or duplicate code remaining

## Estimated Effort

- 2-3 hours
- Mostly verification, not implementation
- Only code changes are fixes from quality gates + minor wiring adjustments
