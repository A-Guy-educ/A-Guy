Resolved merge conflicts from `git merge origin/dev` into branch `2138-eliminate-horizontal-scroll-across-the-site-mobile` for PR #2153.

Three conflicted files:

1. `.kody/last-run.jsonl` — JSONL operational log. Conflict markers appeared as embedded text within JSON strings (message content from prior session). File validates as correct JSONL. No structural changes needed; content from HEAD session preserved.

2. `.kody/reports/duty-review.md` — HEAD had Cycle 10 (stale), origin/dev had Cycle 14 (current). Took origin/dev version: more accurate staff assignments (cto/platform/ceo vs kody/ux-designer/coo), updated cadence values, and the duty-review row now shows "pending" instead of missing.

3. `.kody/reports/health-check.md` — HEAD had stale hour counts (609h, 449h, 452h, 1001h), origin/dev had fresh counts (585h, 425h, 428h, 977h). Took origin/dev version. Also normalized section headers from `kody:running`/`kody:failed` to `Running`/`Failed` to match origin/dev style.

No code files or application logic were touched — all conflicts were in kody operational/reporting files.
