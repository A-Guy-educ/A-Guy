Resolved merge conflict in `.kody/reports/health-check.md` by taking the `origin/dev` side.

The conflict was asymmetric in a trivial sense: both sides listed the same four stale issues (#1583, #1563, #1562, #1236), but with different hour counts. The `origin/dev` branch had fresher counts (660h/499h/502h/1052h) from a more recent duty-review refresh compared to HEAD (609h/449h/452h/1001h). Since health-check.md is a report snapshot refreshed by duty-review, the more current values were preserved.
