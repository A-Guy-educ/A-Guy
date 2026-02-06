# Doc Link Fixer - Failure Report

Generated: 2026-01-24T12:17:29.862Z

## Summary

- **Broken Doc Links**: 28 (these will cause failure in strict mode)
- **Missing Code References**: 82 (warning only)
- **Local Path Links**: 2 (warning only)

## By Source File

### docs/plans/doc-link-fixer-improvement.md (8 broken links)

- `scripts/doc-link-fixer.ts:227` → `docs/plans/scripts/doc-link-fixer.ts:227`
- `scripts/doc-link-fixer.ts:57` → `docs/plans/scripts/doc-link-fixer.ts:57`
- `${href0}` → `docs/plans/${href0}`
- `${href1}` → `docs/plans/${href1}`
- `${newHref}` → `docs/plans/${newHref}`
- `${newHref}` → `docs/plans/${newHref}`
- `${href1}` → `docs/plans/${href1}`
- `scripts/doc-link-fixer.ts:156` → `docs/plans/scripts/doc-link-fixer.ts:156`

### .tasks/lesson-type-tabs/plan.md (4 broken links)

- `<../../src/app/(frontend` → `.tasks/lesson-type-tabs/src/app/(frontend`
- `<../../src/app/(frontend` → `.tasks/lesson-type-tabs/src/app/(frontend`
- `<../../src/app/(frontend` → `.tasks/lesson-type-tabs/src/app/(frontend`
- `<../../src/app/(frontend` → `.tasks/lesson-type-tabs/src/app/(frontend`

### docs/ai/README-AUTOMATION.md (3 broken links)

- `path` → `docs/ai/path`
- `../../src/contracts/README.md` → `src/contracts/README.md`
- `../../src/contracts/README.md` → `src/contracts/README.md`

### docs/features/homepage-redesign/spec.md (2 broken links)

- `../../AGENTS.md` → `docs/AGENTS.md`
- `../../src/server/payload/collections/` → `docs/src/server/payload/collections`

### docs/access-control/README.md (1 broken links)

- `../../src/server/payload/access/` → `src/server/payload/access`

### docs/ai/quick-reference/CHEAT-SHEET.md (1 broken links)

- `../../tests/README.md` → `docs/tests/README.md`

### docs/block-rendering/README.md (1 broken links)

- `../../src/components/exercise/README.md` → `src/components/exercise/README.md`

### docs/contracts/IMPLEMENTATION.md (1 broken links)

- `../../src/contracts/examples/` → `src/contracts/examples`

### docs/course-hierarchy/README.md (1 broken links)

- `../src/lib/queries/` → `docs/src/lib/queries`

### docs/exercises/MANUAL_VERIFICATION.md (1 broken links)

- `../contracts/examples/` → `docs/contracts/examples`

### docs/exercises/README.md (1 broken links)

- `../../src/contracts/examples/` → `src/contracts/examples`

### docs/exercises/STAGE_0_SUMMARY.md (1 broken links)

- `../contracts/examples/` → `docs/contracts/examples`

### docs/features/chat-context/spec.md (1 broken links)

- `../../src/lib/ai/` → `docs/src/lib/ai`

### docs/features/chat-context/test-coverage-analysis.md (1 broken links)

- `../../src/lib/ai/prompts/summary-system-prompt.md#L10` → `docs/src/lib/ai/prompts/summary-system-prompt.md#L10`

### docs/plans/code-quality-boundaries/implementation-plan.md (1 broken links)

- `docs/architecture/ZONE-BOUNDARIES.md` → `docs/plans/code-quality-boundaries/docs/architecture/ZONE-BOUNDARIES.md`

## Warnings (non-blocking)

### Missing Code References

