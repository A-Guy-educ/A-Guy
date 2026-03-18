# Codebase Context: 260313-auto-475

## Files to Modify
- `src/server/payload/collections/Exercises/schemas.ts` (lines 417-428) — Add `displaySize` field to QuestionAxisBlockSchema
- `src/server/payload/collections/Exercises/types.ts` (lines 224-233) — Add `displaySize` to QuestionAxisBlock interface
- `src/server/payload/collections/Exercises/defaults.ts` (lines 326-347) — Add `displaySize: 'full'` to question_axis factory
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (lines 47-125) — Add display size selector UI
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (lines 16-57) — Accept displaySize prop, apply responsive sizing
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (lines 331-336) — Pass displaySize to AxisRenderer
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` (MODIFIED) — Add displaySize integration tests

## Files to Create (NEW)
- `tests/unit/collections/exercise-display-size.test.ts` (NEW) — Schema validation tests for displaySize
- `tests/unit/ui/axis-editor-display-size.test.ts` (NEW) — Admin editor UI tests
- `tests/unit/ui/axis-renderer-display-size.test.ts` (NEW) — Student renderer tests
- `tests/unit/ui/exercise-renderer-side-by-side.test.ts` (NEW) — Side-by-side layout tests

## Files to Read (reference patterns)
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — Pattern for admin config panels (select dropdowns, panel-field CSS classes)
- `src/ui/admin/ExerciseContentEditor/components/axis/GraphsPanel.tsx` — Pattern for select dropdowns in axis panels
- `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` — Parallel pattern for JSXGraphBoard integration
- `tests/int/contracts/axis-spec.int.spec.ts` — Test pattern for Zod schema validation tests
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Test pattern for ContentBlockSchema tests

## Key Signatures
- `QuestionAxisBlockSchema` (Zod object schema) from `src/server/payload/collections/Exercises/schemas.ts` — `.strict()` object, currently has: id, type, prompt, axis, answer, hint, solution, fullSolution
- `interface QuestionAxisBlock` from `src/server/payload/collections/Exercises/types.ts` — mirrors the Zod schema with TypeScript types
- `ExerciseBlockDefaults.question_axis` from `src/server/payload/collections/Exercises/defaults.ts` — factory function returning `QuestionAxisBlock`
- `function AxisRenderer({ blockId, spec }: AxisRendererProps)` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`
- `function JSXGraphBoard({ id, width, height, ... }: JSXGraphBoardProps)` from `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` — `width: number`, `height: number`
- `ContentBlockSchema` (discriminated union on `type`) from `src/server/payload/collections/Exercises/schemas.ts`
- `AxisSpecV1Schema` from `src/infra/contracts/graphics/axis.v1.ts` — NOT modified (displaySize is block-level, not spec-level)
- `const AxisEditor: React.FC<AxisEditorProps>` from `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx`

## Reuse Inventory
- CSS classes `panel-field`, `panel-field-label`, `panel-field-select` from `AxisConfigPanel.tsx` — use for display size selector styling
- `CollapsibleSection` from `src/ui/admin/shared/CollapsibleSection` — NOT needed for displaySize (it's a single field, not a section)
- `cn` from `src/infra/utils/ui` — use for conditional Tailwind classes in renderer
- `generateId` from `src/server/payload/collections/Exercises/types` — already used in defaults
- Test patterns from `tests/int/contracts/axis-spec.int.spec.ts` — follow describe/it/expect pattern with vitest

## Integration Points
- `QuestionAxisBlockSchema` is referenced in `ContentBlockSchema` discriminated union (schemas.ts line 534) — no changes needed to union, just to the schema itself
- `QuestionAxisBlock` type is imported by `AxisEditor.tsx` (admin) — will get new field automatically
- `ExerciseRenderer/index.tsx` casts axis blocks at line 323-336 — needs updated cast to include `displaySize`
- `AxisRenderer` is imported by `ExerciseRenderer` at line 33 — interface change needed
- JSXGraphBoard requires pixel width/height — percentage-based sizing must be resolved to pixels before passing

## Imports Verified
- `@/server/payload/collections/Exercises/schemas` → exports QuestionAxisBlockSchema, ContentBlockSchema ✅
- `@/server/payload/collections/Exercises/types` → exports QuestionAxisBlock interface ✅
- `@/server/payload/collections/Exercises/defaults` → exports ExerciseBlockDefaults ✅
- `@/infra/contracts/graphics/axis.v1` → exports AxisSpecV1Schema, AxisSpecV1 type ✅
- `@/infra/utils/ui` → exports cn utility ✅
- `@/ui/admin/shared/CollapsibleSection` → exports CollapsibleSection component ✅

## Critical Notes
- **`.strict()` on schemas**: Adding `displaySize` to QuestionAxisBlockSchema is REQUIRED for the field to pass validation — `.strict()` rejects unknown keys
- **Backward compatibility**: Field MUST be optional with a default — existing exercises don't have `displaySize`
- **JSXGraph pixel requirement**: JSXGraph `initBoard` needs numeric pixel dimensions — cannot use CSS percentages directly on the board, must measure container and pass computed pixels
- **Admin vs Student boards**: There are TWO JSXGraphBoard components — one in admin (`src/ui/admin/.../components/shared/JSXGraphBoard.tsx`) and one in student (`src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`). The admin one should NOT change — it's a fixed preview canvas. Only the student one needs responsive sizing.
