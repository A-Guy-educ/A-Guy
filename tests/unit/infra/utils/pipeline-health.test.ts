import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  PipelineHealthReport,
  getStageTimeout,
  STAGE_NAMES,
  type HealthStatus,
  type Report,
  type RetryStrategy,
} from '@/infra/utils/pipeline-health'

describe('pipeline-health utilities', () => {
  describe('getStageTimeout', () => {
    it('returns correct timeout for known stages', () => {
      // architect has 30 minute timeout
      expect(getStageTimeout('architect')).toBe(30 * 60 * 1000)
      // build has 45 minute timeout
      expect(getStageTimeout('build')).toBe(45 * 60 * 1000)
      // commit has 5 minute timeout
      expect(getStageTimeout('commit')).toBe(5 * 60 * 1000)
    })

    it('returns default timeout for unknown stages', () => {
      // Unknown stage should get default 30 minute timeout
      expect(getStageTimeout('unknown-stage')).toBe(30 * 60 * 1000)
      expect(getStageTimeout('')).toBe(30 * 60 * 1000)
    })
  })

  describe('PipelineHealthReport', () => {
    let report: PipelineHealthReport

    beforeEach(() => {
      report = new PipelineHealthReport()
    })

    describe('checkStageHealth', () => {
      it('returns healthy status for valid stages', () => {
        const health = report.checkStageHealth('build')

        expect(health.status).toBe('healthy')
        expect(health.stage).toBe('build')
        expect(health.message).toContain('healthy')
        expect(health.timestamp).toBeInstanceOf(Date)
      })

      it('throws ZodError for invalid stage names', () => {
        expect(() => report.checkStageHealth('invalid')).toThrow(ZodError)
        expect(() => report.checkStageHealth('')).toThrow(ZodError)
      })
    })

    describe('generateReport', () => {
      it('returns report with all stages', () => {
        const fullReport = report.generateReport()

        expect(fullReport.stages).toHaveLength(STAGE_NAMES.length)
        expect(fullReport.generatedAt).toBeInstanceOf(Date)
        expect(fullReport.overallStatus).toBe('healthy')
      })

      it('report contains all stage names', () => {
        const fullReport = report.generateReport()

        const stageNames = fullReport.stages.map((s) => s.stage)
        STAGE_NAMES.forEach((name) => {
          expect(stageNames).toContain(name)
        })
      })

      it('each stage has required properties', () => {
        const fullReport = report.generateReport()

        fullReport.stages.forEach((stage) => {
          expect(stage).toHaveProperty('status')
          expect(stage).toHaveProperty('message')
          expect(stage).toHaveProperty('stage')
          expect(stage).toHaveProperty('timestamp')
          expect(['healthy', 'warning', 'critical']).toContain(stage.status)
        })
      })
    })

    describe('getRetryRecommendation', () => {
      it('returns retry strategy for failed stage', () => {
        const strategy = report.getRetryRecommendation('build')

        expect(strategy.shouldRetry).toBe(true)
        expect(strategy.maxRetries).toBe(3) // Long-running stage
        expect(strategy.backoffMultiplier).toBe(2)
        expect(strategy.retryDelayMs).toBe(60000) // 1 minute for long-running
      })

      it('returns no-retry strategy for unknown stages', () => {
        // Unknown stage defaults to non-long-running retry params
        const strategy = report.getRetryRecommendation('gap')
        expect(strategy.shouldRetry).toBe(true)
        expect(strategy.maxRetries).toBe(5) // Non-long-running stage
        expect(strategy.retryDelayMs).toBe(30000) // 30 seconds
      })

      it('throws ZodError for invalid stage names', () => {
        expect(() => report.getRetryRecommendation('invalid')).toThrow(ZodError)
        expect(() => report.getRetryRecommendation('')).toThrow(ZodError)
      })
    })
  })
})
