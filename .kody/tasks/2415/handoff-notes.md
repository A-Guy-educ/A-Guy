## Fix: AxisEditor crash on lesson record 6a05819d908d5be

**Root cause**: The `AxisEditor` component accesses `spec.elements.graphs.length` and `spec.elements.points.length` directly during render (JSX) and in `useCallback` dependency arrays (line 44: `spec.elements.points`). When a stored `QuestionAxisBlock` predates the addition of the `elements` field, `block.axis.elements` is `undefined` at runtime — causing `TypeError: Cannot read properties of undefined (reading 'points')`.

**Fix**: Added a defensive default in `AxisEditor.tsx` (line 23):
```tsx
const spec = { ...block.axis, elements: block.axis.elements ?? { points: [], graphs: [] } }
```

This ensures all subsequent `spec.elements.X` accesses are safe even for legacy records missing the field.

**Files changed**:
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` — 1-line fix
- `tests/unit/ui/axis-editor-undefined-elements.test.tsx` — new regression test (5 cases)

**Follow-up**: `GeometryEditor` likely has the same issue — see `followups.json`.

**Test**: `pnpm exec vitest run tests/unit/ui/axis-editor-undefined-elements.test.tsx --config ./vitest.config.unit.mts`
**Quality gates**: All passed (typecheck, lint, tests).
