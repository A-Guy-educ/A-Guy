# Plan: 260313-auto-573 — Configure Axis Label/Tick Position in Admin Graph Editor

## Rerun Context

This is a rerun requested via `/cody rerun` with no specific code-level feedback. The previous run likely failed at the plan stage. This plan is a fresh comprehensive plan covering all spec requirements.

## Research Findings

- `src/infra/contracts/graphics/axis.v1.ts` ✅ exists — AxesSchema at lines 17-32, AxisSpecV1Schema at lines 159-170 (uses `.strict()`)
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` ✅ exists — uses `panel-checkbox-label` class pattern for checkboxes (lines 44-69)
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` ✅ exists — passes `showAxis` boolean only to admin JSXGraphBoard (line 217)
- `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx` ✅ exists — simple wrapper, `axis: showAxis` boolean only (line 55), no axisConfig support
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` ✅ exists — already has `axisConfig` prop with `showNumbers`, `showLabels`, `ticks`, `labels` (lines 13-18), uses `defaultAxes` pattern (lines 50-71)
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` ✅ exists — passes axisConfig to JSXGraphBoard (lines 46-51)
- `src/types/jsxgraph.d.ts` ✅ exists — minimal types, JXGBoardOptions has `axis?: boolean` (line 9), no `defaultAxes` support
- `tests/int/contracts/axis-spec.int.spec.ts` ✅ exists — existing schema validation tests
- `src/infra/contracts/index.ts` ✅ exists — re-exports AxisSpecV1Schema and AxisSpecV1 type

### Key Observations

1. **Admin JSXGraphBoard** uses `axis: showAxis` (boolean). It does NOT support `defaultAxes` config at all. This is a significant gap — for tick position and title position to render in the admin preview, this component must be upgraded.
2. **Web JSXGraphBoard** already uses `defaultAxes` pattern with tick visibility, distance, labels. Extending it for tick position is straightforward.
3. **AxisSpecV1Schema** uses `.strict()` — any new fields added to AxesSchema will automatically be valid since AxesSchema is nested inside the strict outer schema.
4. **Test pattern**: Contract tests live in `tests/int/contracts/` and use `vitest` with `describe/it/expect` pattern.

## Reuse Inventory

### Existing utilities/functions to reuse:
- `AxisSpecV1Schema` from `src/infra/contracts/graphics/axis.v1.ts` — extend AxesSchema inside it
- `panel-checkbox-label` CSS class from `src/ui/admin/ExerciseContentEditor/index.css` — for toggle UI
- `cn()` from `@/infra/utils/ui` — for conditional classes in web components
- `axisConfig` prop pattern in web `JSXGraphBoard` — extend with tickPosition fields
- Existing test fixture patterns in `tests/int/contracts/axis-spec.int.spec.ts`

### Justification for NEW code:
- No existing tick position utility exists — this is a new domain-specific feature
- No reusable toggle exists in admin components — must add checkboxes following existing pattern

---

## Steps

### Step 1: Extend AxisSpecV1 Schema with tickPosition field

**Spec refs**: NFR-001, FR-004
**Files to touch**:
- `src/infra/contracts/graphics/axis.v1.ts` (MODIFIED — lines 17-32, add field inside AxesSchema)

**Exact behavior**:
- Add optional `tickPosition` field to `AxesSchema` with structure:
  ```typescript
  tickPosition: z.object({
    x: z.enum(['default', 'inverted']).default('default'),
    y: z.enum(['default', 'inverted']).default('default'),
  }).optional()
  ```
- Field is optional so existing specs without it remain valid (backward compatibility)
- When omitted, code should treat it as `{ x: 'default', y: 'default' }`

**Tests** (FAIL before, PASS after):
- Test file: `tests/int/contracts/axis-spec.int.spec.ts`
- Test 1: `'validates axis spec with tickPosition field'` — parse a valid spec with `tickPosition: { x: 'inverted', y: 'default' }` → expect no throw
- Test 2: `'validates axis spec without tickPosition (backward compat)'` — parse existing valid spec without tickPosition → expect no throw
- Test 3: `'rejects invalid tickPosition value'` — parse spec with `tickPosition: { x: 'invalid', y: 'default' }` → expect throw

