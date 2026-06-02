The CI failure on PR #1584 was a Prettier formatting violation in kody.config.json.

**Root cause**: pnpm format:check failed on kody.config.json due to non-standard array formatting (single-element arrays were multi-line) and a missing trailing newline.

**Fix**: Ran `prettier --write kody.config.json` — normalized array formatting to Prettier's preferred single-line style for single-element arrays and ensured a trailing newline.

**Changes**: Only kody.config.json was modified; no code logic was touched.

CI steps pass in order: typecheck ✅, lint ✅, format:check ✅.
