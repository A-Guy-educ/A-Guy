/**
 * @fileType test
 * @domain cody
 * @ai-summary Tests for the Zod TaskDefinitionSchema and parseTaskDefinition function
 */

import { describe, it, expect } from 'vitest'
import { TaskDefinitionSchema, parseTaskDefinition } from '../../../../scripts/cody/pipeline-utils'

describe('TaskDefinitionSchema', () => {
  describe('safeParse with valid input', () => {
    it('should return normalized data for valid input', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app'],
        missing_inputs: [{ field: 'title', question: 'What is the feature?' }],
        assumptions: ['User is authenticated'],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.task_type).toBe('implement_feature')
        expect(result.data.pipeline).toBe('spec_execute_verify')
        expect(result.data.risk_level).toBe('medium')
        expect(result.data.confidence).toBe(0.9)
        expect(result.data.primary_domain).toBe('backend')
        expect(result.data.scope).toEqual(['src/app'])
        expect(result.data.missing_inputs).toHaveLength(1)
        expect(result.data.assumptions).toEqual(['User is authenticated'])
      }
    })

    it('should normalize aliases (feature → implement_feature)', () => {
      const raw = {
        task_type: 'feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app'],
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.task_type).toBe('implement_feature')
        expect(result.data.pipeline).toBe('spec_execute_verify')
      }
    })

    it('should normalize aliases (bug → fix_bug)', () => {
      const raw = {
        task_type: 'bug',
        risk_level: 'high',
        confidence: 'high',
        primary_domain: 'frontend',
        scope: ['components'],
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.task_type).toBe('fix_bug')
        expect(result.data.pipeline).toBe('spec_execute_verify')
        expect(result.data.confidence).toBe(0.9)
      }
    })

    it('should convert string confidence to number', () => {
      const raw = {
        task_type: 'fix_bug',
        risk_level: 'medium',
        confidence: 'high',
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence).toBe(0.9)
      }
    })

    it('should convert string confidence "medium" to 0.7', () => {
      const raw = {
        task_type: 'fix_bug',
        risk_level: 'medium',
        confidence: 'medium',
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence).toBe(0.7)
      }
    })

    it('should convert string confidence "0.9" to number 0.9', () => {
      const raw = {
        task_type: 'fix_bug',
        risk_level: 'medium',
        confidence: '0.9',
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence).toBe(0.9)
      }
    })

    it('should wrap string scope in array', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: 'src/app',
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.scope).toEqual(['src/app'])
      }
    })

    it('should handle array scope as-is', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app', 'src/lib'],
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.scope).toEqual(['src/app', 'src/lib'])
      }
    })

    it('should default missing arrays to empty arrays', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.missing_inputs).toEqual([])
        expect(result.data.assumptions).toEqual([])
        expect(result.data.review_questions).toEqual([])
      }
    })

    it('should normalize complexity string to number', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        complexity: '50',
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.complexity).toBe(50)
      }
    })

    it('should clamp complexity to valid range', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        complexity: 150,
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.complexity).toBe(100)
      }
    })

    it('should clamp negative complexity to minimum', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        complexity: -10,
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.complexity).toBe(1)
      }
    })

    it('should validate and accept valid pipeline_profile', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        pipeline_profile: 'lightweight',
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.pipeline_profile).toBe('lightweight')
      }
    })

    it('should normalize input_quality with valid level', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'good_spec',
          skip_stages: ['spec'],
          reasoning: 'Already have a detailed spec',
        },
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.input_quality?.level).toBe('good_spec')
        expect(result.data.input_quality?.skip_stages).toEqual(['spec'])
        expect(result.data.input_quality?.reasoning).toBe('Already have a detailed spec')
      }
    })

    it('should default input_quality when missing', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.input_quality?.level).toBe('raw_idea')
        expect(result.data.input_quality?.skip_stages).toEqual([])
        expect(result.data.input_quality?.reasoning).toBe('')
      }
    })
  })

  describe('safeParse rejects invalid input', () => {
    it('should reject invalid pipeline_profile', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        pipeline_profile: 'invalid_profile',
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes('Invalid pipeline_profile')),
        ).toBe(true)
      }
    })

    it('should reject non-skippable stages in skip_stages (gap)', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'good_spec',
          skip_stages: ['gap'],
          reasoning: 'Test',
        },
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('Cannot skip stage "gap"'))).toBe(
          true,
        )
      }
    })

    it('should reject non-skippable stages in skip_stages (plan-gap)', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'good_spec',
          skip_stages: ['plan-gap'],
          reasoning: 'Test',
        },
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes('Cannot skip stage "plan-gap"')),
        ).toBe(true)
      }
    })

    it('should reject non-skippable stages in skip_stages (build)', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'good_spec',
          skip_stages: ['build'],
          reasoning: 'Test',
        },
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes('Cannot skip stage "build"')),
        ).toBe(true)
      }
    })

    it('should reject non-skippable stages in skip_stages (verify)', () => {
      const raw = {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src'],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'good_spec',
          skip_stages: ['verify'],
          reasoning: 'Test',
        },
      }

      const result = TaskDefinitionSchema.safeParse(raw)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes('Cannot skip stage "verify"')),
        ).toBe(true)
      }
    })
  })
})

describe('parseTaskDefinition', () => {
  it('should return TaskDefinition on valid input', () => {
    const raw = {
      task_type: 'fix_bug',
      risk_level: 'high',
      confidence: 'low',
      primary_domain: 'frontend',
      scope: 'components',
      missing_inputs: [],
      assumptions: [],
    }

    const result = parseTaskDefinition(raw)

    expect(result.task_type).toBe('fix_bug')
    expect(result.pipeline).toBe('spec_execute_verify')
    expect(result.risk_level).toBe('high')
    expect(result.confidence).toBe(0.5)
    expect(result.primary_domain).toBe('frontend')
    expect(result.scope).toEqual(['components'])
  })

  it('should throw descriptive error on invalid input', () => {
    const raw = {
      task_type: 'implement_feature',
      risk_level: 'medium',
      confidence: 0.9,
      primary_domain: 'backend',
      scope: ['src'],
      missing_inputs: [],
      assumptions: [],
      pipeline_profile: 'invalid_profile',
    }

    expect(() => parseTaskDefinition(raw)).toThrow('Invalid pipeline_profile')
  })

  it('should throw descriptive error on non-skippable stage', () => {
    const raw = {
      task_type: 'implement_feature',
      risk_level: 'medium',
      confidence: 0.9,
      primary_domain: 'backend',
      scope: ['src'],
      missing_inputs: [],
      assumptions: [],
      input_quality: {
        level: 'good_spec',
        skip_stages: ['gap'],
        reasoning: 'Test',
      },
    }

    expect(() => parseTaskDefinition(raw)).toThrow('Cannot skip stage "gap"')
  })

  it('should throw error for null input', () => {
    expect(() => parseTaskDefinition(null)).toThrow()
  })

  it('should throw error for undefined input', () => {
    expect(() => parseTaskDefinition(undefined)).toThrow()
  })

  it('should throw error for non-object input', () => {
    expect(() => parseTaskDefinition('string')).toThrow()
  })

  it('should throw error for array input', () => {
    expect(() => parseTaskDefinition([])).toThrow()
  })
})