**Verification command**: `pnpm test:int -- tests/int/contracts/axis-spec.int.spec.ts`

**Acceptance criteria**:
- [ ] AxesSchema includes optional tickPosition field
- [ ] Existing specs without tickPosition parse successfully
- [ ] Invalid tickPosition values are rejected
- [ ] TypeScript type `AxisSpecV1` includes `axes.tickPosition` as optional

---

### Step 2: Extend JSXGraph type declarations for axis configuration

**Spec refs**: NFR-002
**Files to touch**:
- `src/types/jsxgraph.d.ts` (MODIFIED — lines 7-17, extend JXGBoardOptions)

**Exact behavior**:
- Add `defaultAxes` optional property to `JXGBoardOptions` interface:
  ```typescript
  defaultAxes?: {
    x?: {
      ticks?: {
        visible?: boolean
        ticksDistance?: number
        label?: { offset?: [number, number] }
      }
      name?: string
      withLabel?: boolean
      label?: { position?: string; offset?: [number, number]; fontSize?: number }
    }
    y?: {
      ticks?: {
        visible?: boolean
        ticksDistance?: number
        label?: { offset?: [number, number] }
      }
      name?: string
      withLabel?: boolean
      label?: { position?: string; offset?: [number, number]; fontSize?: number }
    }
  }
  ```
- This allows both admin and web JSXGraphBoard components to pass axis configuration without type errors.

**Tests** (FAIL before, PASS after):
- Test: `pnpm -s tsc --noEmit` — TypeScript compilation should pass with the new defaultAxes usage in subsequent steps.
- No dedicated test file — type declarations are validated by the TypeScript compiler.

**Verification command**: `pnpm -s tsc --noEmit`

**Acceptance criteria**:
- [ ] JXGBoardOptions interface includes defaultAxes property
- [ ] TypeScript compilation passes with new property usage

---

### Step 3: Update Web JSXGraphBoard to support tick position and standardized title positioning

