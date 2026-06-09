# CI Fix for PR #1588

## What was failing

`pnpm format:check` step in the CI workflow was failing because `CHANGELOGOG.md` had Prettier formatting issues — specifically a malformed link (`([#2117\_(` instead of `([#2117](`)).

## What was done

Ran `pnpm format -- CHANGELOGOG.md` which reformatted the file correctly. The issue was a typo in the changelog entry for PR #2113 where the link format was broken.

## Verification

- `pnpm format:check` now passes (no output from grep for CHANGELOGOG.md)
- `mcp__kody-verify__verify` returned `ok: true` with all gates passing

## Notes

- The malformed URL in the CHANGELOGOG.md was introduced by a previous commit on this branch
- No other files were changed — the fix was minimal and targeted
