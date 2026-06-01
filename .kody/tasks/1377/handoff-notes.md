Fixed CI failure for PR #1377 (docs: Document route-handler patterns).

**Root cause:** `src/payload-types.ts` was stale — schema changes were committed without regenerating types, causing the typecheck CI step to fail.

**Fix applied:** Ran `pnpm generate:types` and committed the regenerated types (commit 0e15e36e2). Pushed to `docs/testing-patterns-for-route-handlers` branch.

**Verification:** Quality gates pass on second attempt (attempt 1 failed on stale types, attempt 2 succeeded after regeneration).

No documentation content was changed — only the generated types file.