# Codebase Context: 260313-auto-354

## Files to Modify
- `src/server/payload/collections/Exercises/schemas.ts` (lines 414-428, 525-537) — Add QuestionMultiAxisBlockSchema and register in ContentBlockSchema union
- `src/server/payload/collections/Exercises/types.ts` (lines 233-268) — Add QuestionMultiAxisBlock interface and add to ContentBlock union
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (lines 27-32, 328-334) — Import MultiAxisRenderer and add dispatch case for question_multi_axis
- `src/ui/web/exerciserenderer/blocks/MultiAxisRenderer/index.tsx` (NEW) — Multi-graph responsive renderer component

## Files to Read (reference patterns)
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` — Single axis renderer pattern to reuse
- `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` — Similar block renderer pattern
- `src/ui/web/shared/Layout/Grid.tsx` — Responsive Grid component with CVA variants
- `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx` — For rendering prompt/explanatory text
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Schema validation test pattern

## Key Signatures
- `export function AxisRenderer({ blockId, spec }: { blockId: string; spec: AxisSpecV1 })` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`
- `export function RichTextRenderer({ block }: RichTextRendererProps)` from `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx`
- `export function Grid({ cols, gap, align, justify, className, children }: GridProps)` from `src/ui/web/shared/Layout/Grid.tsx`
- `export const ContentBlockSchema = z.discriminatedUnion('type', [...])` from `src/server/payload/collections/Exercises/schemas.ts`
- `export type ContentBlock = RichTextBlock | ... | MediaBlock` from `src/server/payload/collections/Exercises/types.ts`
- `const InlineRichTextSchema` (not exported directly, used by reference) from `src/server/payload/collections/Exercises/schemas.ts` line 15
- `export const QuestionAxisBlockSchema` from `src/server/payload/collections/Exercises/schemas.ts` line 417
- `import { AxisSpecV1Schema } from '@/infra/contracts/graphics/axis.v1'` — Zod schema for axis spec
- `import type { AxisSpecV1 } from '@/infra/contracts'` — TypeScript type for axis spec
- `export function cn(...inputs: ClassValue[]): string` from `@/infra/utils/ui`

## Reuse Inventory
- `AxisRenderer` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/` — renders each individual graph in the multi-graph grid
- `RichTextRenderer` from `src/ui/web/exerciserenderer/blocks/RichTextRenderer/` — renders prompt/explanatory text above or below graphs
- `AxisSpecV1Schema` from `src/infra/contracts/graphics/axis.v1` — Zod schema for validating axis data in each graph item
- `InlineRichTextSchema` from `src/server/payload/collections/Exercises/schemas.ts` — Zod schema for prompt field
- `InlineRichText` type from `src/server/payload/collections/Exercises/types.ts` — TypeScript type for prompt
- `AxisSpecV1` type from `@/infra/contracts` — TypeScript type for axis spec data
- `cn()` from `@/infra/utils/ui` — Tailwind class merging
- `ContentBlockSchema.parse()` pattern from `tests/int/contracts/exercise-content-blocks.int.spec.ts` — test pattern

## Integration Points
- Must add `QuestionMultiAxisBlockSchema` to `ContentBlockSchema` discriminated union at `schemas.ts:525`
- Must add `QuestionMultiAxisBlock` to `ContentBlock` union type at `types.ts:256`
- Must add import + dispatch case in `ExerciseRenderer/index.tsx` after line 334
- New block type follows same pattern as `question_geometry` and `question_axis` — uses type cast `as string` for type comparison in renderer
- `InlineRichTextSchema` is a `const` (not exported) — define the schema inline or reference via re-declaration in the same file

## Imports Verified
- `@/infra/contracts/graphics/axis.v1` → exports `AxisSpecV1Schema` (Zod) ✅
- `@/infra/contracts` → exports `AxisSpecV1` type ✅
- `@/server/payload/collections/Exercises/schemas` → exports `ContentBlockSchema`, `QuestionAxisBlockSchema` ✅
- `@/server/payload/collections/Exercises/types` → exports `InlineRichText`, `QuestionAxisBlock`, `ContentBlock` ✅
- `@/ui/web/exerciserenderer/blocks/AxisRenderer` → exports `AxisRenderer` ✅
- `@/ui/web/exerciserenderer/blocks/RichTextRenderer` → exports `RichTextRenderer` ✅
- `@/infra/utils/ui` → exports `cn` ✅

## Important Notes
- `InlineRichTextSchema` is NOT exported from schemas.ts (it's a `const` on line 15). The new schema will need to either: (a) re-export it, or (b) declare its own copy. Recommendation: export `InlineRichTextSchema` from schemas.ts for reuse, as it's already used in multiple block schemas.
- The `ExerciseRenderer` uses `as string` type casts for `question_geometry` and `question_axis` block types because they aren't part of the renderer's local `ContentBlock` type — follow the same pattern for `question_multi_axis`.
- The `Grid` component from `src/ui/web/shared/Layout/Grid.tsx` generates responsive classes dynamically — but these may not be in Tailwind's safelist. Prefer using direct Tailwind classes in the component for reliability.
