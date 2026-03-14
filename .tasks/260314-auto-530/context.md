# Codebase Context: 260314-auto-530

## Files to Modify
- `src/server/payload/collections/Exercises/schemas.ts` (lines 414-428) — Add DisplaySizeSchema and displaySize field to QuestionAxisBlockSchema
- `src/server/payload/collections/Exercises/types.ts` (lines 224-233) — Add displaySize property to QuestionAxisBlock interface
- `src/server/payload/collections/Exercises/defaults.ts` (line 343) — Add displaySize: 'full' to question_axis defaults
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (lines 47-56) — Add Display Size dropdown before Prompt section
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (entire file, 57 lines) — Add displaySize prop and responsive sizing
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (lines 331-336) — Pass displaySize to AxisRenderer
- `tests/unit/collections/exercise-display-size.test.ts` (NEW) — Schema validation tests for displaySize
- `tests/unit/ui/axis-editor-display-size.test.ts` (NEW) — Admin editor display size dropdown test
- `tests/unit/ui/axis-renderer-display-size.test.ts` (NEW) — Student renderer display size test

## Files to Read (reference patterns)
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — Panel field CSS class pattern (panel-field, panel-field-label, panel-field-select)
- `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` — Similar editor pattern with CollapsibleSection
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Schema test pattern using ContentBlockSchema.parse()
- `tests/int/contracts/axis-spec.int.spec.ts` — Axis spec test pattern

## Key Signatures
- `QuestionAxisBlockSchema` (z.object, .strict()) from `src/server/payload/collections/Exercises/schemas.ts`
- `interface QuestionAxisBlock { id, type, prompt, axis, answer?, hint?, solution?, fullSolution? }` from `src/server/payload/collections/Exercises/types.ts`
- `ExerciseBlockDefaults: Record<string, () => ContentBlock>` from `src/server/payload/collections/Exercises/defaults.ts`
- `AxisEditor: React.FC<{ block: QuestionAxisBlock; onChange: (b: QuestionAxisBlock) => void }>` from `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx`
- `AxisRenderer({ blockId: string, spec: AxisSpecV1 })` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`
- `AxisSpecV1Schema` from `src/infra/contracts/graphics/axis.v1`

## Reuse Inventory
- `CollapsibleSection` from `@/ui/admin/shared/CollapsibleSection` — already imported in AxisEditor
- CSS classes `panel-field`, `panel-field-label`, `panel-field-select`, `canvas-config-row` — used in AxisConfigPanel
- `ContentBlockSchema` from `@/server/payload/collections/Exercises/schemas` — for parsing in tests
- `InlineRichTextEditor` from `editors/InlineRichTextEditor` — already in AxisEditor, no changes needed

## Integration Points
- Schema change uses `.strict()` so displaySize MUST be explicitly added or it will be rejected on save
- The `ExerciseRenderer` casts block type as `ContentBlock & { axis?: unknown }` — needs `displaySize` added to the cast
- New `DisplaySize` type exported from `AxisRenderer/index.tsx` — imported by `ExerciseRenderer`
- No Payload config changes needed (displaySize is in the JSON content field, not a Payload field)
- No `generate:types` needed (displaySize is in the exercise content JSON, not Payload schema)

## Imports Verified
- `@/infra/contracts/graphics/axis.v1` → exports AxisSpecV1Schema, AxisSpecV1 ✅
- `@/server/payload/collections/Exercises/schemas` → exports QuestionAxisBlockSchema, ContentBlockSchema ✅
- `@/server/payload/collections/Exercises/types` → exports QuestionAxisBlock ✅
- `@/ui/admin/shared/CollapsibleSection` → used in AxisEditor ✅
