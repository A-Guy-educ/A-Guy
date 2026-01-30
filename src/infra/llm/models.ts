/**
 * Model configurations for different AI tasks
 * Centralized model selection and parameters
 *
 * Future-ready: Can add more models for chat, exercise editing, etc.
 */

export const AI_MODELS = {
  IMAGE_TO_EXERCISE: {
    name: 'gemini-2.0-flash-001', // Latest stable Gemini 2.0 with best multimodal capabilities
    temperature: 0.2, // Lower for more deterministic JSON output
    maxOutputTokens: 8192,
  },
  EXERCISE_CHAT: {
    name: 'gemini-2.0-flash-001', // Fast and conversational
    temperature: 0.7, // More natural responses
    maxOutputTokens: 2048,
  },
  PDF_TO_EXERCISE: {
    name: 'gemini-2.0-flash-001', // 'gemini-1.5-pro'
    temperature: 0.1, // Low for deterministic JSON output
    maxOutputTokens: 8192,
  },
} as const

export type AIModelKey = keyof typeof AI_MODELS
export type AIModelConfig = (typeof AI_MODELS)[AIModelKey]
