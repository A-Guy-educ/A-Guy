import { describe, it, expect, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  validateTask,
  readTask,
  normalizeTask,
  PIPELINE_MAP,
  resolveControlMode,
  resolvePipelineProfile,
} from '../../../../scripts/cody/pipeline-utils'

// Helper: create a temp task directory with a task.json
function createTempTaskDir(taskJson?: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-test-'))
  if (taskJson !== undefined) {
    const content = typeof taskJson === 'string' ? taskJson : JSON.stringify(taskJson, null, 2)
    fs.writeFileSync(path.join(dir, 'task.json'), content)
  }
  return dir
}

// A valid task.json fixture
const VALID_TASK: Record<string, unknown> = {
  task_type: 'implement_feature',
  pipeline: 'spec_execute_verify',
  risk_level: 'medium',
  confidence: 0.9,
  primary_domain: 'backend',
  scope: ['src/app'],
  missing_inputs: [],
  assumptions: ['Assumption 1'],
}

// The exact task.json from the 260219-auto-34 bug report
const BUG_260219_AUTO_34: Record<string, unknown> = {
  task_type: 'fix_bug',
  pipeline: 'spec_only', // WRONG — should be spec_execute_verify
  risk_level: 'low',
  confidence: 1.0,
  primary_domain: 'frontend',
  scope: ['src/ui/web/homepage/GreetingFlow/index.tsx'],
  missing_inputs: [],
  assumptions: [
    'The speed parameter in TypingAnimation represents milliseconds per character',
    'Reducing speed by half means increasing the speed value from 100 to 200 (slower typing)',
    'There are 3 occurrences of speed={100} in the GreetingFlow component that all need to be updated',
  ],
}

// The exact task.json from the 260218-55 bug report
const BUG_260218_55: Record<string, unknown> = {
  task_type: 'feature',
  pipeline: 'spec',
  risk_level: 'low',
  confidence: 'high',
  primary_domain: 'frontend',
  scope: 'Reduce home welcome typing text speed by half (from 50ms to 100ms per character)',
  missing_inputs: [],
  assumptions: [
    'The current typing speed is 50ms per character in GreetingFlow component',
    'Reducing speed by half means doubling the delay to 100ms per character',
    'All three TypingAnimation usages in GreetingFlow need to be updated',
  ],
}