**Spec refs**: FR-001, FR-002, FR-003, FR-005
**Files to touch**:
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` (MODIFIED — lines 13-18, 50-71)

**Exact behavior**:
- Extend `axisConfig` interface to include optional `tickPosition`:
  ```typescript
  axisConfig?: {
    showNumbers?: boolean
    showLabels?: boolean
    ticks?: number
    labels?: { x: string; y: string }
    tickPosition?: { x: 'default' | 'inverted'; y: 'default' | 'inverted' }
  }
  ```
- In `defaultAxes` construction (lines 50-71), add tick position logic:
  - X-axis ticks: add `label: { offset: [0, axisConfig?.tickPosition?.x === 'inverted' ? 10 : -10] }` to control number placement above/below
  - Y-axis ticks: add `label: { offset: [axisConfig?.tickPosition?.y === 'inverted' ? 10 : -10, 0] }` to control number placement left/right
- Add standardized axis title positioning:
  - X-axis label: `label: { position: 'rt', offset: [0, 12] }` — far right, slightly below
  - Y-axis label: `label: { position: 'rt', offset: [15, 0] }` — near top, slightly to right

**Tests** (FAIL before, PASS after):
- Test file: `tests/unit/ui/web/JSXGraphBoard.spec.ts` (NEW)
- Test 1: `'passes tick position offset for inverted X-axis'` — render with `tickPosition: { x: 'inverted', y: 'default' }`, verify the defaultAxes config object is constructed with the expected x-axis tick label offset
- Test 2: `'uses default tick position when tickPosition is undefined'` — render without tickPosition, verify default offsets

**Verification command**: `pnpm test:unit -- tests/unit/ui/web/JSXGraphBoard.spec.ts`

**Acceptance criteria**:
- [ ] axisConfig prop accepts tickPosition
- [ ] Inverted X-axis numbers appear on opposite side (offset flipped)
- [ ] Inverted Y-axis numbers appear on opposite side (offset flipped)
- [ ] X-axis title positioned far right, slightly below
- [ ] Y-axis title positioned near top, slightly to right
- [ ] Default behavior unchanged when tickPosition not provided

---

### Step 4: Update Web AxisRenderer to pass tick position to JSXGraphBoard

**Spec refs**: FR-005
**Files to touch**:
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (MODIFIED — lines 46-51)

**Exact behavior**:
- Add `tickPosition` to the `axisConfig` prop passed to `JSXGraphBoard`:
  ```typescript
  axisConfig={{
    showNumbers: spec.axes.showNumbers,
    showLabels: spec.axes.showLabels,
    ticks: spec.axes.ticks,
    labels: spec.axes.labels,
    tickPosition: spec.axes.tickPosition ?? { x: 'default', y: 'default' },
  }}
  ```
- When `spec.axes.tickPosition` is undefined (legacy data), default to `{ x: 'default', y: 'default' }`

**Tests** (FAIL before, PASS after):
- Covered by Step 3 JSXGraphBoard tests + Step 1 schema tests
- Additional manual verification: TypeScript compilation must pass

**Verification command**: `pnpm -s tsc --noEmit`

**Acceptance criteria**:
- [ ] AxisRenderer passes tickPosition from spec to JSXGraphBoard
- [ ] Falls back to default when tickPosition is undefined

---

### Step 5: Update Admin JSXGraphBoard to support axis configuration

**Spec refs**: FR-006
**Files to touch**:
- `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx` (MODIFIED — lines 6-15, 53-62)

**Exact behavior**:
- Add `axisConfig` prop to interface:
  ```typescript
  interface JSXGraphBoardProps {
    // ... existing props
    axisConfig?: {
      showNumbers?: boolean
      showLabels?: boolean
      ticks?: number
      labels?: { x: string; y: string }
      tickPosition?: { x: 'default' | 'inverted'; y: 'default' | 'inverted' }
    }
  }
  ```
- Replace `axis: showAxis` boolean with `defaultAxes` configuration when `showAxis` is true:
  - Build `defaultAxes` object similar to the web JSXGraphBoard pattern (from Step 3)
  - Include standardized title positioning (FR-001)
  - Include tick position configuration (FR-002, FR-003)
  - When `axisConfig` not provided, fall back to `axis: true` simple boolean
- Pass the options object to `initBoard` using `as JXGBoardOptions` (the type already has `[key: string]: unknown`)

**Tests** (FAIL before, PASS after):
- No direct unit test for admin JSXGraphBoard (client component with dynamic import)
- Verified via TypeScript compilation: `pnpm -s tsc --noEmit`
- Verified via integration: admin AxisCanvas passes config → board renders correctly

**Verification command**: `pnpm -s tsc --noEmit`

**Acceptance criteria**:
- [ ] Admin JSXGraphBoard accepts axisConfig prop
- [ ] When axisConfig provided with showAxis=true, uses defaultAxes pattern
- [ ] Tick position and title positioning render in admin preview
- [ ] Backward compatible — works without axisConfig

---

### Step 6: Update Admin AxisCanvas to pass axis configuration to JSXGraphBoard

**Spec refs**: FR-006
**Files to touch**:
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` (MODIFIED — lines 211-221)

**Exact behavior**:
- Pass full `axisConfig` to the admin `JSXGraphBoard`:
  ```tsx
  <JSXGraphBoard
    id={id}
    width={600}
    height={400}
    boundingBox={bbox}
    showAxis
    showGrid={axis.grid.enabled}
    axisConfig={{
      showNumbers: axis.axes.showNumbers,
      showLabels: axis.axes.showLabels,
      ticks: axis.axes.ticks,
      labels: axis.axes.labels,
      tickPosition: axis.axes.tickPosition ?? { x: 'default', y: 'default' },
    }}
    onBoardReady={handleBoardReady}
  />
  ```
