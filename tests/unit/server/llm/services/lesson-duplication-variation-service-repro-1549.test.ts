import { describe, it, expect } from 'vitest'

/**
 * Repro test for issue #1549:
 * Lower temperature on deterministic pass, raise thinking budget for medium/deep
 *
 * Requirements:
 * - LESSON_DUPLICATION_VARIATION_CREATIVE: temperature 0.7, thinkingBudget 4000, maxOutputTokens 8192
 * - LESSON_DUPLICATION_VARIATION_DETERMINISTIC: temperature 0.0, thinkingBudget 6000, maxOutputTokens 8192
 *
 * Both use Gemini 3.1 Pro on the Gemini provider and MiniMax-M2.1 on the OpenAI-compatible fallback.
 */
import { MODEL_REGISTRY, getModelRegistryEntry } from '@/infra/llm/models'

describe('issue #1549 - thinking budget for creative and deterministic passes', () => {
  describe('LESSON_DUPLICATION_VARIATION_CREATIVE model config', () => {
    it('should have temperature 0.7', () => {
      const config = getModelRegistryEntry('LESSON_DUPLICATION_VARIATION_CREATIVE')
      expect(config.temperature).toBe(0.7)
    })

    it('should have thinkingBudget 4000', () => {
      const config = getModelRegistryEntry('LESSON_DUPLICATION_VARIATION_CREATIVE')
      expect(config.thinkingBudget).toBe(4000)
    })

    it('should have maxOutputTokens 8192', () => {
      const config = getModelRegistryEntry('LESSON_DUPLICATION_VARIATION_CREATIVE')
      expect(config.maxOutputTokens).toBe(8192)
    })
  })

  describe('LESSON_DUPLICATION_VARIATION_DETERMINISTIC model config', () => {
    it('should have temperature 0.0', () => {
      const config = getModelRegistryEntry('LESSON_DUPLICATION_VARIATION_DETERMINISTIC')
      expect(config.temperature).toBe(0.0)
    })

    it('should have thinkingBudget 6000', () => {
      const config = getModelRegistryEntry('LESSON_DUPLICATION_VARIATION_DETERMINISTIC')
      expect(config.thinkingBudget).toBe(6000)
    })

    it('should have maxOutputTokens 8192', () => {
      const config = getModelRegistryEntry('LESSON_DUPLICATION_VARIATION_DETERMINISTIC')
      expect(config.maxOutputTokens).toBe(8192)
    })
  })
})