- `src/lib/analytics/contracts/schemas.ts` in docs/plans/store-user-details-to-analytics.md
- `src/lib/analytics/components/UserIdentificationTracker.tsx` in docs/plans/store-user-details-to-analytics.md
- `src/lib/analytics/utils/user-properties-cache.ts` in docs/plans/store-user-details-to-analytics.md
- `src/lib/analytics/contracts/schemas.ts` in docs/plans/store-user-details-to-analytics.md
- `src/lib/analytics/components/UserIdentificationTracker.tsx` in docs/plans/store-user-details-to-analytics.md
- `src/lib/analytics/utils/user-properties-cache.ts` in docs/plans/store-user-details-to-analytics.md
- `src/lib/analytics/adapters/mixpanel/adapter.ts` in docs/plans/store-user-details-to-analytics.md
- `eslint-plugin-aguy/lib/rules/enforce-boundaries.js` in docs/plans/code-quality-boundaries/implementation-plan.md
- `src/types/roles.ts` in docs/plans/code-quality-boundaries/implementation-plan.md
- `src/lib/media/types.ts` in docs/features/media-types/plan.md
- `src/lib/media/inferMediaType.ts` in docs/features/media-types/plan.md
- `src/collections/Media.ts` in docs/features/media-types/plan.md
- `src/collections/Media/hooks/inferMediaType.ts` in docs/features/media-types/plan.md
- `src/collections/Media/hooks/validateMediaUpload.ts` in docs/features/media-types/plan.md
- `src/components/Media/index.tsx` in docs/features/media-types/plan.md
- `src/components/admin/MediaPreview/` in docs/features/media-types/plan.md
- `src/components/Media/` in docs/features/media-types/plan.md
- `src/endpoints/agent/chat.ts#L145-L169` in docs/features/chat-context/plan.md
- `src/endpoints/agent/chat.ts#L159` in docs/features/chat-context/plan.md
- `src/endpoints/agent/chat.ts#L140-L177` in docs/features/chat-context/plan.md
- `src/endpoints/agent/chat.ts#L197` in docs/features/chat-context/plan.md
- `src/endpoints/agent/chat.ts#L186-L193` in docs/features/chat-context/plan.md
- `src/lib/ai/services/exercise-chat-service.ts#L78` in docs/features/chat-context/plan.md
- `../../src/endpoints/agent/chat.ts` in docs/features/chat-context/plan.md
- `../../src/endpoints/agent/chat.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/services/exercise-chat-service.ts` in docs/features/chat-context/plan.md
- `../../src/endpoints/agent/chat.ts` in docs/features/chat-context/plan.md
- `../../src/endpoints/agent/chat.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/observability.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/services/exercise-chat-service.ts` in docs/features/chat-context/plan.md
- `../../tests/int/memory-system.int.spec.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/context-policy.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/vector-search.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/maintenance.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/memory-extraction.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/context-policy.ts` in docs/features/chat-context/plan.md
- `../../tests/int/memory-system.int.spec.ts` in docs/features/chat-context/plan.md
- `../../src/lib/ai/context-policy.ts` in docs/features/chat-context/spec.md
- `../../src/lib/ai/maintenance.ts` in docs/features/chat-context/spec.md
- `../../src/lib/ai/memory-extraction.ts` in docs/features/chat-context/spec.md
- `../../src/lib/ai/vector-search.ts` in docs/features/chat-context/spec.md
- `../../src/lib/ai/observability.ts` in docs/features/chat-context/spec.md
- `../../tests/int/memory-system.int.spec.ts` in docs/features/chat-context/spec.md
- `../../tests/int/memory-system.int.spec.ts` in docs/features/chat-context/spec.md
- `../../src/contracts/exercise/content.ts` in docs/exercises/README.md
- `../../src/contracts/exercise/answers.ts` in docs/exercises/README.md
- `../../src/lib/ai/services/image-optimizer-service.ts` in docs/exercise-import/README.md
- `../../src/lib/ai/services/data-extractor-service.ts` in docs/exercise-import/README.md
- `../../src/endpoints/exercises/import-from-lesson.ts` in docs/exercise-import/README.md
- `../../src/endpoints/exercises/import-from-image.ts` in docs/exercise-import/README.md

### Local Path Links

- `file:///Users/aguy/Downloads/ex.html` in docs/plans/exercise-view-design-migration.md
- `file:///Users/aguy/Downloads/ex-mobile.html` in docs/plans/exercise-view-design-migration.md
