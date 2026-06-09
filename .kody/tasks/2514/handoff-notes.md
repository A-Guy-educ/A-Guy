Resolved a single symmetric conflict in .kody/reports/duty-review.md.

The conflict was between two duty review snapshots: HEAD (PR branch, Cycle 12) and origin/dev (Cycle 16). Both sides had the same table structure and same 25 rows — only the cycle number, cadence values, and some note text differed. origin/dev had the newer/authoritative data, so it was taken as-is.

No code files were touched; no quality gates needed to be run.
