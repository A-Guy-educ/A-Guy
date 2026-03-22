# Plan: Cody Pipeline Stabilization — Type-Safe Registry + Test Architecture Overhaul

## Research Findings

### File Paths Verified
- ✅ `scripts/cody/stage-prompts.ts` — defines `ALL_STAGES`, `Stage` type (line 46), `STAGE_CONTEXT_FILES`, `stageInstructions`
- ✅ `scripts/cody/pipeline-utils.ts` — defines `STAGE_OUTPUT_MAP` (line 765), `STAGE_COMPLEXITY_THRESHOLDS` (line 66), `IMPL_PIPELINE` (line 878), `LIGHTWEIGHT_IMPL_PIPELINE` (line 906), `getImplPipeline`, `getAllImplStageNames`, `getSpecStagesForProfile`
- ✅ `scripts/cody/agent-runner.ts` — defines `STAGE_TIMEOUTS` (line 65), `DEFAULT_TIMEOUT` (line 62)
- ✅ `scripts/cody/pipeline/definitions.ts` — defines `SPEC_ORDER_STANDARD` (line 42), `IMPL_ORDER_STANDARD` (line 44), `createStageDefinitions` (line 90), `buildPipeline`, `rebuildPipelineAfterTaskify`
- ✅ `scripts/cody/handlers/handler.ts` — defines `getHandler` (line 29), takes `stageName: string`
- ✅ `scripts/cody/engine/types.ts` — defines `StageDefinition.name: string` (line 51), `PipelineStep = string | { parallel: string[] }` (line 82), `PipelineStateV2.stages: Record<string, StageStateV2>` (line 175), `PipelineStateV2.cursor: string | null` (line 174)
- ✅ `scripts/cody/engine/pipeline-resolver.ts` — imports `buildPipeline` and `rebuildPipelineAfterTaskify` from `pipeline/definitions.ts`
- ✅ `scripts/cody/cody-utils.ts` — imports `ALL_STAGES` from `stage-prompts`
- ✅ `scripts/cody/rerun-utils.ts` — imports `ALL_STAGES` from `stage-prompts`
- ✅ `scripts/cody/pipeline/skip-conditions.ts` — imports `STAGE_COMPLEXITY_THRESHOLDS` from `pipeline-utils`
- ✅ `scripts/cody/pipeline/post-actions.ts` — imports `STAGE_TIMEOUTS` from `agent-runner`
- ✅ `eslint-plugin-aguy/` — 5 CJS rules, disabled in `eslint.config.mjs` due to CJS/ESM incompatibility
- 🆕 `scripts/cody/stages/registry.ts` — will create (new file)
- 🆕 `tests/helpers/cody/` — will create (new directory)
- 🆕 `eslint-plugin-aguy/rules/no-exec-sync.js` — will create (new rule)
- 🆕 `tests/unit/scripts/cody/stage-registry.test.ts` — will create (new test)
- 🆕 `tests/int/scripts/cody/state-machine.int.spec.ts` — will create (new test)
- 🆕 `tests/int/scripts/cody/entry-modes.int.spec.ts` — will create (new test)

### Patterns Observed
- The `Stage` type exists in `stage-prompts.ts:46` but is **never imported** by any other file. All downstream maps use `Record<string, ...>` — zero compile-time safety.
- `pipeline/definitions.ts` is the authoritative runtime pipeline definition (called by `pipeline-resolver.ts → buildPipeline()`). `pipeline-utils.ts`'s `IMPL_PIPELINE` / `LIGHTWEIGHT_IMPL_PIPELINE` are only consumed by `stage-prompts.ts` for informational prompt context.
- The two definitions have **already diverged**: `pipeline-utils.ts` has a duplicate `commit` entry that `definitions.ts` intentionally removed with a comment explaining why.
- Ghost `'spec'` stage appears in `STAGE_TIMEOUTS` (line 67) and `DRY_RUN_OUTPUTS` (line 806). It was merged into `'gap'` but entries were never cleaned up.
- Ghost `'autofix'` is in `ALL_STAGES` but has no `StageDefinition` in `createStageDefinitions()` and no entry in any pipeline order array.
- Tests use 15+ copy-pasted `mockLogger` objects. No shared test helpers exist for cody.
- ~50 tests are "source code audit" tests that `readFileSync` source and assert string patterns — they break on any refactoring.
- ESLint custom plugin exists with security rules but is disabled due to CJS format.

### Integration Points
- `scripts/cody/engine/types.ts` — StageDefinition, PipelineStep, PipelineStateV2 types must be updated
- `scripts/cody/pipeline/definitions.ts` — imports `STAGE_TIMEOUTS` from agent-runner, `STAGE_COMPLEXITY_THRESHOLDS` from pipeline-utils
- `scripts/cody/stage-prompts.ts` — imports `stageOutputFile`, `getSpecStagesForProfile`, `getAllImplStageNames` from pipeline-utils
- `scripts/cody/cody-utils.ts` — imports `ALL_STAGES` from stage-prompts, derives `VALID_STAGES` and `STAGE_ORDER`
- `scripts/cody/rerun-utils.ts` — imports `ALL_STAGES` from stage-prompts
- `scripts/cody/handlers/handler.ts` — `getHandler(stageName: string, ...)` needs to accept `StageName`
- `eslint.config.mjs` — has TODO to enable custom plugin after CJS→ESM conversion

