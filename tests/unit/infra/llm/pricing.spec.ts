/**
 * Unit tests for AI pricing module (issue #1552).
 *
 * The pricing module should:
 * 1. Export MODEL_PRICING_USD_PER_1M_TOKENS with Gemini 3.1 Pro and MiniMax-M2.1 entries
 * 2. Export getModelCost function that calculates cost correctly
 * 3. Throw a typed error for unknown models
 *
 * This test currently FAILS because the pricing module does not exist.
 */
import { describe, expect, it } from 'vitest'

describe('AI Pricing Module (issue #1552)', () => {
  describe('MODEL_PRICING_USD_PER_1M_TOKENS', () => {
    it('exports MODEL_PRICING_USD_PER_1M_TOKENS object', async () => {
      const { MODEL_PRICING_USD_PER_1M_TOKENS } = await import('@/infra/llm/pricing')
      expect(MODEL_PRICING_USD_PER_1M_TOKENS).toBeDefined()
      expect(typeof MODEL_PRICING_USD_PER_1M_TOKENS).toBe('object')
    })

    it('has Gemini 3.1 Pro pricing entry', async () => {
      const { MODEL_PRICING_USD_PER_1M_TOKENS } = await import('@/infra/llm/pricing')

      // Find a key that includes "gemini" and "pro" (case insensitive)
      const geminiKey = Object.keys(MODEL_PRICING_USD_PER_1M_TOKENS).find(
        (k) => k.toLowerCase().includes('gemini') && k.toLowerCase().includes('pro'),
      )

      expect(geminiKey).toBeDefined()
      const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[geminiKey!]
      expect(pricing.input).toBeGreaterThan(0)
      expect(pricing.output).toBeGreaterThan(0)
    })

    it('has MiniMax-M2.1 pricing entry', async () => {
      const { MODEL_PRICING_USD_PER_1M_TOKENS } = await import('@/infra/llm/pricing')

      // Find a key that includes "minimax" (case insensitive)
      const minimaxKey = Object.keys(MODEL_PRICING_USD_PER_1M_TOKENS).find((k) =>
        k.toLowerCase().includes('minimax'),
      )

      expect(minimaxKey).toBeDefined()
      const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[minimaxKey!]
      expect(pricing.input).toBeGreaterThan(0)
      expect(pricing.output).toBeGreaterThan(0)
    })
  })

  describe('getModelCost', () => {
    it('calculates cost correctly for known model', async () => {
      const { getModelCost, MODEL_PRICING_USD_PER_1M_TOKENS } = await import('@/infra/llm/pricing')

      // Get the first available model key
      const modelKey = Object.keys(MODEL_PRICING_USD_PER_1M_TOKENS)[0]
      const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[modelKey]

      // Calculate 1000 input tokens and 500 output tokens
      const expectedCost = (1000 / 1_000_000) * pricing.input + (500 / 1_000_000) * pricing.output
      const actualCost = getModelCost(modelKey, 1000, 500)

      expect(actualCost).toBeCloseTo(expectedCost, 10)
    })

    it('returns 0 for zero tokens', async () => {
      const { getModelCost } = await import('@/infra/llm/pricing')

      const modelKey = 'gemini-3.1-pro' // Assumed to exist
      const cost = getModelCost(modelKey, 0, 0)

      expect(cost).toBe(0)
    })

    it('throws for unknown model', async () => {
      const { getModelCost } = await import('@/infra/llm/pricing')

      expect(() => getModelCost('definitely-not-a-real-model-name-xyz', 100, 100)).toThrow()
    })

    it('throws a descriptive error for unknown model', async () => {
      const { getModelCost } = await import('@/infra/llm/pricing')

      const unknownModel = 'unknown-model-123'
      try {
        getModelCost(unknownModel, 100, 100)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain(unknownModel)
      }
    })
  })
})
