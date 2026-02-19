import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  resolveModel,
  DEFAULT_MODEL,
  FAST_MODEL,
  STAGE_MODELS,
  STAGE_TIMEOUTS,
} from '../../../../scripts/cody/agent-runner'

describe('agent-runner', () => {
  describe('resolveModel', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      delete process.env.OPENCODE_MODEL
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should return explicit model when provided', () => {
      expect(resolveModel('build', 'custom/model')).toBe('custom/model')
    })

    it('should use OPENCODE_MODEL env var over stage-specific model', () => {
      process.env.OPENCODE_MODEL = 'env/model'
      expect(resolveModel('commit')).toBe('env/model')
    })

    it('should return FAST_MODEL for lightweight stages', () => {
      expect(resolveModel('plan-review')).toBe(FAST_MODEL)
      expect(resolveModel('commit')).toBe(FAST_MODEL)
      expect(resolveModel('auditor')).toBe(FAST_MODEL)
    })

    it('should return FAST_MODEL for autofix stage', () => {
      expect(resolveModel('autofix')).toBe(FAST_MODEL)
    })

    it('should return DEFAULT_MODEL for heavy stages', () => {
      expect(resolveModel('build')).toBe(DEFAULT_MODEL)
      expect(resolveModel('test')).toBe(DEFAULT_MODEL)
      expect(resolveModel('architect')).toBe(DEFAULT_MODEL)
    })

    it('should return DEFAULT_MODEL for unknown stages', () => {
      expect(resolveModel('unknown-stage')).toBe(DEFAULT_MODEL)
    })

    it('explicit model takes priority over OPENCODE_MODEL env', () => {
      process.env.OPENCODE_MODEL = 'env/model'
      expect(resolveModel('build', 'explicit/model')).toBe('explicit/model')
    })
  })

  describe('STAGE_MODELS', () => {
    it('should map lightweight stages to FAST_MODEL', () => {
      expect(STAGE_MODELS['plan-review']).toBe(FAST_MODEL)
      expect(STAGE_MODELS['commit']).toBe(FAST_MODEL)
      expect(STAGE_MODELS['auditor']).toBe(FAST_MODEL)
      expect(STAGE_MODELS['autofix']).toBe(FAST_MODEL)
    })

    it('should NOT have entries for heavy stages', () => {
      expect(STAGE_MODELS['build']).toBeUndefined()
      expect(STAGE_MODELS['test']).toBeUndefined()
      expect(STAGE_MODELS['architect']).toBeUndefined()
    })
  })

  describe('STAGE_TIMEOUTS', () => {
    it('should have a timeout for autofix', () => {
      expect(STAGE_TIMEOUTS['autofix']).toBe(10 * 60_000)
    })

    it('should have longer timeout for build than commit', () => {
      expect(STAGE_TIMEOUTS['build']).toBeGreaterThan(STAGE_TIMEOUTS['commit'])
    })
  })
})
