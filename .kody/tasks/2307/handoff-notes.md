# Task 2307: Fix CI format check failure on PR #2307

## What was failing

The CI `format:check` step was failing because `kody.config.json` had Prettier formatting issues.

## What was done

Ran `pnpm format -- "kody.config.json"` to format the file with Prettier. This resolved the `format:check` failure.

## Verification

After the fix:
- `pnpm format:check` — passes (All matched files use Prettier code style!)
- `pnpm typecheck` — passes (types up to date)
- `pnpm lint` — passes (only pre-existing warning in LatexDocumentViewer, unrelated to this PR)
- `pnpm run test:unit` — 251 test files pass (3343 tests)
- `mcp__kody-verify__verify` — ok: true, all gates green

## Notes

The PR itself (adding autosave to LessonBlocksField delete operations) was correctly implemented by a previous session. The CI failure was only due to `kody.config.json` formatting drift, not any code issue in the PR changes.
