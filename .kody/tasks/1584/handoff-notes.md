CI failure on PR #1584 was a Prettier formatting violation in CHANGELOGOG.md.

Root cause: pnpm format:check failed on CHANGELOGOG.md due to Prettier detecting style violations.

Fix: Already applied in a prior commit on this branch — prettier --write CHANGELOGOG.md was run and committed. The file now passes format:check.

Current state: All quality gates pass — typecheck ✅, lint ✅, format:check ✅. No code changes were needed from this session.
