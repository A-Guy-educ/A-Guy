# Cody Pipeline Stability Overhaul — RADICAL Solution

## The Problem (Revisited)

The current architecture spreads stage configuration across **6 files**:

| File | What It Defines |
|------|----------------|
| `stages/registry.ts` | Stage names, metadata, context files |
| `pipeline/definitions.ts` | Handlers, post-actions, skip logic |
| `pipeline/skip-conditions.ts` | Skip condition functions |
| `handlers/handler.ts` | Handler dispatch (switch statement!) |
| `engine/state-machine.ts` | Retry logic hardcoded for verify/fix |
| `pipeline/post-actions.ts` | Post-action definitions |

**Adding a stage requires touching 6 files and breaks 15+ tests.**

---

## The Radical Solution: Unified Stage Configuration

**One file contains EVERYTHING about a stage.** The engine becomes a dumb executor that reads config and runs it.

### New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAGE-CONFIG.TS                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  const STAGE_CONFIG: Record<StageName, StageConfig> = {                │  │
│  │    taskify: { type: 'agent', timeout: '10m', retry: {...}, ... },    │  │
│  │    verify:  { type: 'scripted', retry: { withStage: 'fix', ... },   │  │
│  │    ...                                                                 │  │
│  │  }                                                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GENERIC ENGINE (state-machine.ts)                    │
│  • Reads STAGE_CONFIG                                                       │
│  • Validates pipeline on startup                                            │
│  • Executes stages generically                                              │
│  • No hardcoded stage names                                                 │
│  • No hardcoded retry logic                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Unified StageConfig Interface

```typescript
// =============================================================================
// NEW FILE: scripts/cody/stages/config.ts
// The SINGLE SOURCE OF TRUTH for all stage configuration
// =============================================================================

import type { PostAction } from '../engine/types'

export interface StageConfig {
  // Identity
  name: StageName
  description: string
  
  // Execution
  type: 'agent' | 'scripted' | 'git' | 'gate'
  agentName?: string        // Override agent (e.g., fix uses 'build')
  
  // Timing  
  timeout: string           // Human-readable: '10m', '30s'
  maxRetries: number
  
  // Input/Output
  contextFiles: string[]    // Files this stage reads for context
  outputFile: string        // Primary output file
  
  // Flow Control - DECLARATIVE
  skip?: {
    complexity?: { 
      threshold: number 
      profiles?: ('standard' | 'lightweight' | 'turbo')[] 
    }
    inputQuality?: { 
      skipStages?: StageName[] 
    }
    specOnly?: boolean
    clarify?: { 
      disabled?: boolean 
      noOpenQuestions?: boolean 
    }
  }
  
  retry?: {
    maxAttempts: number
    withStage?: StageName              // What to run on retry (e.g., verify → fix)
    onFailure?: string                 // Function name to call on failure
    onTimeout?: 'retry' | 'fail'       // Timeout behavior
  }
  
  // Validation
  validator?: string                   // Validator function name
  fallbackOnMissingOutput?: string     // Function name
  
  // Side Effects
  preExecute?: string                  // Function name
  postActions?: PostAction[]           // Post-actions to run
  
  // Metadata
  complexityThreshold: number
  gates?: string[]                     // Gates that can pause this stage
  advisory?: boolean                    // If true, failure doesn't kill pipeline
}

// =============================================================================
// THE SINGLE SOURCE OF TRUTH
// =============================================================================

export const STAGE_CONFIG: Record<StageName, StageConfig> = {
  taskify: {
    name: 'taskify',
    description: 'Classifies issue into structured task definition',
    type: 'agent',
    timeout: '10m',
    maxRetries: 2,
    contextFiles: [],
    outputFile: 'task.json',
    complexityThreshold: 0,
    postActions: [
      { type: 'validate-task-json' },
      { type: 'set-classification-labels' },
      { type: 'check-gate', gate: 'taskify' },
      { type: 'commit-task-files', stagingStrategy: 'task-only', push: true, ensureBranch: true },
      { type: 'resolve-profile' },  // Must be last - triggers rebuild
    ],
  },
  
  gap: {
    name: 'gap',
    description: 'Gap analysis + writes spec.md',
    type: 'agent',
    timeout: '15m',
    maxRetries: 1,
    contextFiles: ['task.md', 'task.json'],
    outputFile: 'gap.md',
    complexityThreshold: 35,
    skip: {
      complexity: { threshold: 35 },
    },
    validator: 'createGapValidator',
  },
  
  verify: {
    name: 'verify',
    description: 'Runs verification gates (tsc, lint, format, tests)',
    type: 'scripted',
    timeout: '10m',
    maxRetries: 0,
    contextFiles: [],
    outputFile: 'verify.md',
    complexityThreshold: 0,
    retry: {
      maxAttempts: 2,
      withStage: 'fix',
      onFailure: 'captureVerifyFailures',
      onTimeout: 'retry',
    },
    postActions: [
      { type: 'commit-task-files', stagingStrategy: 'task-only', push: false, localOnly: true },
    ],
  },
  
  fix: {
    name: 'fix',
    description: 'Fixes review findings and verify failures',
    type: 'agent',
    agentName: 'build',              // Uses build agent
    timeout: '30m',
    maxRetries: 2,
    contextFiles: [
      'verify-failures.md',
      'review.md',
      'rerun-feedback.md',
      'fix-summary.md',
      'build.md',
      'plan.md',
      'context.md',
      'spec.md',
      'clarified.md',
      'prev-run/build.md',
    ],
    outputFile: 'fix.md',
    complexityThreshold: 0,
    postActions: [
      { type: 'commit-task-files', stagingStrategy: 'tracked+task', push: true },
      { type: 'clear-verify-failures' },
    ],
  },
  
  // ... all other stages follow same pattern
}

// =============================================================================
// DERIVED EXPORTS (for backward compatibility)
// =============================================================================

// Export StageName from STAGE_CONFIG keys
export type StageName = keyof typeof STAGE_CONFIG

// Export STAGE_NAMES as derived from config
export const STAGE_NAMES = Object.keys(STAGE_CONFIG) as StageName[]

// Export metadata as derived from config
export const STAGE_REGISTRY: Record<StageName, StageMetadata> = 
  Object.fromEntries(
    Object.entries(STAGE_CONFIG).map(([name, config]) => [
      name,
      {
        outputFile: config.outputFile,
        timeout: ms(config.timeout),
        complexityThreshold: config.complexityThreshold,
        contextFiles: config.contextFiles,
        type: config.type,
      }
    ])
  ) as Record<StageName, StageMetadata>

// Export pipeline orders as derived from config (or keep separate)
export const SPEC_ORDER_STANDARD = ['taskify', 'gap', 'clarify'] as StageName[]
// ... etc
```

