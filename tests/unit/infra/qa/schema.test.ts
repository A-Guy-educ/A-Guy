/**
 * @fileType test
 * @domain qa
 * @pattern qa-schema-tests
 * @ai-summary Tests for QA schema validation
 */
import { describe, it, expect } from 'vitest'
import {
  ScenarioSchema,
  StepSchema,
  ScenarioCategorySchema,
  ScenarioStatusSchema,
  FixtureSchema,
  DSComponentSchema,
  ElementMappingSchema,
  validateScenario,
  validateFixture,
} from '@/infra/qa/schema'

describe('ScenarioSchema', () => {
  it('should validate a minimal scenario', () => {
    const scenario = {
      id: 'test-scenario',
      name: 'Test Scenario',
      type: 'feature',
      steps: [
        { type: 'given', action: 'login', target: '#login-form' },
        { type: 'when', action: 'click', target: '#submit-btn' },
        { type: 'then', action: 'see', target: '#dashboard' },
      ],
    }

    const result = ScenarioSchema.safeParse(scenario)
    expect(result.success).toBe(true)
  })

  it('should validate a complete scenario with all fields', () => {
    const scenario = {
      id: 'complete-scenario',
      name: 'Complete Test Scenario',
      journey: 'test-journey',
      type: 'core',
      area: 'auth',
      tags: ['login', 'test'],
      locale: 'he',
      status: 'draft',
      prototype: 'login-page.html',
      fixture: 'test-fixture',
      preconditions: [{ action: 'seed', entity: 'user', data: { role: 'student' }, ref: '$user' }],
      steps: [
        { type: 'given', action: 'beAt', target: '/login', component: 'Button' },
        { type: 'when', action: 'click', target: '#login-btn', component: 'Button' },
        { type: 'then', action: 'see', target: '#welcome', component: 'Text' },
      ],
      siteBehaviors: ['loading-spinner', 'error-toast'],
    }

    const result = ScenarioSchema.safeParse(scenario)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('complete-scenario')
      expect(result.data.status).toBe('draft')
    }
  })

  it('should reject scenario without required fields', () => {
    const scenario = {
      id: 'incomplete',
      // missing name
      type: 'feature',
      steps: [],
    }

    const result = ScenarioSchema.safeParse(scenario)
    expect(result.success).toBe(false)
  })

  it('should reject scenario with empty steps', () => {
    const scenario = {
      id: 'no-steps',
      name: 'No Steps',
      type: 'feature',
      steps: [], // must have at least 1 step
    }

    const result = ScenarioSchema.safeParse(scenario)
    expect(result.success).toBe(false)
  })

  it('should validate all scenario categories', () => {
    expect(ScenarioCategorySchema.safeParse('core').success).toBe(true)
    expect(ScenarioCategorySchema.safeParse('feature').success).toBe(true)
    expect(ScenarioCategorySchema.safeParse('edge').success).toBe(true)
    expect(ScenarioCategorySchema.safeParse('invalid').success).toBe(false)
  })

  it('should validate all scenario statuses', () => {
    expect(ScenarioStatusSchema.safeParse('draft').success).toBe(true)
    expect(ScenarioStatusSchema.safeParse('planned').success).toBe(true)
    expect(ScenarioStatusSchema.safeParse('implemented').success).toBe(true)
    expect(ScenarioStatusSchema.safeParse('verified').success).toBe(true)
  })
})

describe('StepSchema', () => {
  it('should validate a step with all fields', () => {
    const step = {
      type: 'when',
      action: 'click',
      target: '#submit-btn',
      component: 'Button',
      input: { key: 'value' },
      description: 'Click submit button',
    }

    const result = StepSchema.safeParse(step)
    expect(result.success).toBe(true)
  })

  it('should validate a minimal step', () => {
    const step = {
      type: 'then',
      action: 'see',
      target: '#result',
    }

    const result = StepSchema.safeParse(step)
    expect(result.success).toBe(true)
  })

  it('should reject step with invalid type', () => {
    const step = {
      type: 'invalid',
      action: 'click',
      target: '#btn',
    }

    const result = StepSchema.safeParse(step)
    expect(result.success).toBe(false)
  })

  it('should accept all valid step types', () => {
    const types = ['given', 'when', 'then', 'and', 'but']
    for (const type of types) {
      const step = { type, action: 'test', target: '#test' }
      expect(StepSchema.safeParse(step).success).toBe(true)
    }
  })
})

describe('FixtureSchema', () => {
  it('should validate a fixture', () => {
    const fixture = {
      id: 'test-fixture',
      name: 'Test Fixture',
      entities: [
        {
          type: 'user',
          ref: '$user',
          data: { email: 'test@example.com', role: 'student' },
        },
      ],
    }

    const result = FixtureSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })

  it('should accept fixture without entities (entities are optional)', () => {
    const fixture = {
      id: 'no-entities',
      name: 'No Entities',
    }

    const result = FixtureSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })
})

describe('DSComponentSchema', () => {
  it('should validate a component with variants', () => {
    const component = {
      name: 'Button',
      path: '@/ui/web/components/button',
      variants: ['default', 'destructive', 'outline'],
      sizes: ['sm', 'md', 'lg'],
    }

    const result = DSComponentSchema.safeParse(component)
    expect(result.success).toBe(true)
  })

  it('should validate a minimal component', () => {
    const component = {
      name: 'Card',
      path: '@/ui/web/components/card',
    }

    const result = DSComponentSchema.safeParse(component)
    expect(result.success).toBe(true)
  })
})

describe('ElementMappingSchema', () => {
  it('should validate a mapping', () => {
    const mapping = {
      prototypeSelector: '#submit-btn',
      dsComponent: 'Button',
      variant: 'primary',
      reason: 'Consistent with design system',
    }

    const result = ElementMappingSchema.safeParse(mapping)
    expect(result.success).toBe(true)
  })
})

describe('validateScenario helper', () => {
  it('should return success for valid scenario', () => {
    const scenario = {
      id: 'helper-test',
      name: 'Helper Test',
      type: 'feature',
      steps: [{ type: 'when', action: 'test', target: '#test' }],
    }

    const result = validateScenario(scenario)
    expect(result.success).toBe(true)
  })

  it('should return error for invalid scenario', () => {
    const result = validateScenario({})
    expect(result.success).toBe(false)
  })
})

describe('validateFixture helper', () => {
  it('should return success for valid fixture', () => {
    const fixture = {
      id: 'helper-fixture',
      name: 'Helper Fixture',
      entities: [{ type: 'user', ref: '$user', data: {} }],
    }

    const result = validateFixture(fixture)
    expect(result.success).toBe(true)
  })
})
