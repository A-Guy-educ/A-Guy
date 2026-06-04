CI failure on PR #1584 was a Prettier formatting violation in CHANGELOGOG.md.

Root cause: `pnpm format:check` failed on CHANGELOGOG.md due to Prettier detecting style violations (trailing whitespace, line endings, etc.).

Fix: Already applied in commit 7cef8a205 ("chore: fix(ci): format CHANGELOGOG.md with Prettier") which ran `prettier --write CHANGELOGOG.md`. This commit is an ancestor of current HEAD 193f7e071.

Current state: All quality gates pass — typecheck ✅, lint ✅, format:check ✅. No code changes were needed from this session; the failure was already resolved before this investigation.

Note: The failing workflow run (26930186620) was triggered at 04:14 UTC on June 4, 2026. The fix commit was applied at 04:18 UTC same day, before the current HEAD (193f7e071).
