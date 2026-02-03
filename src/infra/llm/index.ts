/**
 * AI Service Layer - Public API
 * Centralized exports for all AI functionality
 *
 * Future-ready: Easy to extend with new features like:
 * - Exercise editing suggestions
 * - Content generation
 * - Auto-grading assistance
 */

// Provider exports (new location)
export {
  GeminiError,
  GeminiErrorCode,
  generateChatCompletion,
  isGeminiApiKeyConfigured,
  type GenerateChatInput,
  type GenerateChatOutput,
  type ChatMessage as ProviderChatMessage,
} from './providers/gemini'

// Provider factory for runtime provider switching
export {
  checkProviderAvailability,
  detectBestProvider,
  getLLMProvider,
  getProviderModelConfig,
  LLMProviderType,
  type LLMProviderConfig,
  type UnifiedLLMProvider,
} from './providers/factory'

// Model config - centralized from models.ts
export {
  AI_MODELS,
  getModelNameOverride,
  getModelRegistryEntry,
  getModelsWithCapability,
  getProviderModelName,
  isModelOverrideConfigured,
  MODEL_REGISTRY,
  modelSupportsCapability,
  PROVIDER_MODEL_NAMES,
  type AIModel,
  type AIModelConfig,
  type AIModelKey,
} from './models'

// Image services
export {
  extractFromImage,
  type ImageToExerciseInput,
  type ImageToExerciseResponse,
  type ImageToExerciseResult,
} from './services/data-extractor-service'
export { optimizeImageForAI, type OptimizedImage } from './services/image-optimizer-service'

// Chat service (uses provider internally)
export {
  chatWithExerciseHelper,
  type ChatMessage,
  type ExerciseChatInput,
  type ExerciseChatResult,
} from './services/exercise-chat-service'

// Prompts
export { SIMPLE_TEXT_QUESTION_PROMPT } from './prompts/simple-text-question'
