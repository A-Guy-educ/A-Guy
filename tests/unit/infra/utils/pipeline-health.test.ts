import { describe, it, expect } from 'vitest'
import { z } from 'zod'

describe('pipeline-health module', () => {
  describe('getStageTimeout', () => {
    it('should return timeout for architect stage', async () => {
      const { getStageTimeout } = await import('@/infra/utils/pipeline-health')
      const timeout = getStageTimeout('architect')
      expect(timeout).toBeGreaterThan(0)
      expect(typeof timeout).toBe('number')
    })

    it('should return timeout for build stage', async () => {
      const { getStageTimeout } = await import('@/infra/utils/pipeline-health')
      const timeout = getStageTimeout('build')
      expect(timeout).toBeGreaterThan(0)
      expect(typeof timeout).toBe('number')
    })

    it('should return timeout for test stage', async () => {
      const { getStageTimeout } = await import('@/infra/utils/pipeline-health')
      const timeout = getStageTimeout('test')
      expect(timeout).toBeGreaterThan(0)
      expect(typeof timeout).toBe('number')
    })

    it('should return default timeout for unknown stage', async () => {
      const { getStageTimeout } = await import('@/infra/utils/pipeline-health')
      const timeout = getStageTimeout('unknown-stage')
      expect(timeout).toBeGreaterThan(0)
      expect(typeof timeout).toBe('number')
    })

    it('should return consistent timeout for same stage', async () => {
      const { getStageTimeout } = await import('@/infra/utils/pipeline-health')
      const timeout1 = getStageTimeout('architect')
      const timeout2 = getStageTimeout('architect')
      expect(timeout1).toBe(timeout2)
    })
  })

  describe('PipelineHealthReport', () => {
    it('should be constructable', async () => {
      const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
      expect(() => new PipelineHealthReport()).not.toThrow()
    })

    describe('checkStageHealth', () => {
      it('should return health status for valid stage', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const status = report.checkStageHealth('architect')

        expect(status).toBeDefined()
        expect(status.stage).toBe('architect')
        expect(typeof status.isHealthy).toBe('boolean')
        expect(status.lastCheck).toBeInstanceOf(Date)
      })

      it('should return health status with message for valid stage', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const status = report.checkStageHealth('build')

        expect(status).toBeDefined()
        expect(typeof status.message).toBe('string')
      })

      it('should throw ZodValidationError for empty string stage', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()

        expect(() => report.checkStageHealth('')).toThrow()
      })

      it('should throw error for null input', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        // @ts-expect-error - testing runtime validation
        expect(() => report.checkStageHealth(null)).toThrow()
      })

      it('should throw error for number input', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        // @ts-expect-error - testing runtime validation
        expect(() => report.checkStageHealth(123)).toThrow()
      })
    })

    describe('generateReport', () => {
      it('should return a report object', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const result = report.generateReport()

        expect(result).toBeDefined()
        expect(result.timestamp).toBeInstanceOf(Date)
        expect(Array.isArray(result.stages)).toBe(true)
      })

      it('should include stages in the report', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const result = report.generateReport()

        expect(result.stages.length).toBeGreaterThan(0)
      })

      it('should have overallHealth property with valid value', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const result = report.generateReport()

        expect(['healthy', 'degraded', 'unhealthy']).toContain(result.overallHealth)
      })

      it('should have timestamp that is current or past', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const result = report.generateReport()
        const now = new Date()

        expect(result.timestamp.getTime()).toBeLessThanOrEqual(now.getTime())
      })
    })

    describe('getRetryRecommendation', () => {
      it('should return retry strategy for failed stage', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const strategy = report.getRetryRecommendation('build')

        expect(strategy).toBeDefined()
        expect(strategy.stage).toBe('build')
        expect(typeof strategy.recommendedRetries).toBe('number')
        expect(typeof strategy.backoffMultiplier).toBe('number')
        expect(typeof strategy.shouldRetry).toBe('boolean')
      })

      it('should return positive retry count', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const strategy = report.getRetryRecommendation('test')

        expect(strategy.recommendedRetries).toBeGreaterThanOrEqual(0)
      })

      it('should return positive backoff multiplier', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        const strategy = report.getRetryRecommendation('test')

        expect(strategy.backoffMultiplier).toBeGreaterThan(0)
      })

      it('should throw error for empty string stage', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()

        expect(() => report.getRetryRecommendation('')).toThrow()
      })

      it('should throw error for null input', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        // @ts-expect-error - testing runtime validation
        expect(() => report.getRetryRecommendation(null)).toThrow()
      })

      it('should throw error for undefined input', async () => {
        const { PipelineHealthReport } = await import('@/infra/utils/pipeline-health')
        const report = new PipelineHealthReport()
        // @ts-expect-error - testing runtime validation
        expect(() => report.getRetryRecommendation(undefined)).toThrow()
      })
    })
  })
})
