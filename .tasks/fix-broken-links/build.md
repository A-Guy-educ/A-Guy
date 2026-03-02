# Build Agent Report: fix-broken-links

## Changes

Fixed 30 broken links in README files across the A-Guy project:

1. **`.claude/rules/README.md`** (Line 61):
   - Removed placeholder link `[common/xxx.md](../common/xxx.md)` which was an example

2. **`docs/admin-components/README.md`** (Lines 50-51):
   - Updated `ExerciseContentEditor` path: `src/components/admin/` → `src/ui/admin/`
   - Updated `AnswerSpecJsonField` path: `src/components/admin/` → `src/ui/admin/`

3. **`docs/ai-services/README.md`** (Lines 99, 135, 189, 311, 389, 717):
   - Fixed `gemini-ai-provider.server.ts` → `src/infra/llm/providers/factory.ts`
   - Fixed `models.ts` → `src/infra/llm/models.ts`
   - Fixed `data-extractor-service.ts` → `src/infra/llm/services/data-extractor-service.ts`
   - Fixed `exercise-chat-service.ts` → `src/infra/llm/services/exercise-chat-service.ts`
   - Fixed `image-optimizer-service.ts` → `src/infra/llm/services/image-optimizer-service.ts`
   - Fixed `('../../AGENTS.md')` → `(../../../../AGENTS.md)` (incorrect quote syntax)

4. **`docs/block-rendering/README.md`** (Lines 54-57, 153, 174, 240, 667):
   - Fixed `RichTextRenderer` path: `src/components/exercise/` → `src/ui/web/exerciserenderer/blocks/`
   - Fixed `TrueFalseQuestion` path: `src/components/exercise/` → `src/ui/web/exerciserenderer/questions/`
   - Fixed `McqQuestion` path: `src/components/exercise/` → `src/ui/web/exerciserenderer/questions/`
   - Fixed `FreeResponseQuestion` path: `src/components/exercise/` → `src/ui/web/exerciserenderer/questions/`
   - Fixed `schemas.ts` path: `src/collections/Exercises/` → `src/infra/contracts/exercise/`
   - Fixed `ExerciseRenderer` path: `src/components/exercise/` → `src/ui/web/exerciserenderer/`
   - Removed broken link to `src/components/exercise/README.md` (doesn't exist)

5. **`docs/contracts/README.md`** (Lines 338, 353):
   - Fixed `examples/` path: `src/contracts/examples/` → `src/infra/contracts/examples/`
   - Fixed `index.ts` path: `index.ts` → `src/infra/contracts/index.ts`

6. **`docs/course-hierarchy/README.md`** (Line 640):
   - Removed broken link to `../src/lib/queries/` (doesn't exist)

7. **`docs/exercise-import/README.md`** (Lines 153, 172, 204, 247, 284):
   - Fixed `image-optimizer-service.ts` path: `src/lib/ai/` → `src/infra/llm/services/`
   - Fixed `data-extractor-service.ts` path: `src/lib/ai/` → `src/infra/llm/services/`
   - Fixed `import-from-lesson.ts` path: `src/endpoints/` → `src/server/payload/endpoints/`
   - Fixed `import-from-image.ts` path: `src/endpoints/` → `src/app/api/exercises/import/route.ts`

8. **`docs/exercises/README.md`** (Lines 78-79, 436):
   - Fixed `content.ts` path: `src/contracts/` → `src/infra/contracts/exercise/`
   - Fixed `answers.ts` path: `src/contracts/` → `src/infra/contracts/exercise/`
   - Fixed `examples/` path: `src/contracts/` → `src/infra/contracts/`

9. **`src/infra/llm/README.md`** (Lines 66, 76):
   - Added description text to `providers/gemini/` link
   - Added description text to `providers/openai/` link

## Tests Written

No tests required - documentation-only changes.

## Quality

- TypeScript: PASS
- Lint: PASS

## Summary

All 30 broken links have been fixed. The main issues were:
- Files moved from `src/lib/ai/` to `src/infra/llm/`
- Files moved from `src/components/admin/` to `src/ui/admin/`
- Files moved from `src/components/exercise/` to `src/ui/web/exerciserenderer/`
- Files moved from `src/contracts/` to `src/infra/contracts/`
- Some endpoints moved from `src/endpoints/` to `src/app/api/` or `src/server/payload/endpoints/`
- Some placeholder/example links removed
