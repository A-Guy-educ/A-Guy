# Merge Conflict Resolution — #2493

Resolved one conflict in `.kody/reports/duty-review.md`.

**Conflict type:** Asymmetric — HEAD (PR branch) had older Cycle 12 data with missing cadences and mixed staff assignments; `origin/dev` had newer Cycle 14 data with all cadences filled and staff uniformly set to `cto`/`qa`.

**Resolution:** Took `origin/dev` version. This is an automated duty-review report that gets regenerated; the dev branch had the more complete and current state.

**Files touched:** `.kody/reports/duty-review.md` — conflict markers removed, content replaced with origin/dev version.
