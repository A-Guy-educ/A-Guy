/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern registry-contract-test
 * @ai-summary Contract tests for the stage registry — single source of truth for stage metadata
 */

import { describe, it, expect } from 'vitest'
import {
  STAGE_NAMES,
  STAGE_REGISTRY,
  isValidStageName,
  assertStageName,
  getStageOutputFile,
  getStageTimeout,
  getStageComplexityThreshold,
  getStageContextFiles,
  stageOutputFile,
  flattenTypedPipeline,
  SPEC_ORDER_STANDARD,
  SPEC_ORDER_LIGHTWEIGHT,
  IMPL_ORDER_STANDARD,
  IMPL_ORDER_LIGHTWEIGHT,
  FIX_ORDER,
  FIX_FULL_ORDER,
  type StageName,
} from '../../../../scripts/cody/stages/registry'

// ============================================================================
// STAGE_NAMES
// ============================================================================

describe('STAGE_NAMES', () => {
  it('contains all essential stages', () => {
    const names = [...STAGE_NAMES]
    // Essential stages that must always be present
    expect(names).toContain('taskify')
    expect(names).toContain('gap')
    expect(names).toContain('clarify')
    expect(names).toContain('architect')
    expect(names).toContain('plan-gap')
    expect(names).toContain('test')
    expect(names).toContain('build')
    expect(names).toContain('commit')
    expect(names).toContain('review')
    expect(names).toContain('fix')
    expect(names).toContain('verify')
    expect(names).toContain('docs')
    expect(names).toContain('pr')
    expect(STAGE_NAMES.length).toBeGreaterThanOrEqual(10)
  })

  it('does NOT contain ghost stages', () => {
    const names = [...STAGE_NAMES] as string[]
    expect(names).not.toContain('spec')
    expect(names).not.toContain('autofix')
  })

  it('has at least 10 entries', () => {
    expect(STAGE_NAMES.length).toBeGreaterThanOrEqual(10)
  })
})

// ============================================================================
// STAGE_REGISTRY
// ============================================================================

describe('STAGE_REGISTRY', () => {
  it('has an entry for every STAGE_NAME', () => {
    for (const name of STAGE_NAMES) {
      expect(STAGE_REGISTRY[name]).toBeDefined()
      expect(STAGE_REGISTRY[name].outputFile).toBeTruthy()
      expect(STAGE_REGISTRY[name].timeout).toBeGreaterThan(0)
      expect(STAGE_REGISTRY[name].complexityThreshold).toBeGreaterThanOrEqual(0)
      expect(STAGE_REGISTRY[name].type).toBeTruthy()
    }
  })

  it('has no extra keys beyond STAGE_NAMES', () => {
    const registryKeys = Object.keys(STAGE_REGISTRY)
    expect(registryKeys).toHaveLength(STAGE_NAMES.length)
    for (const key of registryKeys) {
      expect((STAGE_NAMES as readonly string[]).includes(key)).toBe(true)
    }
  })
})

// ============================================================================
// isValidStageName
// ============================================================================

describe('isValidStageName', () => {
  it('returns true for valid names', () => {
    expect(isValidStageName('build')).toBe(true)
    expect(isValidStageName('taskify')).toBe(true)
    expect(isValidStageName('plan-gap')).toBe(true)
    expect(isValidStageName('pr')).toBe(true)
  })

  it('returns false for invalid/ghost names', () => {
    expect(isValidStageName('spec')).toBe(false)
    expect(isValidStageName('autofix')).toBe(false)
    expect(isValidStageName('nonexistent')).toBe(false)
    expect(isValidStageName('')).toBe(false)
  })
})

// ============================================================================
// assertStageName
// ============================================================================

describe('assertStageName', () => {
  it('returns the name for valid stages', () => {
    expect(assertStageName('build')).toBe('build')
    expect(assertStageName('plan-gap')).toBe('plan-gap')
  })

  it('throws for invalid names', () => {
    expect(() => assertStageName('nonexistent')).toThrow('Invalid stage name')
    expect(() => assertStageName('spec')).toThrow('Invalid stage name')
    expect(() => assertStageName('autofix')).toThrow('Invalid stage name')
  })
})

// ============================================================================
// getStageOutputFile
// ============================================================================

describe('getStageOutputFile', () => {
  it('returns correct file for key stages', () => {
    expect(getStageOutputFile('taskify')).toBe('task.json')
    expect(getStageOutputFile('gap')).toBe('gap.md')
    expect(getStageOutputFile('clarify')).toBe('questions.md')
    expect(getStageOutputFile('architect')).toBe('plan.md')
    expect(getStageOutputFile('plan-gap')).toBe('plan-gap.md')
    expect(getStageOutputFile('commit')).toBe('commit.md')
    expect(getStageOutputFile('test')).toBe('test.md')
    expect(getStageOutputFile('build')).toBe('build.md')
    expect(getStageOutputFile('pr')).toBe('pr.md')
  })
})

