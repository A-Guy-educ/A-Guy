Resolved merge conflicts from `git merge origin/dev` into branch `2138-eliminate-horizontal-scroll-across-the-site-mobile` for PR #2153.

Two conflicted files:

1. `.kody/last-run.jsonl` — JSONL session log. Content conflict (HEAD: 178 lines session 86afddb9, origin/dev: 78 lines session 62f59). Took HEAD version since it's the PR branch state. Note: The 26 `<<<<<<<` strings in this file are embedded inside JSON message content from prior session logs — not actual conflict markers, just logged text.

2. `.kody/reports/duty-review.md` — Conflict markers between Cycle 10 (HEAD) and Cycle 11 (origin/dev). Took origin/dev's Cycle 11 since it is the more recent cycle.

No application code or logic was modified.