## Reuse Inventory

### Existing utilities to reuse
- `ms` from `ms` package — already used for timeouts in `agent-runner.ts`
- `z` from `zod` — already used for `PipelineStateV2Schema` in `engine/types.ts`
- `flattenPipeline()` from `pipeline-utils.ts` — keep, just type-narrow its input
- `isParallelStage()` from `pipeline-utils.ts` — keep, just type-narrow
- `eslint-plugin-aguy/` existing infrastructure — extend with new rule, convert to ESM

### New utilities (justified)
- `scripts/cody/stages/registry.ts` — **MUST be new**. The entire point is a single source of truth that doesn't exist today. No existing utility serves this purpose.
- `tests/helpers/cody/mock-logger.ts` — **MUST be new**. Currently 15+ copy-pasted mocks with no shared helper. This is the canonical "extract duplicate" refactor.
- `tests/helpers/cody/fixtures.ts` — **MUST be new**. Test fixtures are currently inline in each test file, duplicated across tests.
- `tests/helpers/cody/pipeline-test-harness.ts` — **MUST be new**. No way to create a minimal `PipelineContext` for testing currently; each test builds it from scratch differently.

---

## Step 1: Create Type-Safe Stage Registry (Foundation)

**Files to Touch:**
- `scripts/cody/stages/registry.ts` (NEW)
- `tests/unit/scripts/cody/stage-registry.test.ts` (NEW)

**Exact Behavior:**

Create `scripts/cody/stages/registry.ts` as the single source of truth for all stage metadata:

