import { describe, it, expect } from 'vitest'
import {
  PipelineHealthReport,
  getStageTimeout,
  stageNameSchema,
  HealthStatus,
  Report,
  RetryStrategy,
} from '@/infra/utils/pipeline-health'

describe('PipelineHealthReport', () => {
  const report = new PipelineHealthReport()

  describe('checkStageHealth', () => {
    it('returns HealthStatus for valid stage name', () => {
      const status = report.checkStageHealth('build')
      expect(status.stage).toBe('build')
      expect(typeof status.isHealthy).toBe('boolean')
      expect(status.lastChecked).toBeInstanceOf(Date)
    })

    it('throws on unknown stage name', () => {
      // Unknown stages are validated by stageNameSchema and throw ZodError
      expect(() => report.checkStageHealth('nonexistent')).toThrow()
    })

    it('throws on empty string input', () => {
      expect(() => report.checkStageHealth('')).toThrow()
    })
  })

  describe('generateReport', () => {
    it('returns Report with correct structure', () => {
      const result = report.generateReport()
      expect(result.overallStatus).toMatch(/^(healthy|degraded|unhealthy)$/)
      expect(Array.isArray(result.stageStatuses)).toBe(true)
      expect(result.generatedAt).toBeInstanceOf(Date)
    })

    it('includes all known stages in stageStatuses', () => {
      const result = report.generateReport()
      expect(result.stageStatuses.length).toBeGreaterThan(0)
    })

    it('defaults to healthy when all stages are healthy', () => {
      const result = report.generateReport()
      expect(result.overallStatus).toBe('healthy')
    })
  })

  describe('getRetryRecommendation', () => {
    it('returns RetryStrategy with required fields', () => {
      const strategy = report.getRetryRecommendation('build')
      expect(typeof strategy.maxRetries).toBe('number')
      expect(typeof strategy.backoffMultiplier).toBe('number')
      expect(typeof strategy.retryDelay).toBe('number')
      expect(strategy.stage).toBe('build')
    })

    it('throws on unknown stage name', () => {
      // Unknown stages are validated by failedStageSchema and throw ZodError
      expect(() => report.getRetryRecommendation('unknown')).toThrow()
    })

    it('throws on empty string input', () => {
      expect(() => report.getRetryRecommendation('')).toThrow()
    })
  })
})

describe('getStageTimeout', () => {
  it('returns positive timeout for known stage', () => {
    expect(getStageTimeout('build')).toBeGreaterThan(0)
    expect(getStageTimeout('architect')).toBeGreaterThan(0)
  })

  it('returns fallback for unknown stage', () => {
    const buildTimeout = getStageTimeout('build')
    const unknownTimeout = getStageTimeout('not-a-stage')
    // Should fall back to build timeout
    expect(unknownTimeout).toBe(buildTimeout)
  })
})

describe('stageNameSchema', () => {
  it('accepts valid stage name', () => {
    const result = stageNameSchema.safeParse('build')
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = stageNameSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('rejects invalid stage name', () => {
    const result = stageNameSchema.safeParse('not-a-stage')
    expect(result.success).toBe(false)
  })
})
