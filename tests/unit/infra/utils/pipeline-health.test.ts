import { describe, it, expect } from 'vitest'
import { PipelineHealthReport, getStageTimeout } from '@/infra/utils/pipeline-health'

describe('PipelineHealthReport', () => {
  let report: PipelineHealthReport

  beforeEach(() => {
    report = new PipelineHealthReport()
  })

  describe('checkStageHealth', () => {
    it('returns health status for a valid stage', () => {
      const result = report.checkStageHealth('build')

      expect(result).toMatchObject({
        stage: 'build',
        isHealthy: true,
      })
      expect(result.timestamp).toBeDefined()
      expect(result.message).toContain('45 minute timeout')
    })

    it('returns health status for architect stage', () => {
      const result = report.checkStageHealth('architect')

      expect(result).toMatchObject({
        stage: 'architect',
        isHealthy: true,
      })
      expect(result.message).toContain('30 minute timeout')
    })

    it('throws ZodError for invalid stage name', () => {
      expect(() => report.checkStageHealth('invalid-stage')).toThrow()
    })

    it('throws ZodError for empty string', () => {
      expect(() => report.checkStageHealth('')).toThrow()
    })
  })

  describe('generateReport', () => {
    it('returns a report with all stages', () => {
      const result = report.generateReport()

      expect(result.generatedAt).toBeDefined()
      expect(result.stages).toHaveLength(13) // All 13 pipeline stages
      expect(result.overallHealthy).toBe(true)
      expect(result.summary).toContain('13/13 stages are healthy')
    })

    it('includes all valid stage names in the report', () => {
      const result = report.generateReport()
      const stageNames = result.stages.map((s) => s.stage)

      expect(stageNames).toContain('taskify')
      expect(stageNames).toContain('gap')
      expect(stageNames).toContain('clarify')
      expect(stageNames).toContain('architect')
      expect(stageNames).toContain('plan-gap')
      expect(stageNames).toContain('test')
      expect(stageNames).toContain('build')
      expect(stageNames).toContain('commit')
      expect(stageNames).toContain('review')
      expect(stageNames).toContain('fix')
      expect(stageNames).toContain('verify')
      expect(stageNames).toContain('docs')
      expect(stageNames).toContain('pr')
    })

    it('all stages in report are healthy', () => {
      const result = report.generateReport()

      for (const stage of result.stages) {
        expect(stage.isHealthy).toBe(true)
      }
    })
  })

  describe('getRetryRecommendation', () => {
    it('returns retry strategy for build stage (agent stage)', () => {
      const result = report.getRetryRecommendation('build')

      expect(result).toMatchObject({
        stage: 'build',
        recommendedRetries: 2,
        backoffMultiplier: 2,
        shouldRetry: true,
      })
      expect(result.reason).toContain('Agent stages')
    })

    it('returns retry strategy for commit stage (git stage)', () => {
      const result = report.getRetryRecommendation('commit')

      expect(result).toMatchObject({
        stage: 'commit',
        recommendedRetries: 1,
        backoffMultiplier: 1.5,
        shouldRetry: true,
      })
      expect(result.reason).toContain('Git operations')
    })

    it('returns retry strategy for verify stage (scripted stage)', () => {
      const result = report.getRetryRecommendation('verify')

      expect(result).toMatchObject({
        stage: 'verify',
        recommendedRetries: 3,
        backoffMultiplier: 1.5,
        shouldRetry: true,
      })
      expect(result.reason).toContain('Scripted stages')
    })

    it('throws ZodError for invalid stage name', () => {
      expect(() => report.getRetryRecommendation('invalid-stage')).toThrow()
    })
  })
})

describe('getStageTimeout', () => {
  it('returns correct timeout for build stage (45 minutes)', () => {
    expect(getStageTimeout('build')).toBe(45 * 60 * 1000)
  })

  it('returns correct timeout for architect stage (30 minutes)', () => {
    expect(getStageTimeout('architect')).toBe(30 * 60 * 1000)
  })

  it('returns correct timeout for taskify stage (10 minutes)', () => {
    expect(getStageTimeout('taskify')).toBe(10 * 60 * 1000)
  })

  it('returns correct timeout for commit stage (5 minutes)', () => {
    expect(getStageTimeout('commit')).toBe(5 * 60 * 1000)
  })

  it('throws for invalid stage name', () => {
    expect(() => getStageTimeout('invalid-stage')).toThrow()
  })

  it('throws for empty string', () => {
    expect(() => getStageTimeout('')).toThrow()
  })
})