---

## Engine Changes (state-machine.ts)

The engine becomes ~150 lines shorter:

```typescript
// BEFORE: 100 lines of hardcoded verify/fix retry logic
// AFTER: 20 lines of generic retry

// Generic retry loop via declarative config
if (def.retry) {
  const { maxAttempts, withStage, onFailure } = def.retry
  const currentAttempt = state.stages[withStage]?.fixAttempt ?? 0
  
  if (currentAttempt < maxAttempts) {
    // Call failure handler if defined
    if (onFailure) {
      const handler = getFailureHandler(onFailure)
      await handler(ctx, ctx.taskDir)
    }
    
    // Reset both stages to pending
    state = updateStage(state, withStage, {
      state: 'pending',
      fixAttempt: currentAttempt + 1,
      maxFixAttempts: maxAttempts,
    })
    state = updateStage(state, stageName, { state: 'pending' })
    writeState(ctx.taskId, state)
    return state
  }
}
```

---

## Test Strategy: Generate Tests FROM Config

Since everything is in ONE place, we can generate tests AUTOMATICALLY:

```typescript
// tests/unit/scripts/cody/stage-config-contract.test.ts
// GENERATED TEST - do not edit manually

import { STAGE_CONFIG, StageConfig } from '../../../scripts/cody/stages/config'

describe('STAGE_CONFIG', () => {
  // These tests are GENERATED from the config - they NEVER break on stage changes!
  
  it('should have valid timeout for all stages', () => {
    for (const [name, config] of Object.entries(STAGE_CONFIG)) {
      expect(() => ms(config.timeout)).not.toThrow(`Invalid timeout for ${name}`)
    }
  })
  
  it('should have valid retry.withStage references', () => {
    const validStages = new Set(Object.keys(STAGE_CONFIG))
    for (const [name, config] of Object.entries(STAGE_CONFIG)) {
      if (config.retry?.withStage) {
        expect(validStages.has(config.retry.withStage)).toBe(true)
      }
    }
  })
  
  it('should have valid contextFiles references', () => {
    // Context files should exist in task output mapping
    const validOutputs = new Set(Object.values(STAGE_CONFIG).map(c => c.outputFile))
    for (const [name, config] of Object.entries(STAGE_CONFIG)) {
      for (const ctxFile of config.contextFiles || []) {
        // Allow prev-run/* and standard files
        expect(
          ctxFile.startsWith('prev-run/') || 
          validOutputs.has(ctxFile) ||
          ['task.md', 'context.md', 'rerun-feedback.md'].includes(ctxFile)
        ).toBe(true)
      }
    }
  })
  
  it('should have no duplicate outputFiles', () => {
    const outputs = Object.values(STAGE_CONFIG).map(c => c.outputFile)
    const unique = new Set(outputs)
    expect(outputs.length).toBe(unique.size)
  })
  
  it('should have required fields for all stages', () => {
    for (const [name, config] of Object.entries(STAGE_CONFIG)) {
      expect(config.name).toBe(name)
      expect(config.type).toMatch(/^(agent|scripted|git|gate)$/)
      expect(config.timeout).toBeTruthy()
      expect(config.outputFile).toBeTruthy()
    }
  })
})
```

