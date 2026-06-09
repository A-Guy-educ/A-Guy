## Fix for #2552: Delete changes not autosaved

**Root cause**: `Lessons` collection lacked `versions.drafts.autosave` config. The component correctly calls `setModified(true)` after delete (fix from #2291), but Payload only sends autosave PATCH requests when the collection has autosave configured.

**Fix applied**: Added `versions.drafts.autosave` config to `src/server/payload/collections/Lessons.ts`, mirroring the pattern from Posts and Pages collections (interval: 100ms, schedulePublish: true, maxPerDoc: 50).

**Files changed**:
- `src/server/payload/collections/Lessons.ts` — added `versions.drafts.autosave` block
- `src/payload-types.ts` — regenerated after schema change
- `tests/unit/collections/lessons-autosave-config.test.ts` — new test validating the config

**Test**: `pnpm exec vitest run tests/unit/collections/lessons-autosave-config.test.ts --config ./vitest.config.unit.mts` — 4 tests, all pass.

**Verify**: `pnpm ci:local` — all gates green.
