## Merge Conflict Resolution — PR #2493

Resolved 21 conflicted files in `src/infra/utils/` that resulted from merging `origin/dev` into `2492-srcinfrautils-thin-in-code-documentation`.

**All conflicts were asymmetric JSDoc header only** — the actual code was identical on both sides. The HEAD (PR) side had richer `@ai-summary` and `@pattern` documentation; the `origin/dev` side had different (often shorter or different-domain) headers. Took HEAD's headers throughout since the PR's purpose is adding these documentation headers.

No conflict markers remain. Lint and format checks pass. No functional changes to any file.
