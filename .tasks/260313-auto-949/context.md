# Codebase Context: 260313-auto-949

## Files to Modify
- `src/server/payload/collections/Exercises/schemas.ts` (lines 401-412, 417-428) — Add `layout` field to QuestionGeometryBlockSchema and QuestionAxisBlockSchema
- `src/server/payload/collections/Exercises/types.ts` (lines 210-219, 224-233) — Add `GraphLayout` type and `layout?` property to interfaces
- `src/server/payload/collections/Exercises/defaults.ts` (lines 298-324, 326-347) — Add `layout: 'textRight'` to factory functions
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (lines 47-56) — Add layout selector after Prompt section
- `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` (lines 76-85) — Add layout selector after Prompt section
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (lines 322-337) — Wrap geometry/axis rendering in GraphWithPrompt
- `src/ui/web/exerciserenderer/blocks/GraphWithPrompt/index.tsx` (NEW) — Shared layout wrapper component
- `tests/unit/collections/graph-layout.test.ts` (NEW) — Schema + defaults tests
- `tests/unit/ui/graph-with-prompt.test.tsx` (NEW) — Layout component tests

## Files to Read (reference patterns)
- `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx` — Pattern for rendering rich text prompts
- `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` — Current geometry rendering (graph only, no prompt)
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` — Current axis rendering (graph only, no prompt)
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Test pattern for schema validation with ContentBlockSchema.parse()
- `src/ui/admin/shared/CollapsibleSection.tsx` — Admin UI reusable component pattern
- `src/ui/web/exerciserenderer/questions/McqQuestion/index.tsx` — Pattern for converting InlineRichText → RichTextBlock for rendering

## Key Signatures
- `ContentBlockSchema.parse(data)` from `src/server/payload/collections/Exercises/schemas.ts` — validates block data
- `ExerciseBlockDefaults['question_geometry']()` from `src/server/payload/collections/Exercises/defaults.ts` — factory returns QuestionGeometryBlock
- `ExerciseBlockDefaults['question_axis']()` from `src/server/payload/collections/Exercises/defaults.ts` — factory returns QuestionAxisBlock
- `RichTextRenderer({ block })` from `src/ui/web/exerciserenderer/blocks/RichTextRenderer/` — renders markdown+math
- `GeometryRenderer({ blockId, spec })` from `src/ui/web/exerciserenderer/blocks/GeometryRenderer/` — renders JSXGraph geometry
- `AxisRenderer({ blockId, spec })` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/` — renders JSXGraph axis
- `cn(...classes)` from `src/infra/utils/ui` — Tailwind class merging
- `generateId()` from `src/server/payload/collections/Exercises/types` — block ID generator
- `InlineRichTextEditor({ value, onChange })` from `src/ui/admin/ExerciseContentEditor/editors/InlineRichTextEditor` — admin prompt editor

## Reuse Inventory
- `RichTextRenderer` from `src/ui/web/exerciserenderer/blocks/RichTextRenderer/` — use for rendering prompt text in frontend
- `cn()` from `src/infra/utils/ui` — use for conditional Tailwind classes in GraphWithPrompt
- `GeometryRenderer` from `src/ui/web/exerciserenderer/blocks/GeometryRenderer/` — reuse as child of GraphWithPrompt
- `AxisRenderer` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/` — reuse as child of GraphWithPrompt
- `CollapsibleSection` from `src/ui/admin/shared/CollapsibleSection` — admin collapsible pattern (reference only)
- `InlineRichTextEditor` from `src/ui/admin/ExerciseContentEditor/editors/InlineRichTextEditor` — already used in both editors

## Integration Points
- Zod schemas use `.strict()` — new fields MUST be added to schema object or validation will reject them
- `ContentBlockSchema` is a discriminated union that includes both QuestionGeometryBlockSchema and QuestionAxisBlockSchema — no registration needed, changes propagate automatically
- ExerciseRenderer uses type casting `(b.type === ('question_geometry' as string))` because these types aren't in its own ContentBlock type union — follow same pattern for layout/prompt access
- Factory functions in defaults.ts are called by `ExerciseBlockDefaults[blockType]()` in ExerciseContentEditor — no registration needed
- InlineRichText → RichTextBlock conversion: add synthetic `id` field (`${blockId}-prompt`) to make it a valid RichTextBlock for RichTextRenderer

## Imports Verified
- `@/server/payload/collections/Exercises/schemas` → exports ContentBlockSchema, QuestionGeometryBlockSchema, QuestionAxisBlockSchema ✅
- `@/server/payload/collections/Exercises/types` → exports QuestionGeometryBlock, QuestionAxisBlock, InlineRichText ✅
- `@/server/payload/collections/Exercises/defaults` → exports ExerciseBlockDefaults, generateId ✅
- `@/ui/web/exerciserenderer/blocks/RichTextRenderer` → exports RichTextRenderer ✅
- `@/ui/web/exerciserenderer/blocks/GeometryRenderer` → exports GeometryRenderer ✅
- `@/ui/web/exerciserenderer/blocks/AxisRenderer` → exports AxisRenderer ✅
- `@/infra/utils/ui` → exports cn ✅
- `@/infra/contracts` → exports GeometrySpecV1, AxisSpecV1 ✅

## Critical Notes
- **Backward compatibility**: Existing geometry/axis blocks in the database will NOT have a `layout` field. The Zod schema `.default('textRight')` handles this at parse time. The TypeScript interface makes it optional (`layout?: GraphLayout`). The frontend must fallback to `'textRight'` when `layout` is undefined.
- **Strict mobile layout**: Side-by-side layouts (`textLeft`, `textRight`) must NOT use responsive breakpoint classes like `md:flex-row`. Always use `flex-row` regardless of viewport.
- **Minimum width threshold**: Per clarified.md, there should be a minimum width threshold for graph containers in side-by-side layouts (e.g., `min-w-[280px]`).
