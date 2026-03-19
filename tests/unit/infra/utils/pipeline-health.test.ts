import { describe, it, expect } from 'vitest'
import {
  PipelineHealthReport,
  getStageTimeout,
  getAllStageNames,
  stageSchema,
  HealthStatus,
  Report,
  RetryStrategy,
} from '@/infra/utils/pipeline-health'

describe('getStageTimeout', () => {
  it('returns correct timeout for taskify (10m)', () => {
    expect(getStageTimeout('taskify')).toBe(600000)
  })

  it('returns correct timeout for gap (15m)', () => {
    expect(getStageTimeout('gap')).toBe(900000)
  })

  it('returns correct timeout for architect (30m)', () => {
    expect(getStageTimeout('architect')).toBe(1800000)
  })

  it('returns correct timeout for build (45m)', () => {
    expect(getStageTimeout('build')).toBe(2700000)
  })

  it('returns correct timeout for commit (5m)', () => {
    expect(getStageTimeout('commit')).toBe(300000)
  })

  it('returns default timeout for unknown stage', () => {
    expect(getStageTimeout('unknown-stage')).toBe(900000)
  })
})

describe('getAllStageNames', () => {
  it('returns all valid stage names', () => {
    const stages = getAllStageNames()
    expect(stages).toContain('taskify')
    expect(stages).toContain('gap')
    expect(stages).toContain('clarify')
    expect(stages).toContain('architect')
    expect(stages).toContain('plan-gap')
    expect(stages).toContain('test')
    expect(stages).toContain('build')
    expect(stages).toContain('commit')
    expect(stages).toContain('review')
    expect(stages).toContain('fix')
    expect(stages).toContain('verify')
    expect(stages).toContain('docs')
    expect(stages).toContain('pr')
    expect(stages.length).toBe(13)
  })
})

describe('stageSchema', () => {
  it('validates known stage names', () => {
    expect(stageSchema.safeParse('build').success).toBe(true)
    expect(stageSchema.safeParse('architect').success).toBe(true)
  })

  it('rejects unknown stage names', () => {
    expect(stageSchema.safeParse('unknown').success).toBe(false)
    expect(stageSchema.safeParse('').success).toBe(false)
  })
})

describe('PipelineHealthReport', () => {
  let report: PipelineHealthReport

  beforeEach(() => {
    report = new PipelineHealthReport()
  })

  describe('checkStageHealth', () => {
    it('returns valid HealthStatus for valid stage name', () => {
      const health = report.checkStageHealth('build')

      expect(health).toBeDefined()
      expect(health.stage).toBe('build')
      expect(health.status).toBeDefined()
      expect(['healthy', 'warning', 'failed']).toContain(health.status)
      expect(health.message).toBeDefined()
      expect(health.timestamp).toBeDefined()
    })

    it('throws error for invalid stage name', () => {
      expect(() => report.checkStageHealth('invalid-stage')).toThrow()
    })

    it('throws error for empty stage name', () => {
      expect(() => report.checkStageHealth('')).toThrow()
    })

    it('includes timeout in message for known stages', () => {
      const health = report.checkStageHealth('build')
      expect(health.message).toContain('2700000')
    })
  })

  describe('generateReport', () => {
    it('returns valid Report with all stages', () => {
      const fullReport = report.generateReport()

      expect(fullReport).toBeDefined()
      expect(fullReport.stages).toBeDefined()
      expect(Array.isArray(fullReport.stages)).toBe(true)
      expect(fullReport.stages.length).toBe(13) // All 13 stages
      expect(fullReport.generatedAt).toBeDefined()
      expect(fullReport.overallHealth).toBeDefined()
      expect(['healthy', 'degraded', 'failed']).toContain(fullReport.overallHealth)
    })

    it('includes all stage names in report', () => {
      const fullReport = report.generateReport()
      const stageNames = fullReport.stages.map((s) => s.stage)

      expect(stageNames).toContain('taskify')
      expect(stageNames).toContain('build')
      expect(stageNames).toContain('pr')
    })

    it('sets overallHealth to healthy when all stages healthy', () => {
      const fullReport = report.generateReport()
      expect(fullReport.overallHealth).toBe('healthy')
    })

    it('has valid timestamp format', () => {
      const fullReport = report.generateReport()
      const timestamp = new Date(fullReport.generatedAt)
      expect(timestamp.getTime()).toBeGreaterThan(0)
    })
  })

  describe('getRetryRecommendation', () => {
    it('returns valid RetryStrategy for valid stage name', () => {
      const strategy = report.getRetryRecommendation('build')

      expect(strategy).toBeDefined()
      expect(strategy.strategy).toBeDefined()
      expect(['immediate', 'exponential', 'manual']).toContain(strategy.strategy)
      expect(strategy.maxRetries).toBeDefined()
      expect(typeof strategy.maxRetries).toBe('number')
      expect(strategy.delayMs).toBeDefined()
      expect(typeof strategy.delayMs).toBe('number')
      expect(strategy.reason).toBeDefined()
    })

    it('returns manual strategy for taskify (requires human input)', () => {
      const strategy = report.getRetryRecommendation('taskify')
      expect(strategy.strategy).toBe('manual')
      expect(strategy.maxRetries).toBe(1)
    })

    it('returns exponential strategy for build (complex stage)', () => {
      const strategy = report.getRetryRecommendation('build')
      expect(strategy.strategy).toBe('exponential')
      expect(strategy.maxRetries).toBe(3)
      expect(strategy.delayMs).toBe(90000)
    })

    it('returns immediate strategy for commit (transient failures)', () => {
      const strategy = report.getRetryRecommendation('commit')
      expect(strategy.strategy).toBe('immediate')
      expect(strategy.maxRetries).toBe(2)
    })

    it('returns manual strategy for review (requires human)', () => {
      const strategy = report.getRetryRecommendation('review')
      expect(strategy.strategy).toBe('manual')
    })

    it('throws error for invalid stage name', () => {
      expect(() => report.getRetryRecommendation('invalid-stage')).toThrow()
    })

    it('returns valid strategies for all stages', () => {
      const stages = getAllStageNames()
      stages.forEach((stage) => {
        const strategy = report.getRetryRecommendation(stage)
        expect(strategy.strategy).toBeDefined()
        expect(strategy.maxRetries).toBeGreaterThanOrEqual(0)
        expect(strategy.delayMs).toBeGreaterThanOrEqual(0)
        expect(strategy.reason).toBeTruthy()
      })
    })
  })
})
