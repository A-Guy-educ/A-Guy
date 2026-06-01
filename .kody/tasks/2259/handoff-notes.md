## Merge Conflict Resolution for #2259

Resolved the single conflict in `.github/workflows/ai-docs-refresh.yml`:

- **Conflict**: `pnpm/action-setup` version — HEAD had `10.33.0` (exact pin), `origin/dev` had `10` (major version only).
- **Resolution**: Kept HEAD's `10.33.0` — a CI refresh PR should retain the pinned version from the PR branch rather than the looser dev constraint.
- **No other conflicted files** — only this one workflow file had merge conflicts.

The wrapper will now complete the merge commit.