1. Define `STAGE_NAMES` as a `const` tuple of all valid stage names: `['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'commit', 'review', 'fix', 'verify', 'pr']`
   - Excludes `'autofix'` (not a real pipeline stage — it's a sub-behavior of verify/build feedback)
   - Excludes `'docs'` — verify if docs is a real pipeline stage or deferred to inspector (it has a `StageDefinition` in `createStageDefinitions()` but no order entry; include it only if it has a definition)
   - Excludes `'spec'` (merged into `'gap'` months ago — ghost stage)

2. Export `StageName` type: `type StageName = (typeof STAGE_NAMES)[number]`

3. Define `StageMetadata` interface:
   ```typescript
   interface StageMetadata {
     outputFile: string      // e.g., 'task.json', 'plan.md'
     timeout: number         // in milliseconds
     complexityThreshold: number  // 0 = always runs
     contextFiles: string[]  // files the stage reads
     type: 'agent' | 'scripted' | 'git' | 'gate'  // handler dispatch type
   }
   ```

4. Define `STAGE_REGISTRY` as `Record<StageName, StageMetadata>` — TypeScript requires ALL keys present. Missing a stage = compile error. Extra stage = compile error.

5. Export helper functions that replace scattered maps:
   - `getStageOutputFile(stage: StageName): string`
   - `getStageTimeout(stage: StageName): number`
   - `getStageComplexityThreshold(stage: StageName): number`
   - `getStageContextFiles(stage: StageName): string[]`
   - `isValidStageName(name: string): name is StageName` — type guard for runtime validation
   - `assertStageName(name: string): StageName` — throws if invalid

6. Export typed pipeline order arrays (moved from `definitions.ts`):
   - `SPEC_ORDER_STANDARD: StageName[]`
   - `SPEC_ORDER_LIGHTWEIGHT: StageName[]`
   - `IMPL_ORDER_STANDARD: TypedPipelineStep[]` where `TypedPipelineStep = StageName | { parallel: StageName[] }`
   - `IMPL_ORDER_LIGHTWEIGHT: TypedPipelineStep[]`
   - `FIX_ORDER: TypedPipelineStep[]`
   - `FIX_FULL_ORDER: TypedPipelineStep[]`

**Tests (FAIL before, PASS after):**

`tests/unit/scripts/cody/stage-registry.test.ts`:
1. `STAGE_NAMES contains all expected stages` — asserts the exact list
2. `STAGE_REGISTRY has an entry for every STAGE_NAME` — compiler enforces this but runtime check too
3. `isValidStageName returns true for valid names, false for invalid` — tests `'build'` (true), `'spec'` (false), `'autofix'` (false)
4. `assertStageName throws for invalid names` — tests `'nonexistent'`
5. `getStageOutputFile returns correct file for each stage` — tests key stages like `taskify → 'task.json'`, `gap → 'gap.md'`
6. `pipeline order arrays contain only valid StageName values` — flattens each array, asserts every entry passes `isValidStageName`
7. `no duplicate stages in pipeline orders` — for each order array, asserts unique entries (catches the old duplicate `commit` bug)
8. `TypedPipelineStep type prevents invalid stage names` — compile-time check (this test verifies the types compile, essentially a smoke test)

**Acceptance Criteria:**
- [ ] `STAGE_NAMES` is an `as const` tuple with exactly 12 entries (or 13 if `docs` is included)
- [ ] `StageName` type is exported and usable in other files
- [ ] `STAGE_REGISTRY` is typed as `Record<StageName, StageMetadata>` — adding/removing from `STAGE_NAMES` without updating `STAGE_REGISTRY` causes a compile error
- [ ] All pipeline order arrays are typed as `(StageName | { parallel: StageName[] })[]`
- [ ] Helper functions are pure, no side effects, no filesystem access
- [ ] `pnpm tsc --noEmit` passes
- [ ] All 8 tests pass

---

## Step 2: Wire Engine Types to Use StageName

**Files to Touch:**
- `scripts/cody/engine/types.ts` (MODIFIED — lines 50-51, 82, 84-85, 174-175)
- `scripts/cody/handlers/handler.ts` (MODIFIED — line 29)

**Exact Behavior:**

Update `engine/types.ts`:
1. Import `StageName` from `../stages/registry`
2. Change `StageDefinition.name: string` → `StageDefinition.name: StageName` (line 51)
3. Change `PipelineStep = string | { parallel: string[] }` → `PipelineStep = StageName | { parallel: StageName[] }` (line 82)
4. Change `PipelineDefinition.stages: Map<string, StageDefinition>` → `Map<StageName, StageDefinition>` (line 85)
5. Change `PipelineDefinition.order: PipelineStep[]` (already typed via PipelineStep change)
6. Change `PipelineStateV2.cursor: string | null` → `StageName | null` (line 174)
7. **DO NOT change** `PipelineStateV2.stages: Record<string, StageStateV2>` yet — this is the runtime status.json schema and changing it requires migration logic. Leave as `Record<string, StageStateV2>` for now but add a TODO comment.
8. Change `ActorEvent.stage?: string` → `ActorEvent.stage?: StageName` (line 161)

Update `handlers/handler.ts`:
1. Import `StageName` from `../stages/registry`
2. Change `getHandler(stageName: string, ...)` → `getHandler(stageName: StageName, ...)` (line 29)

**Tests (FAIL before, PASS after):**

Existing tests in `tests/unit/scripts/cody/engine/` should continue to pass after updating types (they test behavior, not types). Add:

1. `getHandler returns correct handler for each non-agent stage` — tests `'commit'` → GitCommitHandler, `'pr'` → GitPrHandler, `'verify'` → ScriptedVerifyHandler
2. `getHandler returns AgentHandler for agent-typed stages` — tests `'build'`, `'architect'`
3. **Compile-time verification**: `pnpm tsc --noEmit` passes with narrowed types — any file passing a `string` where `StageName` is expected will error

**Acceptance Criteria:**
- [ ] `StageDefinition.name` is typed as `StageName`
- [ ] `PipelineStep` uses `StageName` not `string`
- [ ] `getHandler` accepts `StageName` not `string`
- [ ] All existing engine tests pass
- [ ] `pnpm tsc --noEmit` passes (this will surface all downstream files that need updating)

---

## Step 3: Migrate Consumers to Use Registry (Eliminate Scattered Maps)

**Files to Touch:**
- `scripts/cody/pipeline-utils.ts` (MODIFIED — delete `STAGE_OUTPUT_MAP`, `STAGE_COMPLEXITY_THRESHOLDS`, `IMPL_PIPELINE`, `LIGHTWEIGHT_IMPL_PIPELINE`, `ALL_IMPL_STAGE_NAMES`, `ALL_LIGHTWEIGHT_IMPL_STAGE_NAMES`, `getImplPipeline`, `getAllImplStageNames`, `getSpecStagesForProfile`, `SPEC_ONLY_STAGES`, `NON_SKIPPABLE_STAGES`, `SKIPPABLE_STAGES`)
- `scripts/cody/agent-runner.ts` (MODIFIED — delete `STAGE_TIMEOUTS`, replace with import from registry)
- `scripts/cody/stage-prompts.ts` (MODIFIED — delete `ALL_STAGES`, `Stage`, `SPEC_STAGES`, `STAGE_CONTEXT_FILES`, replace with imports from registry)
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — delete local `SPEC_ORDER_*` / `IMPL_ORDER_*`, import from registry, update `createStageDefinitions` to use `StageName`)
- `scripts/cody/pipeline/skip-conditions.ts` (MODIFIED — import from registry instead of pipeline-utils)
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — import timeout from registry instead of agent-runner)
- `scripts/cody/cody-utils.ts` (MODIFIED — import `STAGE_NAMES` from registry instead of `ALL_STAGES` from stage-prompts)
- `scripts/cody/rerun-utils.ts` (MODIFIED — import from registry)
- `scripts/cody/engine/pipeline-resolver.ts` (MODIFIED — may need import updates)
- `scripts/cody/entry.ts` (MODIFIED — update any string literals to use StageName type)
- `scripts/cody/engine/status.ts` (MODIFIED — import `stageOutputFile` from registry instead of pipeline-utils)
- `scripts/cody/handlers/agent-handler.ts` (MODIFIED — import `stageOutputFile` from registry)

