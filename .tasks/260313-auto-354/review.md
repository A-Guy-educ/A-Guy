# Code Review: 260313-auto-354

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| FR-001: Up to 4 separate graphs in one block | `schemas.ts:451` (`z.array(...).min(1).max(4)`) | `exercise-multi-axis-block.int.spec.ts:20,38,53` (valid 2, rejects 5, rejects 0) | ✅ Met |
| FR-002: Default labels ("גרף 1") + editable | `schemas.ts:436` (`label: z.string().min(1)`) — data model supports label per graph | `exercise-multi-axis-block.int.spec.ts:74` (rejects empty label) | ⚠️ Partial |
| FR-003: Text positioned above or below graphs | `schemas.ts:450` (`textPosition: z.enum(['above','below'])`) + `MultiAxisRenderer/index.tsx:72-85` | `exercise-multi-axis-block.int.spec.ts:85` (validates textPosition=below) | ⚠️ Untested (no renderer test for positioning) |
| FR-004: Desktop side-by-side horizontal | `MultiAxisRenderer/index.tsx:42-57` (grid classes with lg breakpoints) | No renderer unit test exists | ⚠️ Untested |
| FR-005: Mobile 2-per-row grid | `MultiAxisRenderer/index.tsx:42-57` (`sm:grid-cols-2` breakpoint) | No renderer unit test exists | ⚠️ Untested |
| FR-006: Single graph full width | `MultiAxisRenderer/index.tsx:45-46` (`grid-cols-1`) | No renderer unit test exists | ⚠️ Untested |
| FR-007: Graph ordering | `schemas.ts:438` (`order: z.number().int().min(0)`) + `MultiAxisRenderer/index.tsx:67` (sort by order) | No renderer unit test for ordering | ⚠️ Untested |
| FR-008: Saved and presented to students | `ExerciseRenderer/index.tsx:336-358` (dispatch) + schema saves all fields | `exercise-multi-axis-block.int.spec.ts:20` (validates full block) | ⚠️ Untested (no ExerciseRenderer integration test) |
| Guardrail: Existing axis block works | `schemas.ts:562-575` (union unchanged except addition) | `exercise-multi-axis-block.int.spec.ts:108` | ✅ Met |
| Guardrail: Reuse JSXGraphBoard/AxisRenderer | `MultiAxisRenderer/index.tsx:99` (uses AxisRenderer) | N/A (structural) | ✅ Met |
| Guardrail: TypeScript safety from Zod | `types.ts:238-254` interfaces + `schemas.ts:433-465` Zod | `tsc --noEmit` passes | ✅ Met |
| Guardrail: No breaking ContentBlockSchema | `schemas.ts:562` (added as new union member) | `exercise-multi-axis-block.int.spec.ts:108` | ✅ Met |
| Guardrail: Follow existing schema patterns | `schemas.ts:445-465` (`.strict()`, `.superRefine()`) | Structural observation | ✅ Met |

**Spec Coverage**: 8/8 functional requirements addressed in code; 5/8 have schema tests only — **4 requirements lack renderer-level test coverage** (FR-003 positioning behavior, FR-004/FR-005 responsive layout, FR-006 single graph full width, FR-007 ordering behavior).

### FR-002 Detail: Default Labels

FR-002 states: *"Each individual graph must have a **default label** (e.g., 'גרף 1', 'גרף 2', etc.)"*. The schema requires a `label` string (`min(1)`) but there is **no default label generation logic anywhere**. The data model supports custom labels, but the "default" behavior would need to come from the admin UI (which is out of scope per spec). The schema correctly enforces a non-empty label — the spec's acceptance criterion "Each graph receives a default label which can be edited" is **partially met** at the data layer (label is required and editable), but the **automatic default generation** is deferred to the admin UI (out of scope). This is acceptable.

## Code Quality Findings

### Critical

None.

### Major

1. **[MultiAxisRenderer/index.tsx:20-25] Duplicated type definition** — `MultiAxisGraphItem` interface is redeclared locally instead of importing from `@/server/payload/collections/Exercises/types`. The canonical type already exists at `types.ts:238-243`. This creates a maintenance risk: if the canonical type changes, this local copy won't be updated.

