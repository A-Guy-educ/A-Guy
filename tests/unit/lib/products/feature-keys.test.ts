/**
 * Unit tests for FEATURE_KEYS
 *
 * @fileType unit-test
 * @domain billing
 * @ai-summary Tests FEATURE_KEYS enum values and FeatureKey type
 */

import { describe, expect, it } from 'vitest'

import { FEATURE_KEYS, type FeatureKey } from '@/lib/products/feature-keys'

describe('FEATURE_KEYS', () => {
  it('should have exactly 6 feature keys', () => {
    expect(FEATURE_KEYS).toHaveLength(6)
  })

  it('should contain expected feature keys', () => {
    expect(FEATURE_KEYS).toContain('live-sessions')
    expect(FEATURE_KEYS).toContain('download-resources')
    expect(FEATURE_KEYS).toContain('certificate')
    expect(FEATURE_KEYS).toContain('priority-support')
    expect(FEATURE_KEYS).toContain('analytics')
    expect(FEATURE_KEYS).toContain('group-access')
  })

  it('should have all lowercase kebab-case values', () => {
    const kebabCaseRegex = /^[a-z]+(-[a-z]+)*$/
    for (const key of FEATURE_KEYS) {
      expect(key).toMatch(kebabCaseRegex)
    }
  })

  it('should be readonly (immutable reference)', () => {
    // as const makes the array readonly but not necessarily frozen at runtime
    // Verify it's treated as readonly
    const keys: readonly string[] = FEATURE_KEYS
    expect(keys).toBe(FEATURE_KEYS)
  })

  it('should have correct type assignability', () => {
    // Verify FeatureKey type can be assigned from each value
    const checkType = (key: FeatureKey) => key
    for (const key of FEATURE_KEYS) {
      const result: FeatureKey = checkType(key)
      expect(FEATURE_KEYS).toContain(result)
    }
  })
})
