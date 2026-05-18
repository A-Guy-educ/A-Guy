/**
 * AI Pricing Module (issue #1552)
 *
 * @fileType utility
 * @domain ai
 * @pattern pricing, cost-tracking
 * @ai-summary Centralized price table for LLM providers. Prices are in USD per 1,000,000 tokens.
 */
import { getDisplayModelName } from './genkit/config-resolver'

// ── Price table ──────────────────────────────────────────────────────────────
// Gemini 3.1 Pro: input $1.25/1M, output $5.00/1M (current market rate)
// MiniMax-M2.1: input $0.20/1M, output $0.40/1M (openai-compatible fallback)
export const MODEL_PRICING_USD_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  'gemini-3.1-pro': { input: 1.25, output: 5.0 },
  'MiniMax-M2.1': { input: 0.2, output: 0.4 },
} as const

export class UnknownModelPricingError extends Error {
  constructor(public readonly modelName: string) {
    super(`No pricing entry found for model: ${modelName}`)
    this.name = 'UnknownModelPricingError'
  }
}

/**
 * Calculate the USD cost for a given model and token counts.
 *
 * @param modelName - Provider-specific model name (e.g. 'gemini-3.1-pro', 'MiniMax-M2.1')
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns USD cost rounded to 10 decimal places
 * @throws UnknownModelPricingError if the model is not in MODEL_PRICING_USD_PER_1M_TOKENS
 */
export function getModelCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const normalizedKey = getDisplayModelName(modelName)
  const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[normalizedKey]

  if (!pricing) {
    throw new UnknownModelPricingError(modelName)
  }

  if (inputTokens === 0 && outputTokens === 0) {
    return 0
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return Number((inputCost + outputCost).toFixed(10))
}
