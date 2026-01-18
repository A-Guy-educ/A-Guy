/**
 * Gemini Client Module
 * Handles SDK initialization, singleton caching, and environment config
 *
 * @internal This module is used by gemini.provider.ts only
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

let geminiClient: GoogleGenerativeAI | null = null

/**
 * Check if Gemini API key is configured
 */
export function isGeminiApiKeyConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

/**
 * Get or create Gemini client singleton
 * @throws GeminiConfigError if API key not configured
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.')
    }
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return geminiClient
}

/**
 * Reset client singleton (for testing)
 * @internal
 */
export function resetGeminiClient(): void {
  geminiClient = null
}