describe('pipeline-utils', () => {
  let tempDirs: string[] = []

  afterEach(() => {
    // Cleanup temp dirs
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

  // ==========================================================================
  // validateTask
  // ==========================================================================
  describe('validateTask', () => {
    it('should accept a fully valid task.json', () => {
      const result = validateTask(VALID_TASK)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject non-object input', () => {
      const result = validateTask('not an object')
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('not a JSON object')
    })

    it('should reject null input', () => {
      const result = validateTask(null)
      expect(result.valid).toBe(false)
    })

    it('should reject invalid task_type', () => {
      const result = validateTask({ ...VALID_TASK, task_type: 'banana' })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid task_type')
      expect(result.errors[0]).toContain('banana')
    })

    it('should reject invalid pipeline', () => {
      const result = validateTask({ ...VALID_TASK, pipeline: 'banana' })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid pipeline')
    })

    it('should reject pipeline inconsistency (fix_bug + spec_only)', () => {
      const result = validateTask({
        ...VALID_TASK,
        task_type: 'fix_bug',
        pipeline: 'spec_only',
      })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Pipeline inconsistency')
    })

    it('should reject string confidence', () => {
      const result = validateTask({ ...VALID_TASK, confidence: 'high' })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid confidence')
    })

    it('should reject confidence out of range', () => {
      expect(validateTask({ ...VALID_TASK, confidence: 1.5 }).valid).toBe(false)
      expect(validateTask({ ...VALID_TASK, confidence: -0.1 }).valid).toBe(false)
    })

    it('should reject non-array scope', () => {
      const result = validateTask({ ...VALID_TASK, scope: 'not-array' })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('scope')
    })

    it('should reject non-array missing_inputs', () => {
      const result = validateTask({ ...VALID_TASK, missing_inputs: 'not-array' })
      expect(result.valid).toBe(false)
    })

    it('should reject non-array assumptions', () => {
      const result = validateTask({ ...VALID_TASK, assumptions: 'not-array' })
      expect(result.valid).toBe(false)
    })

    it('should collect multiple errors at once', () => {
      const result = validateTask({
        task_type: 'banana',
        pipeline: 'cherry',
        risk_level: 'extreme',
        confidence: 'very_high',
        primary_domain: 'magic',
        scope: 'not-array',
        missing_inputs: 'not-array',
        assumptions: 'not-array',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(3)
    })
  })

  // ==========================================================================
  // normalizeTask
  // ==========================================================================
  describe('normalizeTask', () => {
    it('should derive pipeline from task_type (fix_bug → spec_execute_verify)', () => {
      const result = normalizeTask({
        task_type: 'fix_bug',
        pipeline: 'spec_only', // wrong value
      })
      expect(result.pipeline).toBe('spec_execute_verify')
    })

    it('should derive pipeline from task_type (spec_only → spec_only)', () => {
      const result = normalizeTask({
        task_type: 'spec_only',
        pipeline: 'spec_execute_verify', // wrong value
      })
      expect(result.pipeline).toBe('spec_only')
    })

    it('should derive pipeline from task_type (implement_feature → spec_execute_verify)', () => {
      const result = normalizeTask({ task_type: 'implement_feature' })
      expect(result.pipeline).toBe('spec_execute_verify')
    })

    it('should derive pipeline even when pipeline field is missing', () => {
      const result = normalizeTask({ task_type: 'fix_bug' })
      expect(result.pipeline).toBe('spec_execute_verify')
    })

    it('should map task_type alias "feature" → "implement_feature"', () => {
      const result = normalizeTask({ task_type: 'feature' })
      expect(result.task_type).toBe('implement_feature')
      expect(result.pipeline).toBe('spec_execute_verify')
    })

    it('should map task_type alias "bug" → "fix_bug"', () => {
      const result = normalizeTask({ task_type: 'bug' })
      expect(result.task_type).toBe('fix_bug')
      expect(result.pipeline).toBe('spec_execute_verify')
    })

    it('should map task_type alias "bugfix" → "fix_bug"', () => {
      const result = normalizeTask({ task_type: 'bugfix' })
      expect(result.task_type).toBe('fix_bug')
    })

    it('should map task_type alias "hotfix" → "fix_bug"', () => {
      const result = normalizeTask({ task_type: 'hotfix' })
      expect(result.task_type).toBe('fix_bug')
    })

    it('should map task_type alias "doc" → "docs"', () => {
      const result = normalizeTask({ task_type: 'doc' })
      expect(result.task_type).toBe('docs')
      expect(result.pipeline).toBe('spec_only')
    })

    it('should convert string confidence "high" → 0.9', () => {
      const result = normalizeTask({ confidence: 'high' })
      expect(result.confidence).toBe(0.9)
    })

    it('should convert string confidence "medium" → 0.7', () => {
      const result = normalizeTask({ confidence: 'medium' })
      expect(result.confidence).toBe(0.7)
    })

    it('should convert string confidence "low" → 0.5', () => {
      const result = normalizeTask({ confidence: 'low' })
      expect(result.confidence).toBe(0.5)
    })

    it('should parse numeric string confidence "0.85" → 0.85', () => {
      const result = normalizeTask({ confidence: '0.85' })
      expect(result.confidence).toBe(0.85)
    })

    it('should preserve valid numeric confidence', () => {
      const result = normalizeTask({ confidence: 0.9 })
      expect(result.confidence).toBe(0.9)
    })

    it('should wrap string scope in array', () => {
      const result = normalizeTask({ scope: 'src/app/page.tsx' })
      expect(result.scope).toEqual(['src/app/page.tsx'])
    })

    it('should preserve array scope', () => {
      const result = normalizeTask({ scope: ['src/a', 'src/b'] })
      expect(result.scope).toEqual(['src/a', 'src/b'])
    })

    it('should default missing missing_inputs to empty array', () => {
      const result = normalizeTask({})
      expect(result.missing_inputs).toEqual([])
    })

    it('should default missing assumptions to empty array', () => {
      const result = normalizeTask({})
      expect(result.assumptions).toEqual([])
    })

    it('should preserve already-valid task unchanged (except pipeline re-derived)', () => {
      const result = normalizeTask({ ...VALID_TASK })
      expect(result.task_type).toBe('implement_feature')
      expect(result.pipeline).toBe('spec_execute_verify')
      expect(result.risk_level).toBe('medium')
      expect(result.confidence).toBe(0.9)
      expect(result.primary_domain).toBe('backend')
      expect(result.scope).toEqual(['src/app'])
    })

    it('should fix the exact 260219-auto-34 bug (fix_bug + spec_only)', () => {
      const result = normalizeTask({ ...BUG_260219_AUTO_34 })
      expect(result.task_type).toBe('fix_bug')
      expect(result.pipeline).toBe('spec_execute_verify')
      // After normalization, it should pass validation
      const validation = validateTask(result)
      expect(validation.valid).toBe(true)
    })

    it('should fix the exact 260218-55 bug (feature + spec + high + string scope)', () => {
      const result = normalizeTask({ ...BUG_260218_55 })
      expect(result.task_type).toBe('implement_feature')
      expect(result.pipeline).toBe('spec_execute_verify')
      expect(result.confidence).toBe(0.9)
      expect(Array.isArray(result.scope)).toBe(true)
      // After normalization, it should pass validation
      const validation = validateTask(result)
      expect(validation.valid).toBe(true)
    })

    it('should not mutate the original object', () => {
      const original = { task_type: 'feature', pipeline: 'spec' }
      normalizeTask(original)
      expect(original.task_type).toBe('feature') // unchanged
    })
  })

  // ==========================================================================
  // PIPELINE_MAP
  // ==========================================================================
  describe('PIPELINE_MAP', () => {
    it('should map fix_bug to spec_execute_verify', () => {
      expect(PIPELINE_MAP.fix_bug).toBe('spec_execute_verify')
    })

    it('should map implement_feature to spec_execute_verify', () => {
      expect(PIPELINE_MAP.implement_feature).toBe('spec_execute_verify')
    })

    it('should map spec_only to spec_only', () => {
      expect(PIPELINE_MAP.spec_only).toBe('spec_only')
    })

    it('should map research to spec_only', () => {
      expect(PIPELINE_MAP.research).toBe('spec_only')
    })

    it('should map docs to spec_only', () => {
      expect(PIPELINE_MAP.docs).toBe('spec_only')
    })
  })

  // ==========================================================================
  // readTask
  // ==========================================================================
  describe('readTask', () => {
    it('should return null when task.json does not exist', () => {
      const dir = trackDir(createTempTaskDir())
      const result = readTask(dir)
      expect(result).toBeNull()
    })

    it('should throw on invalid JSON (not process.exit)', () => {
      const dir = trackDir(createTempTaskDir('not valid json {{'))
      expect(() => readTask(dir)).toThrow(/not valid JSON/)
    })

    it('should throw on empty file', () => {
      const dir = trackDir(createTempTaskDir(''))
      // Empty string is not valid JSON
      expect(() => readTask(dir)).toThrow()
    })

    it('should throw on JSON wrapped in markdown code fences', () => {
      const dir = trackDir(createTempTaskDir('```json\n{"task_type": "fix_bug"}\n```'))
      expect(() => readTask(dir)).toThrow(/not valid JSON/)
    })

    it('should read and return a fully valid task.json', () => {
      const dir = trackDir(createTempTaskDir(VALID_TASK))
      const result = readTask(dir)
      expect(result).not.toBeNull()
      expect(result!.task_type).toBe('implement_feature')
      expect(result!.pipeline).toBe('spec_execute_verify')
    })

    it('should normalize and succeed for the 260219-auto-34 bug case', () => {
      const dir = trackDir(createTempTaskDir(BUG_260219_AUTO_34))
      // This previously would have called process.exit(1)!
      const result = readTask(dir)
      expect(result).not.toBeNull()
      expect(result!.task_type).toBe('fix_bug')
      expect(result!.pipeline).toBe('spec_execute_verify') // fixed!
    })

    it('should normalize and succeed for the 260218-55 bug case', () => {
      const dir = trackDir(createTempTaskDir(BUG_260218_55))
      // This previously would have called process.exit(1)!
      const result = readTask(dir)
      expect(result).not.toBeNull()
      expect(result!.task_type).toBe('implement_feature') // "feature" → "implement_feature"
      expect(result!.pipeline).toBe('spec_execute_verify')
      expect(result!.confidence).toBe(0.9) // "high" → 0.9
      expect(Array.isArray(result!.scope)).toBe(true)
    })

    it('should write back normalized task.json to disk', () => {
      const dir = trackDir(createTempTaskDir(BUG_260219_AUTO_34))
      readTask(dir)

      // Re-read the file from disk
      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'task.json'), 'utf-8'))
      expect(onDisk.pipeline).toBe('spec_execute_verify')
    })

    it('should throw on completely unfixable task.json', () => {
      const dir = trackDir(
        createTempTaskDir({
          task_type: 'banana', // not a valid type and not an alias
          risk_level: 'extreme',
          confidence: 'impossible',
          primary_domain: 'magic',
          scope: 42,
        }),
      )
      expect(() => readTask(dir)).toThrow(/validation failed/)
    })

    it('should include specific error details in thrown error', () => {
      const dir = trackDir(
        createTempTaskDir({
          task_type: 'banana',
          pipeline: 'cherry',
          risk_level: 'low',
          confidence: 0.9,
          primary_domain: 'frontend',
          scope: ['src'],
          missing_inputs: [],
          assumptions: [],
        }),
      )
      try {
        readTask(dir)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Invalid task_type')
        expect((error as Error).message).toContain('banana')
      }
    })
  })
})

// ==========================================================================
// resolveControlMode (Autonomous Decision Control Framework)
// ==========================================================================
describe('resolveControlMode', () => {
  // Helper to create a minimal TaskDefinition
  const createTaskDef = (riskLevel: string) =>
    ({
      task_type: 'implement_feature',
      pipeline: 'spec_execute_verify',
      risk_level: riskLevel as 'low' | 'medium' | 'high',
      confidence: 0.9,
      primary_domain: 'backend',
      scope: ['src/app'],
      missing_inputs: [],
      assumptions: [],
    }) as Parameters<typeof resolveControlMode>[0]

  it('low risk_level → returns auto', () => {
    const taskDef = createTaskDef('low')
    expect(resolveControlMode(taskDef)).toBe('auto')
  })

  it('medium risk_level → returns risk-gated', () => {
    const taskDef = createTaskDef('medium')
    expect(resolveControlMode(taskDef)).toBe('risk-gated')
  })

  it('high risk_level → returns hard-stop', () => {
    const taskDef = createTaskDef('high')
    expect(resolveControlMode(taskDef)).toBe('hard-stop')
  })

  it('explicit override always wins over risk_level', () => {
    const taskDefLow = createTaskDef('low')
    const taskDefMedium = createTaskDef('medium')
    const taskDefHigh = createTaskDef('high')

    // Override with 'auto' wins over 'medium' risk
    expect(resolveControlMode(taskDefMedium, 'auto')).toBe('auto')
    // Override with 'auto' wins over 'high' risk
    expect(resolveControlMode(taskDefHigh, 'auto')).toBe('auto')
    // Override with 'hard-stop' wins over 'low' risk
    expect(resolveControlMode(taskDefLow, 'hard-stop')).toBe('hard-stop')
    // Override with 'risk-gated' wins over 'low' risk
    expect(resolveControlMode(taskDefLow, 'risk-gated')).toBe('risk-gated')
  })

  it('invalid risk_level falls back to auto', () => {
    const taskDef = createTaskDef('unknown')
    expect(resolveControlMode(taskDef)).toBe('auto')
  })

  it('undefined risk_level falls back to auto', () => {
    const taskDef = { ...createTaskDef('low'), risk_level: undefined } as unknown as Parameters<
      typeof resolveControlMode
    >[0]
    expect(resolveControlMode(taskDef)).toBe('auto')
  })
})

// ==========================================================================
// Pipeline stage definitions (BUG-3 fix verification)
// ==========================================================================
describe('pipeline stage definitions', () => {
  it('should export ALL_IMPL_STAGE_NAMES matching IMPL_PIPELINE', async () => {
    const { ALL_IMPL_STAGE_NAMES, IMPL_PIPELINE, flattenPipeline } =
      await import('../../../../scripts/cody/pipeline-utils')
    expect(ALL_IMPL_STAGE_NAMES).toEqual(flattenPipeline(IMPL_PIPELINE))
  })

  it('should include plan-gap and commit in ALL_IMPL_STAGE_NAMES', async () => {
    const { ALL_IMPL_STAGE_NAMES } = await import('../../../../scripts/cody/pipeline-utils')
    expect(ALL_IMPL_STAGE_NAMES).toContain('plan-gap')
    expect(ALL_IMPL_STAGE_NAMES).toContain('commit')
  })

  it('should have exactly 10 impl stages', async () => {
    const { ALL_IMPL_STAGE_NAMES } = await import('../../../../scripts/cody/pipeline-utils')
    expect(ALL_IMPL_STAGE_NAMES).toHaveLength(10)
  })

  it('should have correct stage order', async () => {
    const { ALL_IMPL_STAGE_NAMES } = await import('../../../../scripts/cody/pipeline-utils')
    const architectIdx = ALL_IMPL_STAGE_NAMES.indexOf('architect')
    const planGapIdx = ALL_IMPL_STAGE_NAMES.indexOf('plan-gap')
    const buildIdx = ALL_IMPL_STAGE_NAMES.indexOf('build')
    const commitIdx = ALL_IMPL_STAGE_NAMES.indexOf('commit')
    const verifyIdx = ALL_IMPL_STAGE_NAMES.indexOf('verify')

    // architect < plan-gap < build < commit < verify
    expect(architectIdx).toBeLessThan(planGapIdx)
    expect(planGapIdx).toBeLessThan(buildIdx)
    expect(buildIdx).toBeLessThan(commitIdx)
    expect(commitIdx).toBeLessThan(verifyIdx)
  })

  it('should flatten parallel groups correctly', async () => {
    const { flattenPipeline, flattenStage, isParallelStage } =
      await import('../../../../scripts/cody/pipeline-utils')

    // Sequential stage
    expect(flattenStage('build')).toEqual(['build'])

    // Parallel group (test the feature works even if not used in current pipelines)
    const parallel = { parallel: ['verify', 'pr'] }
    expect(isParallelStage(parallel)).toBe(true)
    expect(flattenStage(parallel)).toEqual(['verify', 'pr'])

    // Mixed pipeline with parallel group
    const pipeline = ['architect', { parallel: ['a', 'b'] }, 'verify']
    expect(flattenPipeline(pipeline)).toEqual(['architect', 'a', 'b', 'verify'])
  })
})

// ============================================================================
// Gap stage registration tests
// ============================================================================
describe('gap stage registration', () => {
  it('should map stageOutputFile for gap correctly', async () => {
    const { stageOutputFile } = await import('../../../../scripts/cody/pipeline-utils')
    expect(stageOutputFile('/tmp/tasks/123', 'gap')).toBe('/tmp/tasks/123/gap.md')
  })

  it('should include gap in SPEC_ONLY_STAGES (spec-only pipeline)', async () => {
    const { SPEC_ONLY_STAGES } = await import('../../../../scripts/cody/pipeline-utils')
    expect(SPEC_ONLY_STAGES).toContain('gap')
  })

  it('should NOT include gap in ALL_IMPL_STAGE_NAMES (gap is spec-only)', async () => {
    const { ALL_IMPL_STAGE_NAMES } = await import('../../../../scripts/cody/pipeline-utils')
    // Gap should be in spec stages, not impl stages
    expect(ALL_IMPL_STAGE_NAMES).not.toContain('gap')
  })

  it('should have gap in dry-run outputs (via fallback)', async () => {
    const { stageOutputFile } = await import('../../../../scripts/cody/pipeline-utils')
    // Dry-run relies on fallback `${stage}.md`, so gap should produce gap.md
    expect(stageOutputFile('/tmp', 'gap')).toBe('/tmp/gap.md')
  })
})

// ============================================================================
// Stage-prompts.ts gap stage tests
// ============================================================================
describe('gap stage in stage-prompts', () => {
  it('should include gap in SPEC_STAGES from stage-prompts', async () => {
    const { SPEC_STAGES } = await import('../../../../scripts/cody/stage-prompts')
    expect(SPEC_STAGES).toContain('gap')
  })

  it('should include gap in ALL_STAGES from stage-prompts', async () => {
    const { ALL_STAGES } = await import('../../../../scripts/cody/stage-prompts')
    expect(ALL_STAGES).toContain('gap')
  })

  it('should have gap context files in stage-prompts', async () => {
    const { STAGE_CONTEXT_FILES } = await import('../../../../scripts/cody/stage-prompts')
    expect(STAGE_CONTEXT_FILES).toHaveProperty('gap')
    expect(STAGE_CONTEXT_FILES.gap).toContain('task.md')
    expect(STAGE_CONTEXT_FILES.gap).toContain('task.json')
  })
})

// ============================================================================
// input_quality in task.json (Smart Stage Skipping)
// ============================================================================
describe('input_quality in task.json', () => {
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

  // Valid task with input_quality
  const TASK_WITH_QUALITY: Record<string, unknown> = {
    ...VALID_TASK,
    input_quality: {
      level: 'good_spec',
      skip_stages: ['spec'],
      reasoning: 'Input contains ## Requirements with FR entries and ## Acceptance Criteria.',
    },
  }

  // Valid task with detailed_plan quality
  const TASK_WITH_PLAN_QUALITY: Record<string, unknown> = {
    ...VALID_TASK,
    input_quality: {
      level: 'detailed_plan',
      skip_stages: ['spec', 'architect'],
      reasoning: 'Input contains step-by-step plan with file paths and test cases.',
    },
  }

  describe('validateTask with input_quality', () => {
    it('should accept task.json with valid input_quality field', () => {
      const result = validateTask(TASK_WITH_QUALITY)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should accept task.json without input_quality (backward compat)', () => {
      // VALID_TASK has no input_quality field
      const result = validateTask(VALID_TASK)
      expect(result.valid).toBe(true)
    })

    it('should accept all valid input_quality levels', () => {
      for (const level of ['raw_idea', 'good_spec', 'detailed_plan', 'spec_and_plan']) {
        const task = {
          ...VALID_TASK,
          input_quality: { level, skip_stages: [], reasoning: 'test' },
        }
        const result = validateTask(task)
        expect(result.valid).toBe(true)
      }
    })

    it('should reject invalid input_quality.level', () => {
      const task = {
        ...VALID_TASK,
        input_quality: { level: 'amazing', skip_stages: [], reasoning: 'test' },
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('input_quality.level')
    })

    it('should reject non-array input_quality.skip_stages', () => {
      const task = {
        ...VALID_TASK,
        input_quality: { level: 'good_spec', skip_stages: 'spec', reasoning: 'test' },
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('skip_stages')
    })

    it('should accept unknown stage names in skip_stages (not an error, just ignored)', () => {
      // Unknown stages are allowed but ignored - the code doesn't reject them
      const task = {
        ...VALID_TASK,
        input_quality: { level: 'good_spec', skip_stages: ['banana'], reasoning: 'test' },
      }
      const result = validateTask(task)
      // Unknown stages are not rejected - they're just ignored
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject gap in skip_stages (gap must always run)', () => {
      const task = {
        ...VALID_TASK,
        input_quality: { level: 'good_spec', skip_stages: ['gap'], reasoning: 'test' },
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('gap')
    })

    it('should reject plan-gap in skip_stages (plan-gap must always run)', () => {
      const task = {
        ...VALID_TASK,
        input_quality: { level: 'good_spec', skip_stages: ['plan-gap'], reasoning: 'test' },
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('plan-gap')
    })

    it('should accept spec and architect in skip_stages', () => {
      const task = {
        ...VALID_TASK,
        input_quality: {
          level: 'detailed_plan',
          skip_stages: ['spec', 'architect'],
          reasoning: 'test',
        },
      }
      const result = validateTask(task)
      expect(result.valid).toBe(true)
    })

    it('should reject non-object input_quality', () => {
      const task = { ...VALID_TASK, input_quality: 'good' }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('input_quality')
    })

    it('should reject input_quality missing required fields', () => {
      const task = { ...VALID_TASK, input_quality: { level: 'good_spec' } }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('skip_stages')
    })
  })

  describe('normalizeTask with input_quality', () => {
    it('should default missing input_quality to raw_idea with no skips', () => {
      const result = normalizeTask({ ...VALID_TASK })
      expect(result.input_quality).toEqual({
        level: 'raw_idea',
        skip_stages: [],
        reasoning: '',
      })
    })

    it('should preserve valid input_quality unchanged', () => {
      const result = normalizeTask({ ...TASK_WITH_QUALITY })
      expect(result.input_quality).toEqual(TASK_WITH_QUALITY.input_quality)
    })

    it('should preserve detailed_plan input_quality unchanged', () => {
      const result = normalizeTask({ ...TASK_WITH_PLAN_QUALITY })
      expect(result.input_quality).toEqual(TASK_WITH_PLAN_QUALITY.input_quality)
    })
  })

  describe('readTask with input_quality', () => {
    it('should read task.json with input_quality and return it in TaskDefinition', () => {
      const dir = trackDir(createTempTaskDir(TASK_WITH_QUALITY))
      const result = readTask(dir)
      expect(result).not.toBeNull()
      expect(result!.input_quality).toBeDefined()
      expect(result!.input_quality!.level).toBe('good_spec')
      expect(result!.input_quality!.skip_stages).toEqual(['spec'])
    })

    it('should read task.json without input_quality (backward compat) and get default', () => {
      const dir = trackDir(createTempTaskDir(VALID_TASK))
      const result = readTask(dir)
      expect(result).not.toBeNull()
      // After normalize, input_quality should have default
      expect(result!.input_quality).toEqual({
        level: 'raw_idea',
        skip_stages: [],
        reasoning: '',
      })
    })

    it('should write back normalized input_quality to disk', () => {
      const dir = trackDir(createTempTaskDir(VALID_TASK))
      readTask(dir)
      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'task.json'), 'utf-8'))
      expect(onDisk.input_quality).toEqual({
        level: 'raw_idea',
        skip_stages: [],
        reasoning: '',
      })
    })
  })
})

// ============================================================================
// pipeline_profile resolution (Lightweight vs Standard)
// ============================================================================
describe('resolvePipelineProfile', () => {
  // Helper to create a full TaskDefinition for testing resolvePipelineProfile
  const createTaskDef = (
    taskType: string,
    riskLevel: string,
    pipelineProfile?: string,
  ): Parameters<typeof resolvePipelineProfile>[0] => ({
    task_type: taskType as Parameters<typeof resolvePipelineProfile>[0]['task_type'],
    pipeline:
      taskType === 'spec_only' || taskType === 'research' || taskType === 'docs'
        ? 'spec_only'
        : 'spec_execute_verify',
    risk_level: riskLevel as Parameters<typeof resolvePipelineProfile>[0]['risk_level'],
    confidence: 0.9,
    primary_domain: 'backend',
    scope: ['test'],
    missing_inputs: [],
    assumptions: [],
    ...(pipelineProfile && { pipeline_profile: pipelineProfile as 'lightweight' | 'standard' }),
  })

  it('returns lightweight for low-risk bug fixes', () => {
    const taskDef = createTaskDef('fix_bug', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('returns standard for medium-risk features', () => {
    const taskDef = createTaskDef('implement_feature', 'medium')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('returns standard for high-risk bug fixes', () => {
    const taskDef = createTaskDef('fix_bug', 'high')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('returns lightweight for low-risk refactor', () => {
    const taskDef = createTaskDef('refactor', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('returns lightweight for low-risk implement_feature (simple features skip full pipeline)', () => {
    const taskDef = createTaskDef('implement_feature', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('respects explicit agent override', () => {
    const taskDef = createTaskDef('fix_bug', 'low', 'standard')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('explicit override wins over heuristics (high-risk with lightweight override)', () => {
    const taskDef = createTaskDef('fix_bug', 'high', 'lightweight')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('returns standard for docs task regardless of risk', () => {
    const taskDef = createTaskDef('docs', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('returns standard for research task regardless of risk', () => {
    const taskDef = createTaskDef('research', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('returns standard for spec_only task regardless of risk', () => {
    const taskDef = createTaskDef('spec_only', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('returns lightweight for low-risk ops', () => {
    const taskDef = createTaskDef('ops', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('returns standard for medium-risk ops', () => {
    const taskDef = createTaskDef('ops', 'medium')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  // Test for implement_feature being lightweight when low risk
  it('returns lightweight for low-risk implement_feature', () => {
    const taskDef = createTaskDef('implement_feature', 'low')
    expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
  })

  it('returns standard for medium-risk implement_feature', () => {
    const taskDef = createTaskDef('implement_feature', 'medium')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })

  it('returns standard for high-risk implement_feature', () => {
    const taskDef = createTaskDef('implement_feature', 'high')
    expect(resolvePipelineProfile(taskDef)).toBe('standard')
  })
})

// ============================================================================
// pipeline_profile validation in task.json
// ============================================================================
describe('pipeline_profile validation', () => {
  // Valid task without pipeline_profile (should still pass)
  const VALID_TASK_NO_PROFILE: Record<string, unknown> = {
    task_type: 'implement_feature',
    pipeline: 'spec_execute_verify',
    risk_level: 'medium',
    confidence: 0.9,
    primary_domain: 'backend',
    scope: ['src/app'],
    missing_inputs: [],
    assumptions: [],
  }

  // Valid task with lightweight profile
  const VALID_TASK_LIGHTWEIGHT: Record<string, unknown> = {
    ...VALID_TASK_NO_PROFILE,
    pipeline_profile: 'lightweight',
  }

  // Valid task with standard profile
  const VALID_TASK_STANDARD: Record<string, unknown> = {
    ...VALID_TASK_NO_PROFILE,
    pipeline_profile: 'standard',
  }

  describe('validateTask with pipeline_profile', () => {
    it('accepts valid pipeline_profile: lightweight', () => {
      const result = validateTask(VALID_TASK_LIGHTWEIGHT)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts valid pipeline_profile: standard', () => {
      const result = validateTask(VALID_TASK_STANDARD)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts task without pipeline_profile (backward compatibility)', () => {
      const result = validateTask(VALID_TASK_NO_PROFILE)
      expect(result.valid).toBe(true)
    })

    it('rejects invalid pipeline_profile: turbo', () => {
      const task = {
        ...VALID_TASK_NO_PROFILE,
        pipeline_profile: 'turbo',
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('pipeline_profile')
    })

    it('rejects invalid pipeline_profile: fast', () => {
      const task = {
        ...VALID_TASK_NO_PROFILE,
        pipeline_profile: 'fast',
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('pipeline_profile')
    })

    it('rejects invalid pipeline_profile: minimal', () => {
      const task = {
        ...VALID_TASK_NO_PROFILE,
        pipeline_profile: 'minimal',
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('pipeline_profile')
    })

    it('rejects invalid pipeline_profile as number', () => {
      const task = {
        ...VALID_TASK_NO_PROFILE,
        pipeline_profile: 1,
      }
      const result = validateTask(task)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('pipeline_profile')
    })
  })

  describe('normalizeTask with pipeline_profile', () => {
    it('preserves valid pipeline_profile: lightweight', () => {
      const result = normalizeTask(VALID_TASK_LIGHTWEIGHT)
      expect(result.pipeline_profile).toBe('lightweight')
    })

    it('preserves valid pipeline_profile: standard', () => {
      const result = normalizeTask(VALID_TASK_STANDARD)
      expect(result.pipeline_profile).toBe('standard')
    })

    it('preserves task without pipeline_profile (backward compat)', () => {
      const result = normalizeTask(VALID_TASK_NO_PROFILE)
      // normalizeTask should not add pipeline_profile if not present
      expect(result.pipeline_profile).toBeUndefined()
    })
  })
})

// ============================================================================
// Lightweight pipeline profile functions (Step 2: Build lightweight pipeline variants)
// ============================================================================
describe('getImplPipeline', () => {
  it('returns full pipeline for standard profile', async () => {
    const { getImplPipeline } = await import('../../../../scripts/cody/pipeline-utils')
    const pipeline = getImplPipeline('standard')
    // Standard pipeline should have 10 entries (with reflect)
    expect(pipeline).toHaveLength(10)
  })

  it('returns reduced pipeline for lightweight profile (no plan-gap)', async () => {
    const { getImplPipeline, flattenPipeline } =
      await import('../../../../scripts/cody/pipeline-utils')
    const pipeline = getImplPipeline('lightweight')
    // Lightweight should have 9 entries (with reflect)
    expect(pipeline).toHaveLength(9)
    const flatNames = flattenPipeline(pipeline)
    expect(flatNames).toEqual([
      'architect',
      'build',
      'commit',
      'review',
      'fix',
      'commit',
      'verify',
      'reflect',
      'pr',
    ])
  })

  it('lightweight does not include plan-gap', async () => {
    const { getImplPipeline, flattenPipeline } =
      await import('../../../../scripts/cody/pipeline-utils')
    const pipeline = getImplPipeline('lightweight')
    const flatNames = flattenPipeline(pipeline)
    expect(flatNames).not.toContain('plan-gap')
  })
})

describe('getAllImplStageNames', () => {
  it('standard profile returns full flattened list', async () => {
    const { getAllImplStageNames } = await import('../../../../scripts/cody/pipeline-utils')
    const names = getAllImplStageNames('standard')
    expect(names).toContain('architect')
    expect(names).toContain('plan-gap')
    expect(names).toContain('build')
    expect(names).toContain('commit')
    expect(names).toContain('verify')
    expect(names).toContain('pr')
  })

  it('lightweight profile returns flat list without plan-gap', async () => {
    const { getAllImplStageNames } = await import('../../../../scripts/cody/pipeline-utils')
    const names = getAllImplStageNames('lightweight')
    expect(names).toEqual([
      'architect',
      'build',
      'commit',
      'review',
      'fix',
      'commit',
      'verify',
      'reflect',
      'pr',
    ])
  })
})

describe('getSpecStagesForProfile', () => {
  it('lightweight without clarify returns only taskify', async () => {
    const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')
    const stages = getSpecStagesForProfile('lightweight', false)
    expect(stages).toEqual(['taskify'])
  })

  it('standard without clarify returns taskify, gap', async () => {
    const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')
    const stages = getSpecStagesForProfile('standard', false)
    expect(stages).toEqual(['taskify', 'gap'])
  })

  it('lightweight with clarify returns taskify + clarify', async () => {
    const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')
    const stages = getSpecStagesForProfile('lightweight', true)
    expect(stages).toEqual(['taskify', 'clarify'])
  })
})
