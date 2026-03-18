# Codebase Context: 260313-auto-573

## Files to Modify
- `src/infra/contracts/graphics/axis.v1.ts` (lines 17-32) — Add tickPosition field to AxesSchema
- `src/types/jsxgraph.d.ts` (lines 7-17) — Add defaultAxes property to JXGBoardOptions
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` (lines 13-18, 50-71) — Add tickPosition to axisConfig, update defaultAxes construction
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (lines 46-51) — Pass tickPosition from spec to JSXGraphBoard
- `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx` (lines 6-15, 53-62) — Add axisConfig prop, use defaultAxes pattern
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` (lines 211-221) — Pass axisConfig with tickPosition to JSXGraphBoard
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` (lines 44-69) — Add tick position toggle checkboxes

## Files to Modify (Tests)
- `tests/int/contracts/axis-spec.int.spec.ts` (MODIFIED) — Add tickPosition validation tests
- `tests/unit/ui/web/JSXGraphBoard.spec.ts` (NEW) — Unit tests for tick position offset logic
- `tests/unit/ui/admin/AxisConfigPanel.spec.tsx` (NEW) — Unit tests for toggle controls

## Files to Read (reference patterns)
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — checkbox UI pattern (`panel-checkbox-label`)
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` — `defaultAxes` construction pattern (lines 50-71)
- `tests/int/contracts/axis-spec.int.spec.ts` — existing schema test pattern
- `src/ui/admin/ExerciseContentEditor/index.css` — CSS classes for admin panels

## Key Signatures
- `AxesSchema` (z.object) from `src/infra/contracts/graphics/axis.v1.ts` — extend with tickPosition
- `AxisSpecV1Schema` (z.object.strict) from `src/infra/contracts/graphics/axis.v1.ts` — outer schema, strict mode
- `type AxisSpecV1 = z.infer<typeof AxisSpecV1Schema>` from `src/infra/contracts/graphics/axis.v1.ts`
- `JSXGraphBoardProps.axisConfig` interface from `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`
- `JXGBoardOptions` interface from `src/types/jsxgraph.d.ts`
- `JSXGraphBoardProps` interface from `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`
- `AxisConfigPanelProps` interface from `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx`
- `AxisCanvasProps` interface from `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx`

## Reuse Inventory
- `panel-checkbox-label` CSS class from `src/ui/admin/ExerciseContentEditor/index.css` — use for toggle checkboxes
- `cn()` from `@/infra/utils/ui` — conditional class names in web components
- `defaultAxes` pattern in web JSXGraphBoard (lines 50-71) — replicate for admin JSXGraphBoard
- Existing test fixture in `tests/int/contracts/axis-spec.int.spec.ts` (validSpec object) — extend for tickPosition tests

## Integration Points
- Schema type `AxisSpecV1` is re-exported via `src/infra/contracts/index.ts` — no changes needed there (auto re-export)
- Admin AxisCanvas imports `JSXGraphBoard` from `../shared/JSXGraphBoard` — must update import interface
- Web AxisRenderer imports `JSXGraphBoard` from `../../graphics/JSXGraphBoard` — must update axisConfig prop
- Admin AxisConfigPanel uses `updateAxes()` helper to merge partial updates into `spec.axes`

## Imports Verified
- `@/infra/contracts/graphics/axis.v1` → exports `AxisSpecV1Schema`, `AxisSpecV1` ✅
- `@/infra/contracts` → re-exports `AxisSpecV1Schema`, `AxisSpecV1` ✅
- `@/infra/utils/ui` → exports `cn()` ✅
- `jsxgraph` module → declared in `src/types/jsxgraph.d.ts` ✅

## Test Commands
- Schema tests: `pnpm test:int -- tests/int/contracts/axis-spec.int.spec.ts`
- Unit tests (web): `pnpm test:unit -- tests/unit/ui/web/JSXGraphBoard.spec.ts`
- Unit tests (admin): `pnpm test:unit -- tests/unit/ui/admin/AxisConfigPanel.spec.tsx`
- TypeScript check: `pnpm -s tsc --noEmit`
