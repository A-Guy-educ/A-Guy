## Fix for Issue #2608 — Kody command smoke bug

**Bug:** `docs/kody-command-bug-smoke.md` was missing.

**Repro:** `tests/int/kody-command-bug-smoke.int.spec.ts` — two tests asserting the file exists and contains "2026-06-12". Both failed before the fix.

**Root cause:** The `@kody bug` command was initially unrecognized (comment shows "I don't recognize `bug`"), so the smoke file was never created.

**Fix:** Created `docs/kody-command-bug-smoke.md` with one line: "Bug command ran on 2026-06-12."

**Files:**
- `docs/kody-command-bug-smoke.md` — new (1 line)
- `tests/int/kody-command-bug-smoke.int.spec.ts` — new smoke test (2 assertions)

**Verification:** `pnpm exec vitest run tests/int/kody-command-bug-smoke.int.spec.ts` — 2 tests pass. Full quality gates pass (attempt 1).