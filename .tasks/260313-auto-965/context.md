# Codebase Context: 260313-auto-965

## Files to Modify
- `src/infra/contracts/graphics/axis.v1.ts` (lines 35-42, 158-169) — Add viewportMode field to ViewportSchema / AxisSpecV1Schema
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` (full file, 137 lines) — Add auto/manual toggle, validation, warning
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` (lines 201-209) — Replace hardcoded bbox with resolveViewport
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (lines 29-35) — Replace hardcoded boundingBox with resolveViewport
- `src/ui/admin/ExerciseContentEditor/index.css` (append ~30 lines) — Add viewport validation/warning CSS classes
- `src/infra/utils/graphics/viewport-utils.ts` (NEW) — Viewport auto-calc, validation, visibility check utilities
- `tests/int/contracts/axis-spec.int.spec.ts` (append new test cases) — Schema backward compat + viewportMode tests
- `tests/unit/infra/utils/graphics/viewport-utils.spec.ts` (NEW) — Unit tests for all viewport utility functions
- `tests/unit/ui/admin/AxisConfigPanel.spec.tsx` (NEW) — Component tests for toggle, validation, warning
- `tests/unit/ui/web/AxisRenderer.spec.tsx` (NEW) — Component tests for viewport resolution

## Files to Read (reference patterns)
- `src/ui/admin/ExerciseContentEditor/components/axis/GraphsPanel.tsx` — Panel component pattern (panel-field, panel-add-btn classes)
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` — How AxisConfigPanel is wired (line 62)
- `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` — Similar editor pattern for reference
- `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx` — Admin board component (boundingBox prop)
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` — Student board component (boundingBox prop)
- `src/infra/contracts/graphics/geometry.v1.ts` — Similar Zod schema pattern (CanvasSchema)

## Key Signatures
- `AxisSpecV1Schema: z.ZodObject<...>` from `src/infra/contracts/graphics/axis.v1.ts`
- `type AxisSpecV1 = z.infer<typeof AxisSpecV1Schema>` from `src/infra/contracts/graphics/axis.v1.ts`
- `ViewportSchema = z.object({ xMin, xMax, yMin, yMax }).optional()` from `src/infra/contracts/graphics/axis.v1.ts` (lines 35-42)
- `AxisConfigPanel: React.FC<{ spec: AxisSpecV1; onChange: (spec: AxisSpecV1) => void }>` from `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx`
- `AxisCanvas: React.FC<{ id: string; axis: AxisSpecV1; onPointMoved?: ... }>` from `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx`
- `AxisRenderer({ blockId: string, spec: AxisSpecV1 })` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`
- `JSXGraphBoard` (admin) accepts `boundingBox: [number, number, number, number]` from `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`
- `JSXGraphBoard` (student) accepts `boundingBox?: [number, number, number, number]` from `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`

## Reuse Inventory
- `panel-field`, `panel-field-label`, `panel-field-input`, `panel-checkbox-label` CSS classes from `index.css` — existing UI patterns for all config fields
- `--theme-error-50`, `--theme-error-500` CSS variables — validation error styling
- `z` from `'zod'` — schema definition
- `ColorStringSchema`, `LineStyleSchema`, `PositionEnumSchema` from `../primitives` — existing Zod primitives
- `InteractionToolSchema`, `EvaluationModeSchema` from `./interaction.base` — existing Zod primitives
- No existing viewport utility exists — `viewport-utils.ts` is genuinely new

## Integration Points
- Schema change in `axis.v1.ts` requires `pnpm generate:types` afterward
- AxisSpecV1 is re-exported from `src/infra/contracts/index.ts` (line 33) — no changes needed there (type auto-updates)
- `AxisConfigPanel` interface unchanged (still `{ spec: AxisSpecV1; onChange }`) — no changes to AxisEditor.tsx
- Both admin `AxisCanvas` and student `AxisRenderer` compute bounding box from spec — both need `resolveViewport`
- CSS appended to existing `index.css` — no new CSS files

## Imports Verified
- `@/infra/contracts/graphics/axis.v1` → exports AxisSpecV1Schema, AxisSpecV1 ✅
- `@/infra/contracts` → re-exports AxisSpecV1Schema, AxisSpecV1 ✅
- `@/infra/utils/graphics/viewport-utils` → will export calculateAutoViewport, validateViewportRange, checkGraphVisibility, resolveViewport (NEW) 🆕
- `@/ui/admin/shared/CollapsibleSection` → used in AxisEditor ✅
- `lucide-react` → available for icons (Plus, Trash2 used in GraphsPanel) ✅
- `jsxgraph` → types imported in AxisCanvas ✅
