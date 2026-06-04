CI failure on PR #1584 was a Prettier formatting violation in CHANGELOGOG.md.

**Root cause**: pnpm format:check failed on CHANGELOGOG.md due to formatting differences (Prettier detected style violations).

**Fix**: The fix was already applied in commit 7cef8a205 ("chore: fix(ci): format CHANGELOGOG.md with Prettier"), which ran `prettier --write CHANGELOGOG.md`. This commit is an ancestor of the current HEAD (c1378fcb1), so the issue is already resolved.

**Current state**: All quality gates pass — typecheck ✅, lint ✅, format:check ✅.

**Note**: The failing workflow run (26930186620) was triggered at 04:14 UTC on June 4, 2026, which was before the fix commit at 04:18 UTC. A subsequent merge (c1378fcb1 at 06:08 UTC) brought the fix into the current branch.