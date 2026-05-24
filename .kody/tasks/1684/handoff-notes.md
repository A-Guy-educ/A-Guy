## Fix Summary

**Root cause**: `kody.config.json` had Prettier formatting issues (CI step "Fast Gate / Check formatting with Prettier").

**Fix**: Ran `pnpm format --write kody.config.json` to auto-format the file. Verified with `pnpm format:check` (All matched files use Prettier code style!) and `mcp__kody-verify__verify` (ok: true).

**Files touched**: Only `kody.config.json` — no code changes, just formatting.

**Why this happened**: Likely a merge conflict resolution or manual edit left the JSON with incorrect indentation or line endings inconsistent with Prettier's expectations.

No follow-up work needed.
