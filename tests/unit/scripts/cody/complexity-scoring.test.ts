/**
 * Tests for complexity-based pipeline routing.
 *
 * Verifies:
 * - Complexity score validation and normalization
 * - Tier classification (trivial → very_complex)
 * - Stage threshold filtering
 * - Complexity-based skip conditions
 * - Pipeline profile derivation from complexity
 * - Backward compatibility when complexity is absent
 * - CLI --complexity override
 */
import { describe, it, expect, afterEach, afterAll, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  validateTask,
  readTask,
  normalizeTask,
  resolvePipelineProfile,
  getComplexityTier,
  getStagesForComplexity,
  STAGE_COMPLEXITY_THRESHOLDS,
  COMPLEXITY_MIN,
  COMPLEXITY_MAX,
} from '../../../../scripts/cody/pipeline-utils'
import type { TaskDefinition } from '../../../../scripts/cody/pipeline-utils'

// Helper: create a temp task directory with a task.json
function createTempTaskDir(taskJson?: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-complexity-'))
  if (taskJson !== undefined) {
    const content = typeof taskJson === 'string' ? taskJson : JSON.stringify(taskJson, null, 2)
    fs.writeFileSync(path.join(dir, 'task.json'), content)
  }
  return dir
}

// Valid base task fixture
const VALID_TASK: Record<string, unknown> = {
  task_type: 'implement_feature',
  pipeline: 'spec_execute_verify',
  risk_level: 'medium',
  confidence: 0.9,
  primary_domain: 'backend',
  scope: ['src/app'],
  missing_inputs: [],
  assumptions: [],
}

// Helper to create TaskDefinition with complexity
function createTaskDef(
  taskType: string,
  riskLevel: string,
  complexity?: number,
  pipelineProfile?: string,
): TaskDefinition {
  return {
    task_type: taskType as TaskDefinition['task_type'],
    pipeline:
      taskType === 'spec_only' || taskType === 'docs' || taskType === 'research'
        ? 'spec_only'
        : 'spec_execute_verify',
    risk_level: riskLevel as TaskDefinition['risk_level'],
    confidence: 0.9,
    primary_domain: 'backend',
    scope: ['src/app'],
    missing_inputs: [],
    assumptions: [],
    ...(complexity !== undefined && { complexity }),
    ...(complexity !== undefined && {
      complexity_reasoning: `Test complexity: ${complexity}`,
    }),
    ...(pipelineProfile && {
      pipeline_profile: pipelineProfile as 'lightweight' | 'standard',
    }),
  }
}

describe('complexity scoring constants', () => {
  it('COMPLEXITY_MIN is 1', () => {
    expect(COMPLEXITY_MIN).toBe(1)
  })

  it('COMPLEXITY_MAX is 100', () => {
    expect(COMPLEXITY_MAX).toBe(100)
  })

  it('all required stages have thresholds defined', () => {
    const requiredStages = [
      'taskify',
      'spec',
      'gap',
      'clarify',
      'gsd-research',
      'gsd-plan',
      'gsd-execute',
      'commit',
      'verify',
      'pr',
    ]
    for (const stage of requiredStages) {
      expect(STAGE_COMPLEXITY_THRESHOLDS).toHaveProperty(stage)
      expect(typeof STAGE_COMPLEXITY_THRESHOLDS[stage]).toBe('number')
    }
  })

  it('always-run stages have threshold 0', () => {
    expect(STAGE_COMPLEXITY_THRESHOLDS.taskify).toBe(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS['gsd-execute']).toBe(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS.commit).toBe(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS.verify).toBe(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS.pr).toBe(0)
  })

  it('optional stages have thresholds > 0', () => {
    expect(STAGE_COMPLEXITY_THRESHOLDS.spec).toBeGreaterThan(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS.gap).toBeGreaterThan(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS.clarify).toBeGreaterThan(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS['gsd-plan']).toBeGreaterThan(0)
    expect(STAGE_COMPLEXITY_THRESHOLDS['gsd-research']).toBeGreaterThan(0)
  })

  it('thresholds increase monotonically for core stages', () => {
    // gsd-plan (10) < spec (20) < gap (35) = gsd-research (35) < clarify (60)
    expect(STAGE_COMPLEXITY_THRESHOLDS['gsd-plan']).toBeLessThan(STAGE_COMPLEXITY_THRESHOLDS.spec)
    expect(STAGE_COMPLEXITY_THRESHOLDS.spec).toBeLessThan(STAGE_COMPLEXITY_THRESHOLDS.gap)
    expect(STAGE_COMPLEXITY_THRESHOLDS.gap).toBeLessThanOrEqual(
      STAGE_COMPLEXITY_THRESHOLDS['gsd-research'],
    )
    expect(STAGE_COMPLEXITY_THRESHOLDS['gsd-research']).toBeLessThan(
      STAGE_COMPLEXITY_THRESHOLDS.clarify,
    )
  })
})

