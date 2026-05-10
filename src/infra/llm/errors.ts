/**
 * LLM Service Errors
 *
 * Custom error types for LLM service operations.
 */

export class VariationGenerationError extends Error {
  constructor(
    public readonly exerciseId: string,
    public readonly reason: string,
  ) {
    super(`Variation generation failed for exercise ${exerciseId}: ${reason}`)
    this.name = 'VariationGenerationError'
    if (Error.captureStackTrace) Error.captureStackTrace(this, VariationGenerationError)
  }
}
