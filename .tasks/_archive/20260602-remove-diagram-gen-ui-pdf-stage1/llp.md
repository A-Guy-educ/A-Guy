# LLP: Stage 1 - Remove Diagram Generator from PDF Conversion Flow

## Status: ✅ COMPLETED

All tasks completed and verified on 2026-02-06.

## Decisions (Locked)

- **Prompts collection**: Remove `diagram_generator` option entirely. Existing prompts in DB remain but cannot be created or selected.
- **TypeScript types**: Remove diagram fields from interfaces. MongoDB documents retain extra fields silently; no runtime impact.
- **No destructive migration**: No DB scripts. Existing job records with diagram data remain readable by MongoDB; TypeScript just ignores them.

## Inventory

### Files to delete (4)

| File                                                            | Purpose                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/server/services/exercise-conversion/diagram-pass.ts`       | Core diagram pass: detect, call LLM, insert TikZ                                    |
| `src/server/services/exercise-conversion/diagram-pass.types.ts` | `DiagramPassMetrics`, `DiagramPassResult`, `DiagramBlockInfo`, `DiagramPassContext` |
| `src/infra/llm/prompts/diagram-generator.ts`                    | `DEFAULT_DIAGRAM_GENERATOR_PROMPT` constant                                         |
| `tests/int/diagram-pass.int.spec.ts`                            | Unit tests for diagram detection, parsing, insertion                                |

### Files to modify (10)

| #   | File                                                             | What to change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/server/payload/jobs/types.ts`                               | Remove `diagramPromptId` from `PdfToExercisesInput.promptRefs`, `diagramGenerator` from `.promptSnapshot` and `.promptSnapshotHash`, remove `DiagramPassMetrics` interface, remove 6 diagram metric fields from `PdfToExercisesOutput`, remove `diagramPass` from segment debug                                                                                                                                                                                                                                             |
| 2   | `src/server/payload/jobs/pdf-to-exercises-task.ts`               | Remove `import { createDiagramMetrics, runDiagramPass }` (L20-22). Remove diagram metric fields from output init (L58-64). Remove diagram prompt fetch block (L118-148). Remove `diagramPrompt` from `processSegmentWithMultimodal` call (L155). Remove diagram metrics aggregation (L325-334). Remove `diagramPass` from segment debug (L347). Inside `processSegmentWithMultimodal`: remove `diagramPrompt` param (L448), remove entire diagram pass section (L543-559), remove `diagramPassMetricsForSegment` assignment |
| 3   | `src/app/api/exercises/convert/queue/route.ts`                   | Remove `diagramPromptId` from request destructuring (L62). Remove diagram fetch+validate block (L145-170). Remove `diagramHash` computation (L192). Remove `diagramPromptId` from `promptRefs` (L203). Remove `diagramGenerator` from `promptSnapshot` (L208) and `promptSnapshotHash` (L213)                                                                                                                                                                                                                               |
| 4   | `src/app/api/prompts/for-conversion/route.ts`                    | Remove diagram_generator query (L106-119). Remove `diagramGenerators` from JSON response (L140-147)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5   | `src/server/payload/services/exercise-conversion-service.ts`     | Remove `diagramPromptId` from `QueueConversionParams` (L12-13). Remove diagram prompt fetch (L98-110). Remove `diagramGenerator` from prompt snapshot (L116-117), hash computation (L123-124), `promptRefs` (L136-137), and `promptSnapshotHash` (L143-144)                                                                                                                                                                                                                                                                 |
| 6   | `src/server/services/exercise-conversion/helpers.ts`             | Remove `'diagram_generator'` from the usage type union on `validatePromptForUsageAndTenant` (L71)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7   | `src/server/payload/collections/Prompts.ts`                      | Remove `{ label: 'Diagram Generator', value: 'diagram_generator' }` from usage options (L94). Update admin description (L99)                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`         | Remove `diagramPrompts` state (L23), `selectedDiagram` state (L26). Remove `setDiagramPrompts` in fetch handler (L49). Remove `diagramPromptId` from submit body (L73). Remove diagram dropdown JSX (L217-238)                                                                                                                                                                                                                                                                                                              |
| 9   | `tests/unit/server/services/exercise-conversion/helpers.test.ts` | Remove test case `'should pass for valid diagram_generator prompt'` (L43-50)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 10  | `src/payload-types.ts`                                           | Auto-regenerated by `pnpm generate:types` - no manual edit                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Files NOT changed (incidental mentions, no functional impact)

- `tests/int/contracts/content.int.spec.ts` - fixture text `'Refer to the diagram below:'`
- `docs/a-guy/what-is-aguy.md` - `Diagram Context (future)` in roadmap
- `docs/block-rendering/README.md` - hypothetical `interactive_diagram` example
- `docs/ai-services/README.md`, `docs/exercise-import/README.md` - roadmap checkboxes
- `.tasks/diagram-roundtrip-pass/IMPLEMENTATION_PLAN.md` - historical, keep for reference

## Task Sequence

### Phase A: Delete dead code (5 min)

**Task 1**: Delete the 4 diagram-only files.

### Phase B: Clean types (10 min)

**Task 2**: Edit `types.ts` - remove `DiagramPassMetrics`, all diagram fields from input/output interfaces.

### Phase C: Clean backend (30 min)

**Task 3**: Clean task handler - remove imports, prompt fetch, metrics, aggregation, diagram pass section.

**Task 4**: Clean queue endpoint - remove diagram param, validation, hash, job input fields.

**Task 5**: Clean prompts-for-conversion endpoint - remove diagram query and response field.

**Task 6**: Clean exercise-conversion-service - remove diagram param, fetch, snapshot, hash fields.

**Task 7**: Clean helpers.ts - remove `'diagram_generator'` from usage union.

### Phase D: Clean collection config + UI (10 min)

**Task 8**: Clean Prompts collection - remove `diagram_generator` option and update description.

**Task 9**: Clean ConvertForm - remove state, fetch handler, submit field, dropdown JSX.

### Phase E: Clean tests (5 min)

**Task 10**: Remove diagram_generator test case from helpers test.

### Phase F: Regenerate + verify (15 min)

**Task 11**: `pnpm generate:types && pnpm generate:importmap`

**Task 12**: `pnpm tsc --noEmit` - fix cascade errors

**Task 13**: `pnpm test:unit` - all pass

**Task 14**: `pnpm lint && pnpm format`

## Verification Checklist

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes
- [ ] `pnpm lint` passes
- [ ] No import references to deleted files remain
- [ ] No `diagram_generator` usage option in Prompts collection
- [ ] ConvertForm renders without diagram dropdown
- [ ] Queue endpoint accepts request without `diagramPromptId`
- [ ] Task handler processes segments without diagram pass

## Estimated Total

~1.5 hours focused implementation + verification.