**Exact Behavior:**

For each file:

**`pipeline-utils.ts`:**
- DELETE: `STAGE_OUTPUT_MAP` (lines 765-774), `stageOutputFile()` (lines 776-779), `STAGE_COMPLEXITY_THRESHOLDS` (lines 66-80), `IMPL_PIPELINE` (lines 878-888), `LIGHTWEIGHT_IMPL_PIPELINE` (lines 906-915), `ALL_IMPL_STAGE_NAMES` (line 893), `ALL_LIGHTWEIGHT_IMPL_STAGE_NAMES` (line 920), `getImplPipeline()` (lines 925-927), `getAllImplStageNames()` (lines 932-934), `getSpecStagesForProfile()` (lines 942-954), `SPEC_ONLY_STAGES` (line 783), `NON_SKIPPABLE_STAGES` (line 36), `SKIPPABLE_STAGES` (line 39)
- KEEP: `readTask()`, `writeDryRunOutput()`, `flattenPipeline()`, `isParallelStage()`, `flattenStage()`, `PipelineStage` type (but rename/update to use `StageName`), `ComplexityTier`, `InputQuality`, Zod schemas
- RE-EXPORT: For backward compat, re-export `stageOutputFile`, `STAGE_COMPLEXITY_THRESHOLDS` from registry (if too many external importers). OR update all importers directly.
- Update `DRY_RUN_OUTPUTS` — remove ghost `'spec'` entry (line 806)

**`agent-runner.ts`:**
- DELETE: `STAGE_TIMEOUTS` (lines 65-80)
- IMPORT: `getStageTimeout` from `./stages/registry`
- UPDATE: any usage of `STAGE_TIMEOUTS[stage]` → `getStageTimeout(stage)` (need to handle the stage name type narrowing)
- KEEP: `DEFAULT_TIMEOUT` (it's a fallback, not stage-specific)

**`stage-prompts.ts`:**
- DELETE: `ALL_STAGES` (lines 29-44), `Stage` type (line 46), `SPEC_STAGES` (line 21), `SpecStage` (line 23), `STAGE_CONTEXT_FILES` (lines 69-116)
- IMPORT: `STAGE_NAMES`, `StageName`, `getStageContextFiles` from `./stages/registry`
- UPDATE: `buildStagePrompt()` to use `StageName` parameter
- UPDATE: `stageInstructions` to use `StageName` key type
- IMPORT: pipeline order arrays from registry (replacing `getAllImplStageNames`/`getSpecStagesForProfile`)

**`pipeline/definitions.ts`:**
- DELETE: `SPEC_ORDER_STANDARD`, `SPEC_ORDER_LIGHTWEIGHT`, `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`, `FIX_ORDER`, `FIX_FULL_ORDER` (lines 42-82)
- IMPORT: these from `../stages/registry`
- UPDATE: `createStageDefinitions()` — use `StageName` for `stages.set()` calls
- UPDATE: `buildPipeline()` — use typed pipeline steps
- DELETE: import of `STAGE_TIMEOUTS` from `agent-runner` → use `getStageTimeout()` from registry
- DELETE: import of `STAGE_COMPLEXITY_THRESHOLDS` from `pipeline-utils` → use `getStageComplexityThreshold()` from registry

**`pipeline/skip-conditions.ts`:**
- UPDATE: Import `getStageComplexityThreshold` from registry
- UPDATE: Function parameters from `string` to `StageName` where appropriate

**`cody-utils.ts`:**
- UPDATE: Import `STAGE_NAMES` from `./stages/registry` instead of `ALL_STAGES` from `./stage-prompts`
- UPDATE: `VALID_STAGES` and `STAGE_ORDER` derivations

**`rerun-utils.ts`:**
- UPDATE: Import `STAGE_NAMES` from `./stages/registry` instead of `ALL_STAGES` from `./stage-prompts`

**Tests (FAIL before, PASS after):**

After this step, `pnpm tsc --noEmit` MUST pass. This is the primary test gate — the compiler itself catches every missed consumer.

Additionally:
1. All existing unit tests that reference deleted exports (`STAGE_TIMEOUTS`, `STAGE_COMPLEXITY_THRESHOLDS`, `ALL_STAGES`, etc.) will fail. These must be updated to import from registry. This is expected and intentional — the test failures point to exactly what needs updating.
2. `pnpm test:unit -- --run tests/unit/scripts/cody/` must pass after all test imports are updated.

**Acceptance Criteria:**
- [ ] Zero independent stage-name maps remain outside `registry.ts`
- [ ] `pipeline-utils.ts` no longer exports `IMPL_PIPELINE`, `LIGHTWEIGHT_IMPL_PIPELINE`, `STAGE_OUTPUT_MAP`, `STAGE_COMPLEXITY_THRESHOLDS`, `getAllImplStageNames`, `getImplPipeline`, `getSpecStagesForProfile`
- [ ] `agent-runner.ts` no longer exports `STAGE_TIMEOUTS`
- [ ] `stage-prompts.ts` no longer exports `ALL_STAGES`, `Stage`, `STAGE_CONTEXT_FILES`
- [ ] Ghost `'spec'` removed from `DRY_RUN_OUTPUTS`
- [ ] Ghost `'autofix'` not in `STAGE_NAMES` (it was never a real pipeline stage)
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit -- --run tests/unit/scripts/cody/` passes

---

## Step 4: Create Shared Test Infrastructure

**Files to Touch:**
- `tests/helpers/cody/mock-logger.ts` (NEW)
- `tests/helpers/cody/fixtures.ts` (NEW)
- `tests/helpers/cody/pipeline-test-harness.ts` (NEW)
- `tests/helpers/cody/index.ts` (NEW — barrel export)

**Exact Behavior:**

**`mock-logger.ts`:**
Create a single shared mock logger matching the pino logger interface used across the codebase:
```typescript
export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }
}
```

**`fixtures.ts`:**
Extract common test fixtures:
- `createValidTaskDefinition(overrides?)` — returns a valid `TaskDefinition` object
- `createValidPipelineState(overrides?)` — returns a valid `PipelineStateV2` object
- `createStageState(overrides?)` — returns a valid `StageStateV2` object
- `MOCK_TASK_MD` — sample task.md content
- `MOCK_SPEC_MD` — sample spec.md content

**`pipeline-test-harness.ts`:**
Create a minimal `PipelineContext` factory:
```typescript
export function createMockPipelineContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    taskId: 'test-task-001',
    taskDir: '/tmp/test-tasks/test-task-001',
    input: { mode: 'full', taskId: 'test-task-001' } as CodyInput,
    taskDef: null,
    profile: 'standard',
    backend: createMockRunnerBackend(),
    ...overrides,
  }
}

