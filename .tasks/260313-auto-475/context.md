# Codebase Context: 260313-auto-475

## Files to Modify
- `src/infra/contracts/graphics/display.ts` (NEW) — shared GraphDisplaySize type and constants
- `src/infra/contracts/index.ts` (lines 33-36) — add re-export for display module
- `src/server/payload/collections/Exercises/types.ts` (lines 210-233) — add displaySize to QuestionGeometryBlock and QuestionAxisBlock interfaces
- `src/server/payload/collections/Exercises/schemas.ts` (lines 401-428) — add displaySize to QuestionGeometryBlockSchema and QuestionAxisBlockSchema
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` (MODIFIED) — add display size dropdown
- `src/ui/admin/ExerciseContentEditor/components/geometry/CanvasConfigPanel.tsx` (MODIFIED) — add display size dropdown
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (MODIFIED) — pass displaySize props to AxisConfigPanel
- `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` (MODIFIED) — pass displaySize props to CanvasConfigPanel
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (MODIFIED) — accept displaySize, render responsive container
- `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` (MODIFIED) — accept displaySize, render responsive container
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` (MODIFIED) — add responsive mode with CSS aspect-ratio
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (lines 322-337) — pass displaySize to renderers
- `tests/unit/contracts/graph-display-size.test.ts` (NEW) — unit tests for display constants
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` (MODIFIED) — schema validation tests
- `tests/unit/admin/graph-size-selector.test.tsx` (NEW) — admin dropdown tests
- `tests/unit/renderers/graph-display-size.test.tsx` (NEW) — renderer display tests

## Files to Read (reference patterns)
- `src/infra/contracts/graphics/axis.v1.ts` — Zod schema pattern with `.strict()`, type inference
- `src/infra/contracts/graphics/geometry.v1.ts` — Same pattern, canvas dimension handling
- `src/infra/contracts/primitives.ts` — Shared enum/type pattern for contracts
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — Admin config panel UI pattern (input/checkbox/select)
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` — Editor→ConfigPanel prop passing pattern
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Schema test pattern (parse/throw)

## Key Signatures
- `AxisSpecV1Schema` (Zod object, `.strict()`) from `src/infra/contracts/graphics/axis.v1.ts`
- `GeometrySpecV1Schema` (Zod object, `.strict()`) from `src/infra/contracts/graphics/geometry.v1.ts`
- `QuestionAxisBlockSchema` (Zod object, `.strict()`) from `src/server/payload/collections/Exercises/schemas.ts`
- `QuestionGeometryBlockSchema` (Zod object, `.strict()`) from `src/server/payload/collections/Exercises/schemas.ts`
- `interface QuestionAxisBlock { id, type, prompt, axis, answer?, hint?, solution?, fullSolution? }` from `types.ts`
- `interface QuestionGeometryBlock { id, type, prompt, geometry, answer?, hint?, solution?, fullSolution? }` from `types.ts`
- `JSXGraphBoard({ id, width, height, boundingBox?, showGrid?, showAxis?, axisConfig?, onBoardReady, className? })` from `graphics/JSXGraphBoard.tsx`
- `AxisRenderer({ blockId, spec })` from `blocks/AxisRenderer/index.tsx`
- `GeometryRenderer({ blockId, spec })` from `blocks/GeometryRenderer/index.tsx`
- `AxisConfigPanel({ spec, onChange })` from `components/axis/AxisConfigPanel.tsx`
- `cn(...inputs)` from `@/infra/utils/ui`

## Reuse Inventory
- `cn()` from `@/infra/utils/ui` — conditional Tailwind class merging
- `CollapsibleSection` from `@/ui/admin/shared/CollapsibleSection` — admin panel sections
- `ContentBlockSchema` discriminated union from `schemas.ts` — block validation
- Existing `<select>` + `<input>` patterns in `AxisConfigPanel.tsx` — UI component style

## Integration Points
- `src/infra/contracts/index.ts` — must re-export new display types for `@/infra/contracts` import path
- `QuestionAxisBlockSchema` and `QuestionGeometryBlockSchema` are `.strict()` — new field MUST be added to schema or data with displaySize will be rejected
- `ContentBlockSchema` discriminated union auto-includes updated block schemas (no change needed there)
- ExerciseRenderer casts blocks as `ContentBlock & { geometry?, axis? }` at lines 322-337 — displaySize must be accessed on the cast type
- JSXGraphBoard responsive mode is opt-in (default false) to avoid breaking admin canvas editors

## Imports Verified
- `@/infra/contracts` → exports AxisSpecV1, GeometrySpecV1, AxisSpecV1Schema, GeometrySpecV1Schema ✅
- `@/infra/utils/ui` → exports `cn` ✅
- `@/ui/admin/shared/CollapsibleSection` → exports CollapsibleSection ✅
- `@/server/payload/collections/Exercises/types` → exports QuestionAxisBlock, QuestionGeometryBlock ✅
- `@/server/payload/collections/Exercises/schemas` → exports QuestionAxisBlockSchema, QuestionGeometryBlockSchema ✅