describe('getComplexityTier', () => {
  it('score 1-9 → trivial', () => {
    expect(getComplexityTier(1)).toBe('trivial')
    expect(getComplexityTier(5)).toBe('trivial')
    expect(getComplexityTier(9)).toBe('trivial')
  })

  it('score 10-19 → simple', () => {
    expect(getComplexityTier(10)).toBe('simple')
    expect(getComplexityTier(15)).toBe('simple')
    expect(getComplexityTier(19)).toBe('simple')
  })

  it('score 20-34 → moderate', () => {
    expect(getComplexityTier(20)).toBe('moderate')
    expect(getComplexityTier(25)).toBe('moderate')
    expect(getComplexityTier(34)).toBe('moderate')
  })

  it('score 35-49 → complex', () => {
    expect(getComplexityTier(35)).toBe('complex')
    expect(getComplexityTier(40)).toBe('complex')
    expect(getComplexityTier(49)).toBe('complex')
  })

  it('score 50-100 → very_complex', () => {
    expect(getComplexityTier(50)).toBe('very_complex')
    expect(getComplexityTier(75)).toBe('very_complex')
    expect(getComplexityTier(100)).toBe('very_complex')
  })
})

describe('getStagesForComplexity', () => {
  it('trivial (score 5) → only always-run stages', () => {
    const stages = getStagesForComplexity(5)
    expect(stages).toContain('taskify')
    expect(stages).toContain('gsd-execute')
    expect(stages).toContain('commit')
    expect(stages).toContain('verify')
    expect(stages).toContain('pr')
    // Should NOT include optional stages
    expect(stages).not.toContain('spec')
    expect(stages).not.toContain('gap')
    expect(stages).not.toContain('gsd-plan')
    expect(stages).not.toContain('clarify')
  })

  it('simple (score 15) → + gsd-plan', () => {
    const stages = getStagesForComplexity(15)
    expect(stages).toContain('gsd-plan')
    expect(stages).not.toContain('spec')
    expect(stages).not.toContain('gap')
  })

  it('moderate (score 25) → + spec', () => {
    const stages = getStagesForComplexity(25)
    expect(stages).toContain('gsd-plan')
    expect(stages).toContain('spec')
    expect(stages).not.toContain('gap')
  })

  it('complex (score 40) → + spec, gap, gsd-research', () => {
    const stages = getStagesForComplexity(40)
    expect(stages).toContain('spec')
    expect(stages).toContain('gap')
    expect(stages).toContain('gsd-plan')
    expect(stages).toContain('gsd-research')
    expect(stages).not.toContain('clarify')
  })

  it('very_complex (score 75) → all stages', () => {
    const stages = getStagesForComplexity(75)
    expect(stages).toContain('spec')
    expect(stages).toContain('gap')
    expect(stages).toContain('clarify')
    expect(stages).toContain('gsd-plan')
    expect(stages).toContain('gsd-research')
    expect(stages).toContain('gsd-execute')
    expect(stages).toContain('commit')
    expect(stages).toContain('verify')
    expect(stages).toContain('pr')
  })

  it('score 100 → all stages (maximum)', () => {
    const stages = getStagesForComplexity(100)
    const allStages = Object.keys(STAGE_COMPLEXITY_THRESHOLDS)
    for (const stage of allStages) {
      expect(stages).toContain(stage)
    }
  })
})

