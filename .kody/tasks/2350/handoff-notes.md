Resolved merge conflict in `.kody/reports/duty-review.md` — the only conflicted file.

The conflict was asymmetric: HEAD had Cycle 4 (14 broken, 11 warn, 0 healthy) while origin/dev had Cycle 13 (1 healthy, 10 warn, 15 broken). Both are snapshots of the same duty-review report at different points in time. Took origin/dev since it's the more recent cycle and includes the `cleanup-branches` duty correctly showing as healthy.

No code changes beyond conflict markers removal.
