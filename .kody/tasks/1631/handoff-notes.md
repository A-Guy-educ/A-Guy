Fixed CI failure in PR #1631 (branch 1621-export-lesson-ordered-exercises-as-json-from-admin).

The "Fast Gate" CI step was failing on Prettier formatting check for `CHANGELOGOG.md`. Ran `pnpm prettier --write CHANGELOGOG.md` to fix the formatting. Verified all quality gates pass (typecheck, lint, format, tests).
