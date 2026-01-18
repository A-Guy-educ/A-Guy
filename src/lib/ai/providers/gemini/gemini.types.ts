/**
 * Internal types for Gemini provider
 * These are NOT exported from the provider - internal only
 */

/** Gemini SDK role format */
export type GeminiRole = 'user' | 'model'

/** Gemini history item format (SDK contract) */
export interface GeminiHistoryItem {
  role: GeminiRole
  parts: Array<{ text: string }>
}

/** Model configuration from AI_MODELS */
export interface GeminiModelConfig {
  name: string
  temperature: number
  maxOutputTokens: number
}