**Key insight**: These tests are GENERATED from the config. Adding a stage automatically adds test coverage. No manual test updates needed.

---

## Migration Path

### Phase 0: Create Unified Config (Highest Impact)
1. Create `scripts/cody/stages/config.ts` with `StageConfig` interface
2. Move ALL stage configuration into `STAGE_CONFIG` constant
3. Keep old files as thin wrappers that read from config (backward compat)
4. Add runtime validation that config is valid

### Phase 1: Refactor Engine
1. Update `state-machine.ts` to read retry config from `STAGE_CONFIG`
2. Remove hardcoded verify/fix logic (~100 lines)
3. Engine becomes truly generic

### Phase 2: Generate Tests
1. Create `tests/unit/scripts/cody/stage-config-contract.test.ts`
2. This test GENERATES assertions from config
3. Tests NEVER break on stage changes

### Phase 3: Remove Legacy
1. Delete `stages/registry.ts` (absorbed into config)
2. Delete `pipeline/definitions.ts` (absorbed into config)
3. Delete `handlers/handler.ts` switch statement (replaced with config-based dispatch)

---

## Comparison

| Metric | Current | Unified Config |
|--------|---------|----------------|
| Files to touch for new stage | 6 | 1 |
| Test files to update | 15+ | 0 (auto-generated) |
| Hardcoded stage names in engine | 7 | 0 |
| Lines in state-machine.ts | 722 | ~600 |
| Compile-time stage validation | Partial | Complete |
| Runtime config validation | None | Full |
| Contract test maintenance | Manual | Automatic |

---

## Risk-Effort-Value

| Fix | Risk | Effort | Value |
|-----|------|--------|-------|
| Create `stages/config.ts` with unified config | Low | ~2h | **Extreme** — single source of truth |
| Migrate all 13 stages to config | Low | ~2h | **Extreme** — eliminates configuration drift |
| Refactor engine to use config | Medium | ~2h | **High** — removes 100 lines of hardcoded logic |
| Generate contract tests from config | Low | ~1h | **Extreme** — tests NEVER break |
| Delete legacy files | Medium | ~30m | **Medium** — cleanup |
| Update all imports | Low | ~30m | **Low** — mechanical |

---

## Why This Is Better

1. **Single Source of Truth**: Everything about a stage is in ONE place
2. **Generated Tests**: Tests auto-generate from config — never break on stage changes
3. **Generic Engine**: Engine has ZERO knowledge of specific stages
4. **Declarative Flow**: Retry, skip, post-actions all declarative, not code
5. **Self-Validating**: Config validates itself on import
6. **Compile-Time Safety**: Adding a stage without config = compile error
7. **Runtime Safety**: Invalid config = fails fast on startup

This is the solution that scales. Adding a new stage becomes:
1. Add entry to `STAGE_CONFIG`
2. Everything else is automatic
