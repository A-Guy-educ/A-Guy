/**
 * AI Service Layer - Public API
 * Centralized exports for all AI functionality
 *
 * Future-ready: Easy to extend with new features like:
 * - Exercise chat assistant
 * - Exercise editing suggestions
 * - Content generation
 * - Auto-grading assistance
 */

export { getGeminiClient } from './gemini-ai-provider.server'
export { AI_MODELS, type AIModelKey, type AIModelConfig } from './models'
export { optimizeImageForAI, type OptimizedImage } from './services/image-optimizer-service'
export {
  generateExerciseFromImage,
  type ImageToExerciseInput,
  type ImageToExerciseResult,
  type ImageToExerciseResponse,
} from './services/exercise-generator'
export { IMAGE_TO_EXERCISE_PROMPT } from './prompts/simple-text-question'
