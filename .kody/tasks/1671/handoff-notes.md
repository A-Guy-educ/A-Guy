Fixed CI failure on PR #1671 (branch 1665-smarter-section-selector-for-variations).

Root cause: `CHANGELOGOG.md` had Prettier formatting violations. The `pnpm format:check` step in CI was failing because the file was not formatted.

Fix: Ran `pnpm format -- "CHANGELOGOG.md"` to apply Prettier formatting. Verified with `pnpm format:check` and full quality gates — all pass.