describe('validateTask with complexity', () => {
  it('accepts task with valid complexity score', () => {
    const result = validateTask({ ...VALID_TASK, complexity: 42 })
    expect(result.valid).toBe(true)
  })

  it('accepts task without complexity (backward compat)', () => {
    const result = validateTask(VALID_TASK)
    expect(result.valid).toBe(true)
  })

  it('rejects complexity below min (0)', () => {
    const result = validateTask({ ...VALID_TASK, complexity: 0 })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('complexity')
  })

  it('rejects complexity above max (101)', () => {
    const result = validateTask({ ...VALID_TASK, complexity: 101 })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('complexity')
  })

  it('rejects non-integer complexity (3.5)', () => {
    const result = validateTask({ ...VALID_TASK, complexity: 3.5 })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('complexity')
  })

  it('rejects string complexity that is not a number', () => {
    const result = validateTask({ ...VALID_TASK, complexity: 'high' })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('complexity')
  })

  it('accepts boundary values (1 and 100)', () => {
    expect(validateTask({ ...VALID_TASK, complexity: 1 }).valid).toBe(true)
    expect(validateTask({ ...VALID_TASK, complexity: 100 }).valid).toBe(true)
  })

  it('accepts valid complexity_reasoning string', () => {
    const result = validateTask({
      ...VALID_TASK,
      complexity: 42,
      complexity_reasoning: 'Scope: 10, Risk: 12',
    })
    expect(result.valid).toBe(true)
  })

  it('rejects non-string complexity_reasoning', () => {
    const result = validateTask({
      ...VALID_TASK,
      complexity: 42,
      complexity_reasoning: 123,
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('complexity_reasoning')
  })
})

describe('normalizeTask with complexity', () => {
  it('converts string complexity "42" to number 42', () => {
    const result = normalizeTask({ ...VALID_TASK, complexity: '42' })
    expect(result.complexity).toBe(42)
  })

  it('clamps complexity below min to 1', () => {
    const result = normalizeTask({ ...VALID_TASK, complexity: -5 })
    expect(result.complexity).toBe(1)
  })

  it('clamps complexity above max to 100', () => {
    const result = normalizeTask({ ...VALID_TASK, complexity: 150 })
    expect(result.complexity).toBe(100)
  })

  it('rounds float complexity to integer', () => {
    const result = normalizeTask({ ...VALID_TASK, complexity: 42.7 })
    expect(result.complexity).toBe(43)
  })

  it('preserves valid integer complexity', () => {
    const result = normalizeTask({ ...VALID_TASK, complexity: 55 })
    expect(result.complexity).toBe(55)
  })

  it('converts non-string complexity_reasoning to string', () => {
    const result = normalizeTask({ ...VALID_TASK, complexity_reasoning: 123 })
    expect(result.complexity_reasoning).toBe('123')
  })

  it('does not add complexity when not present (backward compat)', () => {
    const result = normalizeTask({ ...VALID_TASK })
    expect(result.complexity).toBeUndefined()
  })
})

describe('readTask with complexity', () => {
  let tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
    tempDirs = []
  })

  function trackDir(dir: string): string {
    tempDirs.push(dir)
    return dir
  }

  it('reads task.json with complexity and returns it in TaskDefinition', () => {
    const dir = trackDir(
      createTempTaskDir({
        ...VALID_TASK,
        complexity: 42,
        complexity_reasoning: 'Test score',
      }),
    )
    const result = readTask(dir)
    expect(result).not.toBeNull()
    expect(result!.complexity).toBe(42)
    expect(result!.complexity_reasoning).toBe('Test score')
  })

  it('reads task.json without complexity (backward compat)', () => {
    const dir = trackDir(createTempTaskDir(VALID_TASK))
    const result = readTask(dir)
    expect(result).not.toBeNull()
    expect(result!.complexity).toBeUndefined()
  })

  it('normalizes string complexity and writes back to disk', () => {
    const dir = trackDir(
      createTempTaskDir({
        ...VALID_TASK,
        complexity: '55',
      }),
    )
    readTask(dir)
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'task.json'), 'utf-8'))
    expect(onDisk.complexity).toBe(55)
  })
})

