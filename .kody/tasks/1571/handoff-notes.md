## Merge Conflict Resolution for PR #1571

**Conflict:** `.github/workflows/preview-validation.yml` — asymmetric: `origin/dev` deleted the file (chore(ci): remove redundant preview workflows), our branch had a modified version (230 lines vs 229 in base).

**Resolution:** Accepted dev's deletion by running `git rm .github/workflows/preview-validation.yml`.

**Rationale:** The PR feature (Cmd/Ctrl+Enter to send message in admin chat) is a UI feature completely unrelated to GitHub Actions CI workflows. Dev intentionally removed this file as redundant CI cleanup. No functional dependency exists between the PR feature and this workflow file.

**No remaining conflicts** — all unmerged paths resolved.

## CI Format Check Fix (2026-06-05)

**Failure:** `format:check` step failed — `CHANGELOGOG.md` had Prettier formatting issues.

**Fix:** Ran `pnpm format -- CHANGELOGOG.md` — the file was reformatted and the format check now passes locally.

**Verification:** `mcp__kody-verify__verify` returned `ok: true` with no failures.
