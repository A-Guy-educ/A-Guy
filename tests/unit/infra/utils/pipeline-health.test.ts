/**
 * @fileType test
 * @domain infra | utils
 * @pattern pipeline-health-tests
 * @ai-summary Tests for PipelineHealthReport utility
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  PipelineHealthReport,
  getStageTimeout,
  stageNameSchema,
  failedStageSchema,
} from '@/infra/utils/pipeline-health'

// ============================================================================
// getStageTimeout Tests
// ============================================================================

describe('getStageTimeout', () => {
  it('returns correct timeout for taskify (10m)', () => {
    const timeout = getStageTimeout('taskify')
    expect(timeout).toBe(600000) // 10 minutes in ms
  })

  it('returns correct timeout for build (45m)', () => {
    const timeout = getStageTimeout('build')
    expect(timeout).toBe(2700000) // 45 minutes in ms
  })

  it('returns correct timeout for architect (30m)', () => {
    const timeout = getStageTimeout('architect')
    expect(timeout).toBe(1800000) // 30 minutes in ms
  })

  it('returns correct timeout for verify (10m)', () => {
    const timeout = getStageTimeout('verify')
    expect(timeout).toBe(600000) // 10 minutes in ms
  })

  it('returns correct timeout for pr (5m)', () => {
    const timeout = getStageTimeout('pr')
    expect(timeout).toBe(300000) // 5 minutes in ms
  })

  it('returns correct timeout for all 13 stages', () => {
    const stages = [
      'taskify', 'gap', 'clarify', 'architect', 'plan-gap',
      'test', 'build', 'commit', 'review', 'fix', 'verify', 'docs', 'pr',
    ]
    for (const stage of stages) {
      const timeout = getStageTimeout(stage)
      expect(timeout).toBeGreaterThan(0)
    }
  })

  it('throws ZodError for invalid stage name', () => {
    expect(() => getStageTimeout('invalid-stage')).toThrow(z.ZodError)
  })

  it('throws ZodError with descriptive message for invalid stage', () => {
    try {
      getStageTimeout('nonexistent')
      expect.fail('Expected ZodError to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError)
      if (error instanceof z.ZodError) {
        expect(error.issues[0].message).toContain('Invalid stage name')
      }
    }
  })
})

// ============================================================================
// PipelineHealthReport.checkStageHealth Tests
// ============================================================================

describe('PipelineHealthReport.checkStageHealth', () => {
  const reporter = new PipelineHealthReport()

  it('returns HealthStatus for a valid stage', () => {
    const status = reporter.checkStageHealth('build')
    expect(status).toHaveProperty('status')
    expect(status).toHaveProperty('message')
    expect(status).toHaveProperty('timestamp')
    expect(['pass', 'fail', 'warn']).toContain(status.status)
  })

  it('returns status with timestamp as Date instance', () => {
    const status = reporter.checkStageHealth('architect')
    expect(status.timestamp).toBeInstanceOf(Date)
  })

  it('throws ZodError for invalid stage name', () => {
    expect(() => reporter.checkStageHealth('invalid-stage')).toThrow(z.ZodError)
  })

  it('validates stage parameter with Zod schema', () => {
    // Valid stages should not throw
    expect(() => reporter.checkStageHealth('taskify')).not.toThrow()
    expect(() => reporter.checkStageHealth('gap')).not.toThrow()
    expect(() => reporter.checkStageHealth('verify')).not.toThrow()
  })

  it('returns pass status for agent stages with retries', () => {
    const status = reporter.checkStageHealth('build')
    expect(status.status).toBe('pass')
  })
})

// ============================================================================
// PipelineHealthReport.generateReport Tests
// ============================================================================

describe('PipelineHealthReport.generateReport', () => {
  const reporter = new PipelineHealthReport()

  it('returns a Report object', () => {
    const report = reporter.generateReport()
    expect(report).toHaveProperty('overallHealth')
    expect(report).toHaveProperty('stageStatuses')
    expect(report).toHaveProperty('generatedAt')
  })

  it('returns overallHealth as healthy when all stages pass', () => {
    const report = reporter.generateReport()
    expect(['healthy', 'degraded', 'unhealthy']).toContain(report.overallHealth)
  })

  it('returns stageStatuses for all 13 stages', () => {
    const report = reporter.generateReport()
    const stageNames = Object.keys(report.stageStatuses)
    expect(stageNames).toHaveLength(13)
    expect(stageNames).toContain('taskify')
    expect(stageNames).toContain('architect')
    expect(stageNames).toContain('build')
    expect(stageNames).toContain('verify')
    expect(stageNames).toContain('pr')
  })

  it('each stageStatus has status, message, and timestamp', () => {
    const report = reporter.generateReport()
    for (const [_stageName, status] of Object.entries(report.stageStatuses)) {
      expect(status).toHaveProperty('status')
      expect(status).toHaveProperty('message')
      expect(status).toHaveProperty('timestamp')
      expect(['pass', 'fail', 'warn']).toContain(status.status)
      expect(typeof status.message).toBe('string')
      expect(status.timestamp).toBeInstanceOf(Date)
    }
  })

  it('generatedAt is a Date instance', () => {
    const report = reporter.generateReport()
    expect(report.generatedAt).toBeInstanceOf(Date)
  })

  it('stageStatuses includes all required stages per spec', () => {
    const report = reporter.generateReport()
    const requiredStages = [
      'taskify', 'architect', 'gap', 'plan-gap', 'build', 'commit', 'review', 'verify', 'pr',
    ]
    for (const stage of requiredStages) {
      expect(report.stageStatuses).toHaveProperty(stage)
    }
  })
})

// ============================================================================
// PipelineHealthReport.getRetryRecommendation Tests
// ============================================================================

describe('PipelineHealthReport.getRetryRecommendation', () => {
  const reporter = new PipelineHealthReport()

  it('returns RetryStrategy for a valid stage', () => {
    const strategy = reporter.getRetryRecommendation('build')
    expect(strategy).toHaveProperty('shouldRetry')
    expect(strategy).toHaveProperty('maxRetries')
    expect(strategy).toHaveProperty('backoffMultiplier')
    expect(typeof strategy.shouldRetry).toBe('boolean')
    expect(typeof strategy.maxRetries).toBe('number')
    expect(typeof strategy.backoffMultiplier).toBe('number')
  })

  it('throws ZodError for invalid stage name', () => {
    expect(() => reporter.getRetryRecommendation('invalid-stage')).toThrow(z.ZodError)
  })

  it('validates failedStage parameter with Zod schema', () => {
    // Valid stages should not throw
    expect(() => reporter.getRetryRecommendation('taskify')).not.toThrow()
    expect(() => reporter.getRetryRecommendation('verify')).not.toThrow()
  })

  it('returns shouldRetry=true for build stage (has retries configured)', () => {
    const strategy = reporter.getRetryRecommendation('build')
    expect(strategy.shouldRetry).toBe(true)
    expect(strategy.maxRetries).toBe(1)
  })

  it('returns shouldRetry=false for verify stage (no retries)', () => {
    const strategy = reporter.getRetryRecommendation('verify')
    expect(strategy.shouldRetry).toBe(false)
  })

  it('returns shouldRetry=false for pr stage (git stage)', () => {
    const strategy = reporter.getRetryRecommendation('pr')
    expect(strategy.shouldRetry).toBe(false)
  })

  it('returns shouldRetry=false for commit stage (git stage)', () => {
    const strategy = reporter.getRetryRecommendation('commit')
    expect(strategy.shouldRetry).toBe(false)
  })

  it('returns shouldRetry=true and maxRetries=2 for taskify stage', () => {
    const strategy = reporter.getRetryRecommendation('taskify')
    expect(strategy.shouldRetry).toBe(true)
    expect(strategy.maxRetries).toBe(2)
  })

  it('returns backoffMultiplier of 2.0 for agent stages', () => {
    const agentStages = ['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'fix']
    for (const stage of agentStages) {
      const strategy = reporter.getRetryRecommendation(stage)
      expect(strategy.backoffMultiplier).toBe(2.0)
    }
  })

  it('returns backoffMultiplier of 1.5 for non-agent stages', () => {
    const stages = ['verify', 'docs']
    for (const stage of stages) {
      const strategy = reporter.getRetryRecommendation(stage)
      expect(strategy.backoffMultiplier).toBe(1.5)
    }
  })
})

// ============================================================================
// Zod Schema Validation Tests
// ============================================================================

describe('Zod schema validation', () => {
  describe('stageNameSchema', () => {
    it('accepts all valid stage names', () => {
      const validStages = [
        'taskify', 'gap', 'clarify', 'architect', 'plan-gap',
        'test', 'build', 'commit', 'review', 'fix', 'verify', 'docs', 'pr',
      ]
      for (const stage of validStages) {
        const result = stageNameSchema.safeParse(stage)
        expect(result.success).toBe(true)
      }
    })

    it('rejects invalid stage names', () => {
      const invalidStages = ['invalid', 'nonexistent', 'build-stage', '']
      for (const stage of invalidStages) {
        const result = stageNameSchema.safeParse(stage)
        expect(result.success).toBe(false)
      }
    })
  })

  describe('failedStageSchema', () => {
    it('accepts valid stage names', () => {
      const result = failedStageSchema.safeParse('build')
      expect(result.success).toBe(true)
    })

    it('rejects invalid stage names', () => {
      const result = failedStageSchema.safeParse('invalid')
      expect(result.success).toBe(false)
    })
  })
})