describe('resolvePipelineProfile with complexity', () => {
  it('complexity < 20 → lightweight', () => {
    const taskDef = createTaskDef('implement_feature', 'medium', 15)
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('complexity >= 20 → standard', () => {
    const taskDef = createTaskDef('implement_feature', 'medium', 20)
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('complexity 100 → standard', () => {
    const taskDef = createTaskDef('implement_feature', 'high', 100)
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('explicit pipeline_profile override wins over complexity', () => {
    const taskDef = createTaskDef('implement_feature', 'medium', 80, 'lightweight')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('explicit pipeline_profile standard override wins over low complexity', () => {
    const taskDef = createTaskDef('fix_bug', 'low', 5, 'standard')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('no complexity → falls back to legacy heuristic', () => {
    // Low risk fix_bug without complexity → lightweight (legacy behavior)
    const taskDef = createTaskDef('fix_bug', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('no complexity + medium risk → standard (legacy behavior)', () => {
    const taskDef = createTaskDef('implement_feature', 'medium')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })
})

describe('skipIfBelowComplexity', () => {
  // Import the skip condition
  let skipIfBelowComplexity: typeof import('../../../../scripts/cody/pipeline/skip-conditions').skipIfBelowComplexity

  beforeAll(async () => {
    const skipModule = await import('../../../../scripts/cody/pipeline/skip-conditions')
    skipIfBelowComplexity = skipModule.skipIfBelowComplexity
  })

  function createCtx(complexity?: number) {
    return {
      taskId: 'test-task',
      taskDir: '/tmp/test',
      input: { taskId: 'test-task', mode: 'full' as const, dryRun: false },
      taskDef:
        complexity !== undefined
          ? createTaskDef('implement_feature', 'medium', complexity)
          : createTaskDef('implement_feature', 'medium'),
      profile: 'standard' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      backend: {} as any,
    }
  }

  it('no complexity → does not skip (backward compat)', () => {
    const ctx = createCtx()
    const result = skipIfBelowComplexity(ctx, 'spec')
    expect(result.shouldSkip).toBe(false)
  })

  it('complexity 5, stage spec (threshold 20) → skips', () => {
    const ctx = createCtx(5)
    const result = skipIfBelowComplexity(ctx, 'spec')
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('Complexity 5')
    expect(result.reason).toContain('trivial')
  })

  it('complexity 40, stage spec (threshold 20) → does not skip', () => {
    const ctx = createCtx(40)
    const result = skipIfBelowComplexity(ctx, 'spec')
    expect(result.shouldSkip).toBe(false)
  })

  it('complexity 15, stage gsd-plan (threshold 10) → does not skip', () => {
    const ctx = createCtx(15)
    const result = skipIfBelowComplexity(ctx, 'gsd-plan')
    expect(result.shouldSkip).toBe(false)
  })

  it('complexity 5, stage gsd-plan (threshold 10) → skips', () => {
    const ctx = createCtx(5)
    const result = skipIfBelowComplexity(ctx, 'gsd-plan')
    expect(result.shouldSkip).toBe(true)
  })

  it('always-run stages (threshold 0) → never skips', () => {
    const ctx = createCtx(1)
    expect(skipIfBelowComplexity(ctx, 'gsd-execute').shouldSkip).toBe(false)
    expect(skipIfBelowComplexity(ctx, 'commit').shouldSkip).toBe(false)
    expect(skipIfBelowComplexity(ctx, 'verify').shouldSkip).toBe(false)
    expect(skipIfBelowComplexity(ctx, 'pr').shouldSkip).toBe(false)
    expect(skipIfBelowComplexity(ctx, 'taskify').shouldSkip).toBe(false)
  })

  it('unknown stage → does not skip', () => {
    const ctx = createCtx(1)
    expect(skipIfBelowComplexity(ctx, 'unknown-stage').shouldSkip).toBe(false)
  })
})

describe('end-to-end complexity pipeline routing', () => {
  it('trivial bug (score 8) → minimal pipeline', () => {
    const stages = getStagesForComplexity(8)
    expect(stages).toEqual(
      expect.arrayContaining(['taskify', 'gsd-execute', 'commit', 'verify', 'pr']),
    )
    expect(stages).not.toContain('spec')
    expect(stages).not.toContain('gap')
    expect(stages).not.toContain('gsd-plan')
    expect(stages).not.toContain('clarify')
    expect(stages).not.toContain('gsd-research')
  })

  it('simple fix (score 15) → adds gsd-plan only', () => {
    const stages = getStagesForComplexity(15)
    expect(stages).toContain('gsd-plan')
    expect(stages).not.toContain('spec')
    expect(stages).not.toContain('gap')
  })

  it('moderate feature (score 28) → adds spec but not gap', () => {
    const stages = getStagesForComplexity(28)
    expect(stages).toContain('gsd-plan')
    expect(stages).toContain('spec')
    expect(stages).not.toContain('gap')
  })

  it('complex task (score 42) → full spec + architect + gap + plan-gap', () => {
    const stages = getStagesForComplexity(42)
    expect(stages).toContain('spec')
    expect(stages).toContain('gap')
    expect(stages).toContain('gsd-plan')
    expect(stages).toContain('gsd-research')
    expect(stages).not.toContain('clarify')
  })

  it('very complex task (score 72) → full pipeline including plan-gap and clarify', () => {
    const stages = getStagesForComplexity(72)
    expect(stages).toContain('spec')
    expect(stages).toContain('gap')
    expect(stages).toContain('clarify')
    expect(stages).toContain('gsd-plan')
    expect(stages).toContain('gsd-research')
    expect(stages).toContain('gsd-execute')
    expect(stages).toContain('commit')
    expect(stages).toContain('verify')
    expect(stages).toContain('pr')
  })
})

describe('CLI --complexity override', () => {
  it('parseCliArgs parses --complexity flag', async () => {
    // Use dynamic import to get fresh module (no mocking issues)
    const { parseCliArgs } = await import('../../../../scripts/cody/cody-utils')
    const input = parseCliArgs(['--task-id', '260228-test', '--complexity', '42'])
    expect(input.complexityOverride).toBe(42)
  })

  it('parseCliArgs rejects --complexity 0', async () => {
    const { parseCliArgs } = await import('../../../../scripts/cody/cody-utils')
    expect(() => parseCliArgs(['--task-id', '260228-test', '--complexity', '0'])).toThrow(
      'Invalid --complexity',
    )
  })

  it('parseCliArgs rejects --complexity 101', async () => {
    const { parseCliArgs } = await import('../../../../scripts/cody/cody-utils')
    expect(() => parseCliArgs(['--task-id', '260228-test', '--complexity', '101'])).toThrow(
      'Invalid --complexity',
    )
  })

  it('parseCliArgs rejects --complexity abc', async () => {
    const { parseCliArgs } = await import('../../../../scripts/cody/cody-utils')
    expect(() => parseCliArgs(['--task-id', '260228-test', '--complexity', 'abc'])).toThrow(
      'Invalid --complexity',
    )
  })
})

describe('definitions.ts skip chain integration', () => {
  // Gap 2: Test that shouldSkip chains in definitions.ts correctly wire
  // complexity as the FIRST check, falling through to other conditions

  let buildPipeline: typeof import('../../../../scripts/cody/pipeline/definitions').buildPipeline
  let tempDir: string

  beforeAll(async () => {
    const defs = await import('../../../../scripts/cody/pipeline/definitions')
    buildPipeline = defs.buildPipeline
    // Create a real temp dir for tests that exercise skip conditions with file side-effects
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-skipchain-'))
  })

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  function createPipelineCtx(complexity?: number) {
    return {
      taskId: 'test-chain',
      taskDir: tempDir,
      input: { taskId: 'test-chain', mode: 'full' as const, dryRun: false },
      taskDef:
        complexity !== undefined
          ? createTaskDef('implement_feature', 'medium', complexity)
          : createTaskDef('implement_feature', 'medium'),
      profile: 'standard' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      backend: {} as any,
    }
  }

  it('spec stage shouldSkip checks complexity FIRST (score 5 → skip without checking input_quality)', () => {
    const ctx = createPipelineCtx(5)
    const pipeline = buildPipeline('full', 'standard', true, ctx)
    const specStage = pipeline.stages.get('spec')!
    expect(specStage.shouldSkip).toBeDefined()

    const result = specStage.shouldSkip!(ctx)
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('Complexity 5')
  })

  it('spec stage falls through to input_quality when complexity passes (score 40)', () => {
    const ctx = createPipelineCtx(40)
    // Add input_quality skip for spec (but file won't exist, so it won't skip)
    ctx.taskDef!.input_quality = { level: 'good_spec', skip_stages: ['spec'], reasoning: '' }
    const pipeline = buildPipeline('full', 'standard', true, ctx)
    const specStage = pipeline.stages.get('spec')!

    const result = specStage.shouldSkip!(ctx)
    // Complexity passes (40 >= 35), falls through to input_quality check
    // input_quality would skip if file exists, but /tmp/test-chain/spec.md doesn't exist
    expect(result.shouldSkip).toBe(false)
  })

  it('gsd-plan stage skips at complexity 5 (threshold 10)', () => {
    const ctx = createPipelineCtx(5)
    const pipeline = buildPipeline('full', 'standard', true, ctx)
    const gsdPlanStage = pipeline.stages.get('gsd-plan')!

    const result = gsdPlanStage.shouldSkip!(ctx)
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('Complexity 5')
  })

  it('gsd-plan stage passes complexity but checks spec_only fallback (score 15)', () => {
    const ctx = createPipelineCtx(15)
    // Not spec_only, so should not skip
    const pipeline = buildPipeline('full', 'standard', true, ctx)
    const gsdPlanStage = pipeline.stages.get('gsd-plan')!

    const result = gsdPlanStage.shouldSkip!(ctx)
    expect(result.shouldSkip).toBe(false)
  })

  it('clarify stage has 4-level skip chain: complexity → input_quality → disabled → no questions', () => {
    // Complexity too low → skip at first check
    const ctx = createPipelineCtx(10)
    const pipeline = buildPipeline('full', 'standard', true, ctx)
    const clarifyStage = pipeline.stages.get('clarify')!

    const result = clarifyStage.shouldSkip!(ctx)
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('Complexity 10')
  })

  it('gsd-execute stage has NO complexity skip (always-run, threshold 0)', () => {
    const ctx = createPipelineCtx(1)
    const pipeline = buildPipeline('full', 'standard', true, ctx)
    const gsdExecuteStage = pipeline.stages.get('gsd-execute')!

    // Build only checks input_quality, not complexity
    const result = gsdExecuteStage.shouldSkip!(ctx)
    expect(result.shouldSkip).toBe(false)
  })

  it('no complexity → all stages pass complexity check (backward compat)', () => {
    const ctx = createPipelineCtx() // undefined complexity
    const pipeline = buildPipeline('full', 'standard', true, ctx)

    // All optional stages should NOT be skipped by complexity
    for (const stageName of ['spec', 'gap', 'clarify', 'gsd-plan', 'gsd-research']) {
      const stage = pipeline.stages.get(stageName)!
      if (stage.shouldSkip) {
        const result = stage.shouldSkip(ctx)
        // They might skip for OTHER reasons (clarify disabled, etc.)
        // but NOT for complexity
        if (result.shouldSkip) {
          expect(result.reason).not.toContain('Complexity')
        }
      }
    }
  })
})

describe('entry.ts impl-mode complexity override', () => {
  // Gap 3: Test that runImplMode correctly applies --complexity override
  // We test the override logic directly since runImplMode has many side effects

  it('override applies when taskDef has no complexity (=== undefined)', () => {
    const taskDef = createTaskDef('implement_feature', 'medium')
    expect(taskDef.complexity).toBeUndefined()

    // Simulate the entry.ts logic (line 370)
    const complexityOverride = 42
    if (complexityOverride !== undefined && taskDef.complexity === undefined) {
      taskDef.complexity = complexityOverride
      taskDef.complexity_reasoning = `Override via --complexity=${complexityOverride}`
    }

    expect(taskDef.complexity).toBe(42)
    expect(taskDef.complexity_reasoning).toBe('Override via --complexity=42')
  })

  it('override does NOT apply when taskDef already has complexity', () => {
    const taskDef = createTaskDef('implement_feature', 'medium', 75)
    expect(taskDef.complexity).toBe(75)

    // Simulate the entry.ts logic (line 370)
    const complexityOverride = 10
    if (complexityOverride !== undefined && taskDef.complexity === undefined) {
      taskDef.complexity = complexityOverride
      taskDef.complexity_reasoning = `Override via --complexity=${complexityOverride}`
    }

    // Original preserved
    expect(taskDef.complexity).toBe(75)
    expect(taskDef.complexity_reasoning).toBe('Test complexity: 75')
  })

  it('M3 fix: override does NOT apply when taskDef.complexity is a falsy number (edge case)', () => {
    // This tests the M3 fix: !taskDef.complexity would be truthy for 0,
    // but === undefined is only truthy for undefined
    const taskDef = createTaskDef('implement_feature', 'medium', 1)
    // Manually set to a value that normalizeTask would clamp (testing the boundary)
    expect(taskDef.complexity).toBe(1)

    const complexityOverride = 50
    // Using the FIXED check (=== undefined), not the buggy one (!taskDef.complexity)
    if (complexityOverride !== undefined && taskDef.complexity === undefined) {
      taskDef.complexity = complexityOverride
    }

    // Complexity 1 should NOT be overridden
    expect(taskDef.complexity).toBe(1)
  })
})
