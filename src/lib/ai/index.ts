/**
 * AI Service Layer - Public API
 * Centralized exports for all AI functionality
 *
 * Future-ready: Easy to extend with new features like:
 * - Exercise editing suggestions
 * - Content generation
 * - Auto-grading assistance
 */

export { getGeminiClient, isGeminiApiKeyConfigured } from './gemini-ai-provider.server'
export { AI_MODELS, type AIModelKey, type AIModelConfig } from './models'
export { optimizeImageForAI, type OptimizedImage } from './services/image-optimizer-service'
export {
  extractFromImage,
  type ImageToExerciseInput,
  type ImageToExerciseResult,
  type ImageToExerciseResponse,
} from './services/data-extractor-service'
export {
  chatWithExerciseHelper,
  type ChatMessage,
  type ExerciseChatInput,
  type ExerciseChatResult,
} from './services/exercise-chat-service'
export { SIMPLE_TEXT_QUESTION_PROMPT } from './prompts/simple-text-question'
