Resolved 4 merge conflicts between chore/auto-resolve-deterministic-tick and origin/dev.

- .kody/last-run.jsonl: Took HEAD (current session runtime log, 75 lines). origin/dev had an older session snapshot.
- .kody/reports/duty-review.md: Took origin/dev — Cycle 14 is a later cycle than Cycle 13, with updated duty assignments and staff column corrections.
- .kody/reports/health-check.md: Took origin/dev — lower "hours since last update" figures indicate more recent data.
- tests/int/lesson-duplication-orchestrator.int.spec.ts: Removed the orphaned `beforeEach(() => { h.vgCallCount = 0 })` block from HEAD. The variable `h.vgCallCount` is undefined; the correct reset is `mockState.reset()` already present at line 144.