// ============================================================================
// getStageTimeout
// ============================================================================

describe('getStageTimeout', () => {
  it('returns positive timeout for all stages', () => {
    for (const name of STAGE_NAMES) {
      expect(getStageTimeout(name)).toBeGreaterThan(0)
    }
  })

  it('build has longest timeout', () => {
    const buildTimeout = getStageTimeout('build')
    expect(buildTimeout).toBeGreaterThanOrEqual(getStageTimeout('taskify'))
    expect(buildTimeout).toBeGreaterThanOrEqual(getStageTimeout('review'))
  })

  it('fix stage has adequate timeout (>= build) for complex fixes', () => {
    // Fix stage often needs more time than original build due to understanding overhead
    const fixTimeout = getStageTimeout('fix')
    const buildTimeout = getStageTimeout('build')
    expect(fixTimeout).toBeGreaterThanOrEqual(buildTimeout)
  })
})

// ============================================================================
// getStageComplexityThreshold
// ============================================================================

describe('getStageComplexityThreshold', () => {
  it('taskify always runs (threshold 0)', () => {
    expect(getStageComplexityThreshold('taskify')).toBe(0)
  })

  it('gap requires moderate complexity', () => {
    expect(getStageComplexityThreshold('gap')).toBe(35)
  })

  it('plan-gap requires high complexity', () => {
    expect(getStageComplexityThreshold('plan-gap')).toBe(50)
  })
})

// ============================================================================
// getStageContextFiles
// ============================================================================

describe('getStageContextFiles', () => {
  it('verify has no context files (scripted)', () => {
    expect(getStageContextFiles('verify')).toEqual([])
  })

  it('build has the most context files', () => {
    const buildFiles = getStageContextFiles('build')
    expect(buildFiles.length).toBeGreaterThan(5)
    expect(buildFiles).toContain('spec.md')
    expect(buildFiles).toContain('plan.md')
  })
})

// ============================================================================
// stageOutputFile (full path resolver)
// ============================================================================

describe('stageOutputFile', () => {
  it('builds correct path for known stages', () => {
    expect(stageOutputFile('/tmp/tasks/t1', 'taskify')).toBe('/tmp/tasks/t1/task.json')
    expect(stageOutputFile('/tmp/tasks/t1', 'build')).toBe('/tmp/tasks/t1/build.md')
  })

  it('falls back to ${stage}.md for unknown stages', () => {
    expect(stageOutputFile('/tmp/tasks/t1', 'unknown')).toBe('/tmp/tasks/t1/unknown.md')
  })
})

// ============================================================================
// Pipeline Order Arrays
// ============================================================================

describe('pipeline order arrays', () => {
  const allOrders = [
    { name: 'SPEC_ORDER_STANDARD', order: SPEC_ORDER_STANDARD },
    { name: 'SPEC_ORDER_LIGHTWEIGHT', order: SPEC_ORDER_LIGHTWEIGHT },
    { name: 'IMPL_ORDER_STANDARD', order: IMPL_ORDER_STANDARD },
    { name: 'IMPL_ORDER_LIGHTWEIGHT', order: IMPL_ORDER_LIGHTWEIGHT },
    { name: 'FIX_ORDER', order: FIX_ORDER },
    { name: 'FIX_FULL_ORDER', order: FIX_FULL_ORDER },
  ]

  for (const { name, order } of allOrders) {
    it(`${name} contains only valid StageName values`, () => {
      const flat = flattenTypedPipeline(order)
      for (const stage of flat) {
        expect(isValidStageName(stage)).toBe(true)
      }
    })

    it(`${name} has no duplicate stages`, () => {
      const flat = flattenTypedPipeline(order)
      const unique = new Set(flat)
      expect(unique.size).toBe(flat.length)
    })
  }

  it('SPEC_ORDER_STANDARD has 3 stages', () => {
    expect(SPEC_ORDER_STANDARD).toHaveLength(3)
  })

  it('SPEC_ORDER_LIGHTWEIGHT has 2 stages', () => {
    expect(SPEC_ORDER_LIGHTWEIGHT).toHaveLength(2)
  })

  it('IMPL_ORDER_STANDARD includes plan-gap', () => {
    const flat = flattenTypedPipeline(IMPL_ORDER_STANDARD)
    expect(flat).toContain('plan-gap')
  })

  it('IMPL_ORDER_LIGHTWEIGHT excludes plan-gap', () => {
    const flat = flattenTypedPipeline(IMPL_ORDER_LIGHTWEIGHT)
    expect(flat).not.toContain('plan-gap')
  })
})

// ============================================================================
// TypedPipelineStep compile-time verification
// ============================================================================

describe('TypedPipelineStep type safety', () => {
  it('compiles with valid stage names', () => {
    // This test verifies the types compile. If StageName changes,
    // any inline literal that no longer matches will fail compilation.
    const step: StageName = 'build'
    expect(step).toBe('build')
  })
})
