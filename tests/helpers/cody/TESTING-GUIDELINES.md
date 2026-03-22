# Cody Pipeline Testing Guidelines

Rules and conventions for writing reliable, maintainable tests for the Cody pipeline.

## Mock Discipline

**Max 3 `vi.mock()` calls per test file.**

Every mock is a maintenance liability — it couples your test to an internal implementation detail. When the mocked module's API changes, your test breaks even if the behavior under test is unchanged.

- If you need more than 3 mocks, the test is likely too coupled to internals. Consider an integration test instead.
- Prefer dependency injection (e.g., `createMockPipelineContext()`) over `vi.mock()`.
- Use the shared helpers in `tests/helpers/cody/` — they provide pre-built mocks that stay up to date.

## Stage Assertions — Use Flexible Matchers

**Use `toContain` / `toBeGreaterThanOrEqual`, NOT `toEqual` / `toHaveLength`.**

Pipeline stage arrays change as the pipeline evolves. Hard-coding exact lengths or exact orderings creates fragile tests that break on every pipeline change.

```typescript
// BAD — breaks when a stage is added or removed
expect(flattenTypedPipeline(order)).toHaveLength(10)
expect(flattenTypedPipeline(order)).toEqual(['taskify', 'gap', ...])

// GOOD — survives pipeline evolution
expectPipelineContains(order, STAGES.BUILD)
expectStageOrder(order, STAGES.ARCHITECT, STAGES.BUILD)
expectMinimumStages(order, 5)
```

Import assertion helpers from the shared module:

```typescript
import {
  expectPipelineContains,
  expectStageOrder,
  expectMinimumStages,
  expectNoGhostStages,
} from '../../helpers/cody'
```

## Use STAGES Constants — No Raw String Literals

**Use `STAGES` constants from `scripts/cody/stages/registry`, never raw string literals in new tests.**

Raw strings like `'build'` or `'architect'` bypass compile-time typo detection and won't trigger errors if a stage is renamed.

```typescript
import { STAGES } from '../../../scripts/cody/stages/registry'

// BAD — invisible typo, no compile error
expectPipelineContains(order, 'biuld' as any)

// GOOD — compile error if STAGES.BUILD is renamed
expectPipelineContains(order, STAGES.BUILD)
```

## No Ghost Stage References

**Never reference removed stages: `'spec'`, `'autofix'`, `'reflect'`.**

These names were removed from the pipeline months ago:

| Ghost name | What happened                                      |
| ---------- | -------------------------------------------------- |
| `spec`     | Merged into `gap` stage                            |
| `autofix`  | Not a stage; it's a sub-behavior of build feedback |
| `reflect`  | Never existed as a pipeline stage                  |

Use `expectNoGhostStages(order)` to guard against accidental reintroduction.

If you genuinely need to assert that a ghost stage is absent (regression test), use the explicit negative assertion:

```typescript
expect(flat).not.toContain('spec')
```

## Prefer Integration Tests Over Unit Tests

Unit tests with heavy mocking are fragile and give false confidence. Prefer integration-style tests that exercise real pipeline logic:

- Use `createMockPipelineContext()` from `tests/helpers/cody/pipeline-test-harness.ts` to build a realistic context.
- Use `createValidTaskDefinition()` and `createValidPipelineState()` from `tests/helpers/cody/fixtures.ts` for realistic data.
- Only mock external I/O (file system, GitHub API, LLM calls) — not internal pipeline functions.

## Test File Naming

| Type             | Pattern                                              | Example                                    |
| ---------------- | ---------------------------------------------------- | ------------------------------------------ |
| Unit test        | `tests/unit/scripts/cody/<module>.test.ts`           | `pipeline-utils.test.ts`                   |
| Integration test | `tests/unit/scripts/cody/<name>.integration.test.ts` | `lightweight-pipeline.integration.test.ts` |
| Handler test     | `tests/unit/scripts/cody/handlers/<name>.test.ts`    | `verify-handler.test.ts`                   |
| Engine test      | `tests/unit/scripts/cody/engine/<name>.test.ts`      | `retry-loop.test.ts`                       |

## Shared Helpers

Always check `tests/helpers/cody/` before writing test utilities:

| Helper                        | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `createMockLogger()`          | Silent logger that captures calls        |
| `createMockRunnerBackend()`   | Mock agent runner backend                |
| `createMockPipelineContext()` | Realistic pipeline context with defaults |
| `createValidTaskDefinition()` | Valid task.json fixture                  |
| `createStageState()`          | Stage state factory                      |
| `createValidPipelineState()`  | Full pipeline state fixture              |
| `expectPipelineContains()`    | Assert stage exists in pipeline          |
| `expectStageOrder()`          | Assert stage A comes before stage B      |
| `expectMinimumStages()`       | Assert minimum stage count               |
| `expectNoGhostStages()`       | Assert no removed stages are present     |

## Lint Enforcement

Run `pnpm lint:test-fragility` to detect violations automatically:

- `toHaveLength(7..15)` on stage arrays → ERROR
- Ghost stage references (`'spec'`, `'autofix'`, `'reflect'`) → WARNING
- More than 4 `vi.mock()` calls per file → WARNING
