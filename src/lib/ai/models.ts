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
  // Future models can be added here:
  // EXERCISE_CHAT: { ... }
  // EXERCISE_EDITOR: { ... }
  // TEXT_TO_EXERCISE: { ... }
} as const

export type AIModelKey = keyof typeof AI_MODELS
export type AIModelConfig = (typeof AI_MODELS)[AIModelKey]
