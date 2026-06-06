Resolved merge conflicts in two .kody/reports/ files from `git merge origin/dev` into PR #2350.

Both files are auto-generated duty/health report snapshots. Conflict was symmetric (same structure, different cycle numbers/hours-since values) — resolved by taking origin/dev's more current data (Cycle 10 vs Cycle 4; higher hour counts in health-check). No conflict markers remain. No quality issues introduced (reports are purely informational).
