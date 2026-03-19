/**
 * @fileType test
 * @domain infra
 * @pattern pipeline-health
 * @ai-summary Unit tests for PipelineHealthReport utility module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  PipelineHealthReport,
  getStageTimeout,
  STAGE_NAMES,
  type HealthStatus,
  type Report,
  type RetryStrategy,
} from '@/infra/utils/pipeline-health'
import {
  stageNameSchema,
  healthStatusSchema,
  retryStrategySchema,
} from '@/infra/utils/pipeline-health'

describe('pipeline-health module', () => {
  // ============================================================================
  // STAGE_NAMES
  // ============================================================================

  describe('STAGE_NAMES', () => {
    it('should contain all required stages', () => {
      const expectedStages = [
        'taskify',
        'gap',
        'clarify',
        'architect',
        'plan-gap',
        'test',
        'build',
        'commit',
        'review',
        'fix',
        'verify',
        'docs',
        'pr',
      ]
      expect(STAGE_NAMES).toHaveLength(expectedStages.length)
      expectedStages.forEach((stage) => {
        expect(STAGE_NAMES).toContain(stage)
      })
    })
  })

  // ============================================================================
  // Zod Schemas
  // ============================================================================

  describe('stageNameSchema', () => {
    it('should validate valid stage names', () => {
      STAGE_NAMES.forEach((stage) => {
        const result = stageNameSchema.safeParse(stage)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid stage names', () => {
      const result = stageNameSchema.safeParse('invalid-stage')
      expect(result.success).toBe(false)
    })
  })

  describe('healthStatusSchema', () => {
    it('should validate valid health status', () => {
      const validStatus: HealthStatus = {
        stage: 'build',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'All good',
      }
      const result = healthStatusSchema.safeParse(validStatus)
      expect(result.success).toBe(true)
    })

    it('should reject invalid status values', () => {
      const invalidStatus = {
        stage: 'build',
        status: 'invalid',
        timestamp: new Date().toISOString(),
      }
      const result = healthStatusSchema.safeParse(invalidStatus)
      expect(result.success).toBe(false)
    })
  })

  describe('retryStrategySchema', () => {
    it('should validate valid retry strategy', () => {
      const validStrategy: RetryStrategy = {
        maxRetries: 3,
        backoffMs: 5000,
        strategyType: 'exponential',
      }
      const result = retryStrategySchema.safeParse(validStrategy)
      expect(result.success).toBe(true)
    })

    it('should reject invalid strategy types', () => {
      const invalidStrategy = {
        maxRetries: 3,
        backoffMs: 5000,
        strategyType: 'invalid',
      }
      const result = retryStrategySchema.safeParse(invalidStrategy)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // getStageTimeout
  // ============================================================================

  describe('getStageTimeout', () => {
    it('should return correct timeout for taskify', () => {
      expect(getStageTimeout('taskify')).toBe(10 * 60 * 1000)
    })

    it('should return correct timeout for gap', () => {
      expect(getStageTimeout('gap')).toBe(15 * 60 * 1000)
    })

    it('should return correct timeout for build', () => {
      expect(getStageTimeout('build')).toBe(15 * 60 * 1000)
    })

    it('should return correct timeout for commit', () => {
      expect(getStageTimeout('commit')).toBe(5 * 60 * 1000)
    })

    it('should return correct timeout for pr', () => {
      expect(getStageTimeout('pr')).toBe(5 * 60 * 1000)
    })

    it('should return default timeout for unknown stage', () => {
      expect(getStageTimeout('unknown-stage')).toBe(5 * 60 * 1000)
    })

    it('should return default timeout for empty string', () => {
      expect(getStageTimeout('')).toBe(5 * 60 * 1000)
    })
  })

  // ============================================================================
  // PipelineHealthReport
  // ============================================================================

  describe('PipelineHealthReport', () => {
    let report: PipelineHealthReport

    beforeEach(() => {
      report = new PipelineHealthReport()
    })

    describe('constructor', () => {
      it('should create instance without initial data', () => {
        expect(report).toBeDefined()
      })

      it('should create instance with initial data', () => {
        const initialData: Record<string, HealthStatus> = {
          build: {
            stage: 'build',
            status: 'failed',
            timestamp: new Date().toISOString(),
            message: 'Build failed',
          },
        }
        const reportWithData = new PipelineHealthReport(initialData)
        expect(reportWithData).toBeDefined()
      })
    })

    describe('checkStageHealth', () => {
      it('should return healthy status for unknown stage', () => {
        const health = report.checkStageHealth('build')
        expect(health.status).toBe('healthy')
        expect(health.stage).toBe('build')
        expect(health.timestamp).toBeDefined()
      })

      it('should return stored status when available', () => {
        const initialData: Record<string, HealthStatus> = {
          build: {
            stage: 'build',
            status: 'degraded',
            timestamp: new Date().toISOString(),
            message: 'Slow performance',
          },
        }
        const reportWithData = new PipelineHealthReport(initialData)
        const health = reportWithData.checkStageHealth('build')
        expect(health.status).toBe('degraded')
        expect(health.message).toBe('Slow performance')
      })

      it('should throw on empty stage name', () => {
        expect(() => report.checkStageHealth('')).toThrow()
      })
    })

    describe('generateReport', () => {
      it('should generate report with all stages', () => {
        const report_output = report.generateReport()
        expect(report_output.stages).toHaveLength(STAGE_NAMES.length)
        expect(report_output.overallHealth).toBeDefined()
        expect(report_output.generatedAt).toBeDefined()
      })

      it('should calculate correct overall health', () => {
        const initialData: Record<string, HealthStatus> = {
          build: { stage: 'build', status: 'failed', timestamp: new Date().toISOString() },
          test: { stage: 'test', status: 'degraded', timestamp: new Date().toISOString() },
        }
        const reportWithData = new PipelineHealthReport(initialData)
        const report_output = reportWithData.generateReport()
        // 1 degraded + 1 failed + 11 unknown = 1 healthy/degraded (the degraded one)
        const healthyCount = report_output.stages.filter(
          (s) => s.status === 'healthy' || s.status === 'degraded',
        ).length
        expect(healthyCount).toBe(1) // Only the degraded stage counts as healthy
        expect(report_output.overallHealth).toBeGreaterThanOrEqual(0)
      })
    })

    describe('getRetryRecommendation', () => {
      it('should return exponential strategy for gap stage', () => {
        const strategy = report.getRetryRecommendation('gap')
        expect(strategy.strategyType).toBe('exponential')
        expect(strategy.maxRetries).toBe(3)
      })

      it('should return fixed strategy for build stage', () => {
        const strategy = report.getRetryRecommendation('build')
        expect(strategy.strategyType).toBe('fixed')
        expect(strategy.maxRetries).toBe(2)
      })

      it('should return linear strategy for verify stage', () => {
        const strategy = report.getRetryRecommendation('verify')
        expect(strategy.strategyType).toBe('linear')
        expect(strategy.maxRetries).toBe(3)
      })

      it('should return default strategy for unknown stage', () => {
        const strategy = report.getRetryRecommendation('unknown-stage')
        expect(strategy.strategyType).toBe('fixed')
        expect(strategy.maxRetries).toBe(2)
      })

      it('should throw on empty stage name', () => {
        expect(() => report.getRetryRecommendation('')).toThrow()
      })
    })
  })
})