2. **[ExerciseRenderer/index.tsx:337-347] Unsafe type assertion** — The multi-axis block is cast through `as unknown as { ... }` with an inline anonymous type. While this follows the existing pattern for `question_geometry` and `question_axis` (lines 321-334), it's still a type safety concern. The inline type could drift from the actual `QuestionMultiAxisBlock` interface. The build agent could have imported `QuestionMultiAxisBlock` from types.ts and used `as QuestionMultiAxisBlock` for a single-point-of-truth assertion.

3. **[MISSING] No renderer unit tests** — The plan called for `tests/unit/ui/multi-axis-renderer.test.tsx` (7 tests) and `tests/unit/ui/exercise-renderer-multi-axis.test.tsx` (3 tests). Neither file was created. The build report acknowledges the MultiAxisRenderer test was deleted due to jsdom environment issues and the ExerciseRenderer test was never created. This leaves FR-003 through FR-008 renderer behavior **untested**. While the schema tests are solid, the visual rendering logic (grid classes, ordering, text positioning) has zero test coverage.

### Minor

1. **[MultiAxisRenderer/index.tsx:61] Unused `blockId` prop** — The prop is received as `blockId: _blockId` (underscore prefix) indicating it's intentionally unused. However, passing it down to the component serves no purpose currently. Consider removing it from the interface or documenting its future use.

2. **[MultiAxisRenderer/index.tsx:69] Using `graphs.length` instead of `sortedGraphs.length`** — `getGridClasses(graphs.length)` is called with the original array length (which is the same as sorted), but for consistency it should reference `sortedGraphs.length` or compute outside the sort. This is functionally correct but slightly misleading since `sortedGraphs` is the primary data source.

3. **[ExerciseRenderer/index.tsx:354] Default fallback** — `textPosition={multiAxisBlock.textPosition ?? 'above'}` provides a runtime default. The Zod schema already has `.default('above')` so validated data will always have this field. The fallback is defensive/harmless but technically redundant for validated data.

4. **[MultiAxisRenderer/index.tsx:27-36] Inline prompt type** — The `prompt` prop type is defined inline as an object literal rather than importing/reusing `InlineRichText` from the types file. Minor readability issue.

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | N/A — no access control changes |
| No duplicated utilities | ✅ | Uses `cn` from `@/infra/utils/ui` |
| No duplicated validation schemas | ✅ | Reuses `AxisSpecV1Schema`, `InlineRichTextSchema` |
| Existing UI components used where possible | ✅ | Reuses `AxisRenderer`, `RichTextRenderer` |
| No `any` type escapes | ⚠️ | No `any` keyword used, but `as unknown as {...}` in ExerciseRenderer is equivalent |
| Functions reasonably sized (<50 lines) | ✅ | All functions under 50 lines |
| No magic numbers/strings | ✅ | Grid breakpoints are standard Tailwind; block type string is a literal discriminator |
| Error handling on all async ops | ✅ | N/A — no async operations in new code |
| **Duplicated type (MultiAxisGraphItem)** | ❌ | Local redeclaration in MultiAxisRenderer instead of import from types.ts |

## Summary

- **Issues Found**: Yes
- **Spec Satisfied**: Partial
- **Recommendation**: Fix Required

### Required Fixes (before merge):

1. **Major**: Import `MultiAxisGraphItem` from `@/server/payload/collections/Exercises/types` in `MultiAxisRenderer/index.tsx` instead of redeclaring it locally.
2. **Major**: Add at least basic renderer tests for `MultiAxisRenderer` covering: graph count rendering, ordering behavior, text positioning (above/below), and grid class application. Without these, 4 of 8 functional requirements are untested.
3. **Major**: In `ExerciseRenderer/index.tsx`, use `as QuestionMultiAxisBlock` import instead of inline anonymous type for the type assertion.

### Optional Improvements:

4. **Minor**: Import `InlineRichText` type for the `prompt` prop instead of inline object type.
5. **Minor**: Remove unused `blockId` prop or document its intended future use.