export function createMockRunnerBackend(): RunnerBackend { ... }
```

**Tests:** These helpers don't need their own tests — they're tested by being used in Steps 5-7.

**Acceptance Criteria:**
- [ ] `createMockLogger()` returns a mock matching all pino methods used in cody pipeline
- [ ] `createMockPipelineContext()` returns a valid context that `createStageDefinitions()` can consume
- [ ] `createValidTaskDefinition()` produces output that passes the Zod task schema
- [ ] All files export from `tests/helpers/cody/index.ts`

---

## Step 5: Convert ESLint Plugin to ESM and Add Security Rules

**Files to Touch:**
- `eslint-plugin-aguy/index.js` (MODIFIED — convert to ESM, rename to `.mjs`)
- `eslint-plugin-aguy/rules/require-collection-access.js` → `.mjs` (MODIFIED)
- `eslint-plugin-aguy/rules/require-auth-endpoints.js` → `.mjs` (MODIFIED — also fix `this.checkForAuthInBody` bug)
- `eslint-plugin-aguy/rules/no-nested-metadata.js` → `.mjs` (MODIFIED)
- `eslint-plugin-aguy/rules/tailwind-only-components.js` → `.mjs` (MODIFIED)
- `eslint-plugin-aguy/rules/file-location.js` → `.mjs` (MODIFIED)
- `eslint-plugin-aguy/rules/no-exec-sync.mjs` (NEW — security rule)
- `eslint.config.mjs` (MODIFIED — enable custom plugin)

**Exact Behavior:**

1. Convert each `.js` file to ESM:
   - `module.exports = { ... }` → `export default { ... }`
   - `const x = require('y')` → `import x from 'y'` (if any)
   - Rename `.js` → `.mjs`

2. Fix `require-auth-endpoints.mjs`:
   - Move `checkForAuthInBody` from `module.exports` method to standalone function inside the `create()` scope
   - This fixes the runtime `this` context bug

3. Create `no-exec-sync.mjs`:
   - Rule: Disallow `execSync` in `scripts/cody/` files
   - Allow `execFileSync` (which is the safe alternative)
   - Meta: `type: 'problem'`, `docs: { description: 'Disallow execSync — use execFileSync for shell injection prevention' }`
   - Implementation: Check `CallExpression` where callee name is `execSync` or `MemberExpression` ending in `execSync`

4. Update `eslint.config.mjs`:
   - Remove the TODO comment about CJS incompatibility
   - Import the plugin: `import aguyPlugin from './eslint-plugin-aguy/index.mjs'`
   - Add plugin to flat config: `{ plugins: { aguy: aguyPlugin } }`
   - Enable rules:
     - `'aguy/require-collection-access': 'error'` (scoped to `src/server/payload/collections/`)
     - `'aguy/no-exec-sync': 'error'` (scoped to `scripts/cody/`)
     - `'aguy/tailwind-only-components': 'warn'` (scoped to `src/ui/`, `src/app/`)
   - DO NOT enable `require-auth-endpoints` yet (needs more testing of the fix)
   - DO NOT enable `no-nested-metadata` yet (needs testing)

**Tests (FAIL before, PASS after):**

1. `pnpm lint -- scripts/cody/git-utils.ts` passes (confirms no `execSync` usage in already-fixed files)
2. `pnpm lint` passes overall (no new lint errors introduced)
3. Create `tests/unit/eslint-plugin-aguy/no-exec-sync.test.ts`:
   - Test: `flags execSync usage` — code with `execSync(...)` → error
   - Test: `allows execFileSync usage` — code with `execFileSync(...)` → no error
   - Test: `flags require('child_process').execSync` — member expression → error

**Acceptance Criteria:**
- [ ] All 5 existing rules converted to ESM (`.mjs` files)
- [ ] `require-auth-endpoints` bug fixed (no more `this` context issue)
- [ ] `no-exec-sync` rule exists and correctly flags `execSync`
- [ ] `eslint.config.mjs` imports and enables the plugin
- [ ] `pnpm lint` passes
- [ ] `pnpm tsc --noEmit` passes

---

## Step 6: Replace Source Code Audit Tests with Behavioral Tests

**Files to Touch:**
- `tests/unit/scripts/cody/pipeline-bugfixes.test.ts` (MODIFIED — keep behavioral tests, delete source code audits)
- `tests/unit/scripts/cody/pipeline-bugfixes-round2.test.ts` (MODIFIED — keep behavioral, delete source audits)
- `tests/unit/scripts/cody/pipeline-bugfixes-round3.test.ts` (MODIFIED — keep behavioral, delete source audits)
- `tests/unit/scripts/cody/cody-utils-security.test.ts` (DELETE — entirely replaced by lint rule)
- Multiple test files (MODIFIED — replace inline `mockLogger` with shared import)

**Exact Behavior:**

1. **Delete source code audit tests** — tests that `readFileSync` source code and assert string patterns. These are replaced by the `no-exec-sync` lint rule (Step 5). Specifically:
   - `pipeline-bugfixes-round2.test.ts`: Delete tests that scan for `execSync` patterns, memory caps in source, etc. Keep tests that verify actual runtime behavior (e.g., `syncSleep returns expected delay`, `parseSafetyCheck validates authors`).
   - `pipeline-bugfixes-round3.test.ts`: Delete tests that scan for `execFileSync` migration, `fdatasync` usage, truncation patterns. Keep tests that verify runtime behavior (e.g., `writeState does atomic write`, `truncateOutput caps at limit`).
   - `cody-utils-security.test.ts`: DELETE entirely — all tests are source code audits. The lint rule now catches this.

2. **Replace inline mockLogger** — in each test file that defines its own `mockLogger`:
   - Replace `const mockLogger = { info: vi.fn(), ... }` with `import { createMockLogger } from 'tests/helpers/cody'`
   - Update `vi.mock('../logger', ...)` to return `{ logger: createMockLogger() }`

3. **Replace hardcoded stage count assertions** — find tests like `expect(ALL_IMPL_STAGE_NAMES).toHaveLength(10)` and replace with:
   - `expect(STAGE_NAMES.length).toBeGreaterThan(0)` (stages exist)
   - `expect(STAGE_NAMES).toContain('build')` (specific stages present)
   - Do NOT assert exact count — this breaks whenever a stage is added/removed

**Tests (FAIL before, PASS after):**

After deletion/modification:
1. `pnpm test:unit -- --run tests/unit/scripts/cody/pipeline-bugfixes.test.ts` passes (remaining behavioral tests)
2. `pnpm test:unit -- --run tests/unit/scripts/cody/pipeline-bugfixes-round2.test.ts` passes
3. `pnpm test:unit -- --run tests/unit/scripts/cody/pipeline-bugfixes-round3.test.ts` passes
4. `cody-utils-security.test.ts` no longer exists (or is empty)
5. `pnpm lint -- scripts/cody/` passes (lint rules cover the deleted test assertions)

**Acceptance Criteria:**
- [ ] Zero tests use `readFileSync` to scan pipeline source code for string patterns
- [ ] All remaining tests verify runtime behavior, not source code structure
- [ ] No inline `mockLogger` definitions remain in cody test files
- [ ] No hardcoded stage count assertions remain (e.g., `.toHaveLength(10)`)
- [ ] `pnpm test:unit` passes
- [ ] Net test count decreases by ~40-50 (source audit tests removed)

---

## Step 7: Add Integration Tests for State Machine and Entry Modes

**Files to Touch:**
- `tests/int/scripts/cody/state-machine.int.spec.ts` (NEW)
- `tests/int/scripts/cody/entry-modes.int.spec.ts` (NEW)

**Exact Behavior:**

**`state-machine.int.spec.ts`:**
Integration tests for `runPipeline()` from `engine/state-machine.ts`. Uses mock handlers (no real LLMs, no real git) but real state machine logic, real status.json writes (to temp dir), real pipeline resolution.

Tests:
1. `executes a 3-stage linear pipeline to completion` — creates a pipeline with 3 mock agent stages, runs it, verifies all stages reach `completed` in status.json, pipeline state is `completed`
2. `stops pipeline on stage failure` — second stage fails, verifies pipeline state is `failed`, third stage is still `pending`
3. `handles parallel stage execution` — pipeline has `{ parallel: ['a', 'b'] }`, both execute, verifies both complete
4. `verify-fix loop retries on failure` — verify fails, fix runs, verify retries. Verifies `fixAttempt` counter increments.
5. `verify-fix loop stops at maxFixAttempts` — verify fails 3 times, pipeline fails
6. `pipeline rebuild callback replaces remaining stages` — sets `pipelineNeedsRebuild`, provides rebuild callback that adds new stages
7. `skips stages when shouldSkip returns true` — stage with skip condition gets state `skipped`
8. `recovers stale running stages on load` — writes status.json with a stage in `running`, loads pipeline, verifies it's reset to `pending`

**`entry-modes.int.spec.ts`:**
Integration tests for the mode resolution in `resolvePipelineForMode()` from `engine/pipeline-resolver.ts`. Tests pipeline construction, not execution.

Tests:
1. `full mode produces spec + impl stages` — verifies pipeline order contains both taskify/gap/clarify AND architect/build/etc.
2. `spec mode produces only spec stages` — no impl stages
3. `impl mode produces only impl stages` — no spec stages
4. `rerun mode with failed build stage starts from architect` — when feedback is provided and fromStage > plan-gap
5. `fix mode produces fix pipeline` — FIX_ORDER stages
6. `lightweight profile excludes gap and plan-gap` — complexity < 35 produces lightweight pipeline
7. `standard profile includes gap and plan-gap` — complexity >= 50 produces standard pipeline
8. `pipeline orders use only valid StageName values` — flatten all pipeline orders, verify each against `isValidStageName`

**Tests FAIL before:** These test files don't exist yet. After creation, they must pass.

**Acceptance Criteria:**
- [ ] State machine integration tests cover: linear execution, failure, parallel, verify-fix loop, rebuild, skip, recovery
- [ ] Entry mode tests cover: all 5 modes (full, spec, impl, rerun, fix), profile routing
- [ ] All tests use `createMockPipelineContext()` from shared helpers
- [ ] All tests use temp directories for status.json (no pollution)
- [ ] Tests clean up temp dirs in `afterAll`
- [ ] `pnpm test:int:cody` passes (or the appropriate test command for these files)

---

## Step 8: Refactor Brittle Mock Tests to Behavior-Focused

**Files to Touch:**
- `tests/unit/scripts/cody/git-utils.test.ts` (MODIFIED — ~20 tests refactored)
- `tests/unit/scripts/cody/agent-runner.test.ts` (MODIFIED — ~5 tests refactored)
- `tests/unit/scripts/cody/stage-prompts.test.ts` (MODIFIED — update imports from registry)
- `tests/unit/scripts/cody/pipeline-utils.test.ts` (MODIFIED — update imports, delete tests for removed exports)
- ~10 other test files (MODIFIED — update imports for `ALL_STAGES`, `STAGE_TIMEOUTS`, etc.)

**Exact Behavior:**

**`git-utils.test.ts` refactoring strategy:**
- KEEP: Tests that verify branch naming rules (e.g., "deriveBranchName produces feat/ prefix for implement_feature")
- KEEP: Tests that verify error handling (e.g., "pushWithRebase retries on rejection")
- REFACTOR: Tests that assert exact `execFileSync` call sequences — instead of:
  ```typescript
  expect(execFileSync).toHaveBeenNthCalledWith(1, 'git', ['fetch', 'origin'])
  expect(execFileSync).toHaveBeenNthCalledWith(2, 'git', ['checkout', '-b', 'feat/...'])
  ```
  Change to:
  ```typescript
  const result = await ensureFeatureBranch(ctx)
  expect(result).toBe('feat/my-branch')
  expect(execFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout']), expect.any(Object))
  ```
- DELETE: Tests that count exact number of `execFileSync` calls

**`pipeline-utils.test.ts` refactoring:**
- DELETE: Tests for `IMPL_PIPELINE`, `LIGHTWEIGHT_IMPL_PIPELINE`, `getAllImplStageNames()`, `getImplPipeline()`, `getSpecStagesForProfile()` — these exports no longer exist
- DELETE: Tests for `STAGE_OUTPUT_MAP`, `STAGE_COMPLEXITY_THRESHOLDS` — moved to registry
- KEEP: Tests for `readTask()`, `writeDryRunOutput()`, `flattenPipeline()`, Zod validation, etc.
- UPDATE: Remaining tests to import from registry where needed

**General pattern for all test files:**
- Replace `import { ALL_STAGES } from '../../scripts/cody/stage-prompts'` with `import { STAGE_NAMES } from '../../scripts/cody/stages/registry'`
- Replace `import { STAGE_TIMEOUTS } from '../../scripts/cody/agent-runner'` with `import { getStageTimeout } from '../../scripts/cody/stages/registry'`
- Replace `import { STAGE_COMPLEXITY_THRESHOLDS } from '../../scripts/cody/pipeline-utils'` with `import { getStageComplexityThreshold } from '../../scripts/cody/stages/registry'`
- Replace inline mockLogger with shared helper

**Tests (FAIL before, PASS after):**

All existing tests should either:
1. Pass with updated imports (behavioral tests that just reference different sources)
2. Be deleted (tests for removed exports)
3. Be refactored (brittle implementation tests → behavior tests)

Final gate: `pnpm test:unit -- --run tests/unit/scripts/cody/` passes with zero failures.

**Acceptance Criteria:**
- [ ] No test asserts exact `execFileSync` call count
- [ ] No test asserts exact nth-call argument sequences for git commands
- [ ] Tests deleted for removed exports (IMPL_PIPELINE, STAGE_TIMEOUTS, etc.)
- [ ] All remaining tests import from registry where stage names/metadata are needed
- [ ] `pnpm test:unit` passes with zero failures
- [ ] `pnpm tsc --noEmit` passes

---

## Step 9: Final Verification and Cleanup

**Files to Touch:**
- Various files (cleanup: remove stale comments, update README)
- `scripts/cody/README.md` (MODIFIED — update architecture section to reference registry)

**Exact Behavior:**

1. Run full quality gates:
   - `pnpm tsc --noEmit` — type check
   - `pnpm lint` — lint check (now with security rules)
   - `pnpm test:unit` — all unit tests
   - `pnpm test:int:cody` — cody integration tests

2. Update `scripts/cody/README.md`:
   - Add "Stage Registry" section explaining the single source of truth pattern
   - Update "Known Gotchas" to remove resolved issues
   - Update file listing to include `stages/registry.ts`

3. Clean up stale comments:
   - Remove `// NOTE: SPEC_EXECUTE_VERIFY_STAGES and ALL_IMPL_STAGES were removed (stale).` from `pipeline-utils.ts` (line 785-786) — the entire section they reference is now gone
   - Remove TODO comments in `eslint.config.mjs` about CJS conversion
   - Update any comments that reference the old `ALL_STAGES` or `STAGE_TIMEOUTS` locations

4. Verify no circular imports:
   - `registry.ts` should have ZERO imports from other cody modules (it's the leaf dependency)
   - Other modules import FROM registry, never the reverse

**Tests:** All quality gates pass. This is a verification step, not a new-code step.

**Acceptance Criteria:**
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:int:cody` passes
- [ ] `scripts/cody/README.md` updated
- [ ] No circular imports involving `registry.ts`
- [ ] No stale comments referencing deleted exports
- [ ] Single PR contains all changes, ready for review

---

## Summary: What Changes at the End

### Before (fragile)
```
stage-prompts.ts    → ALL_STAGES (14 entries including ghosts)
pipeline-utils.ts   → STAGE_OUTPUT_MAP, STAGE_COMPLEXITY_THRESHOLDS, IMPL_PIPELINE (diverged)
agent-runner.ts     → STAGE_TIMEOUTS (with ghost 'spec')
definitions.ts      → IMPL_ORDER_STANDARD (authoritative but not enforced)
engine/types.ts     → StageDefinition.name: string (no validation)
handler.ts          → getHandler(stageName: string) (no validation)
81 test files       → 50 source audits, 15 duplicated loggers, brittle mocks
```

### After (stable)
```
stages/registry.ts  → STAGE_NAMES, STAGE_REGISTRY, StageName type (SINGLE SOURCE OF TRUTH)
                       All metadata (timeouts, thresholds, output files, context files) in one Record<StageName, ...>
                       All pipeline orders typed as StageName[]
                       Compiler errors on any mismatch
engine/types.ts     → StageDefinition.name: StageName (compile-time validated)
handler.ts          → getHandler(stageName: StageName) (compile-time validated)
eslint rules        → no-exec-sync (security at commit time, not test time)
~35 test files      → Shared helpers, behavior-focused, import from registry
+10 new tests       → State machine integration, entry mode routing
```

### Quantified improvement
- **Independent stage-name maps**: 6 → 1
- **Ghost stages**: 2 → 0
- **Duplicate pipeline definitions**: 2 → 1
- **Source code audit tests**: ~50 → 0 (replaced by lint rules)
- **Duplicated mock loggers**: 15+ → 1 shared
- **Compile-time stage validation**: 0 files → all files
- **Integration tests for orchestration**: 0 → ~16 new tests
