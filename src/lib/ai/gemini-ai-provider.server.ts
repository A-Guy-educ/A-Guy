/**
 * Centralized Gemini AI client initialization
 * Single source of truth for API key and client config
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
 * Get Gemini client instance
 * @throws Error if GEMINI_API_KEY is not configured
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY environment variable is not configured. Please set it in your .env file. See .env.example for details.',
      )
    }
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return geminiClient
}