- This ensures the admin preview reflects tick position and title positioning changes in real-time.

**Tests** (FAIL before, PASS after):
- Verified via TypeScript compilation: `pnpm -s tsc --noEmit`

**Verification command**: `pnpm -s tsc --noEmit`

**Acceptance criteria**:
- [ ] AxisCanvas passes full axisConfig including tickPosition to JSXGraphBoard
- [ ] Admin preview reflects tick position settings

---

### Step 7: Add toggle controls for tick position in Admin AxisConfigPanel

**Spec refs**: FR-002, FR-003
**Files to touch**:
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` (MODIFIED — insert after line 69)

**Exact behavior**:
- Add a new `canvas-config-row` section after the existing checkboxes row (after line 69):
  ```tsx
  <label className="panel-checkbox-label">
    <input
      type="checkbox"
      checked={spec.axes.tickPosition?.x === 'inverted'}
      onChange={(e) =>
        updateAxes({
          tickPosition: {
            ...(spec.axes.tickPosition ?? { x: 'default', y: 'default' }),
            x: e.target.checked ? 'inverted' : 'default',
          },
        })
      }
    />
    Invert X Numbers
  </label>
  <label className="panel-checkbox-label">
    <input
      type="checkbox"
      checked={spec.axes.tickPosition?.y === 'inverted'}
      onChange={(e) =>
        updateAxes({
          tickPosition: {
            ...(spec.axes.tickPosition ?? { x: 'default', y: 'default' }),
            y: e.target.checked ? 'inverted' : 'default',
          },
        })
      }
    />
    Invert Y Numbers
  </label>
  ```
- Checkboxes are unchecked by default (tickPosition undefined → treated as 'default')
- When checked, updates `spec.axes.tickPosition.x` or `.y` to `'inverted'`
- When unchecked, resets to `'default'`
- Uses existing `panel-checkbox-label` CSS class for consistency

**Tests** (FAIL before, PASS after):
- Test file: `tests/unit/ui/admin/AxisConfigPanel.spec.tsx` (NEW)
- Test 1: `'renders invert X numbers checkbox unchecked by default'` — render with spec where tickPosition is undefined, verify checkbox is unchecked
- Test 2: `'calls onChange with inverted X tickPosition when checkbox checked'` — simulate click on "Invert X Numbers" checkbox, verify onChange is called with `tickPosition: { x: 'inverted', y: 'default' }`
- Test 3: `'renders invert Y numbers checkbox checked when spec has inverted Y'` — render with `tickPosition: { x: 'default', y: 'inverted' }`, verify Y checkbox is checked

**Verification command**: `pnpm test:unit -- tests/unit/ui/admin/AxisConfigPanel.spec.tsx`

**Acceptance criteria**:
- [ ] "Invert X Numbers" checkbox appears in admin config panel
- [ ] "Invert Y Numbers" checkbox appears in admin config panel
- [ ] Checkboxes correctly toggle tickPosition in spec
- [ ] Default state is unchecked (standard placement)

---

## Summary

| Step | Files | Description | Test type |
|------|-------|-------------|-----------|
| 1 | 1 modified | Extend AxesSchema with tickPosition | Integration (schema) |
| 2 | 1 modified | Extend JSXGraph type declarations | TypeScript compilation |
| 3 | 1 modified | Web JSXGraphBoard tick/title positioning | Unit test |
| 4 | 1 modified | Web AxisRenderer pass tickPosition | TypeScript compilation |
| 5 | 1 modified | Admin JSXGraphBoard axis config | TypeScript compilation |
| 6 | 1 modified | Admin AxisCanvas pass config | TypeScript compilation |
| 7 | 1 modified | Admin AxisConfigPanel toggle controls | Unit test |

**Total files modified**: 7
**New test files**: 2 (`tests/unit/ui/web/JSXGraphBoard.spec.ts`, `tests/unit/ui/admin/AxisConfigPanel.spec.tsx`)
**Modified test files**: 1 (`tests/int/contracts/axis-spec.int.spec.ts`)
