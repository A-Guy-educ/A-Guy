The CI failure on PR #1584 was a formatting issue, not a code bug.

**Root cause**: `kody.config.json` failed `pnpm format:check` (Prettier formatting violation).
**Fix**: Ran `prettier --write kody.config.json` — single-file formatting change.

The CI steps passed in order: typecheck ✅, lint ✅, format:check ❌ → fixed with prettier write.

The PR also includes unrelated changes to `src/app/api/admin/dashboard-metrics/route.ts` (null guard on activityLog entries) and a new integration test — those are separate from this CI fix.
