/**
 * Centralized Type Exports
 *
 * All commonly-used types are re-exported here for easy discovery.
 * Use these imports instead of deep imports from individual files.
 *
 * @fileType utility
 * @domain general
 * @pattern type-exports
 * @ai-summary Centralized type exports for easy discovery by AI agents
 */

// ============================================================================
// Payload Types (Auto-generated)
// ============================================================================

export type {
  Category,
  Chapter,
  Config,
  Conversation,
  Course,
  Exercise,
  ExerciseAsset,
  Form,
  FormSubmission,
  Lesson,
  Media,
  MemoryItem,
  Page,
  Post,
  PricingPlan,
  Redirect,
  Search,
  User,
} from '@/payload-types'

// ============================================================================
// Payload Config Types
// ============================================================================

export type { Access, CollectionConfig, Field, GlobalConfig } from 'payload'

// ============================================================================
// AI Types
// ============================================================================

export type { AIContext, DocTier, LoadedDocs } from '@/infra/llm/smart-doc-loader'

export type { MemoryItem as MemoryItemSearch, RetrievalResult } from '@/infra/llm/vector-search'

export type { ComposedPrompt, ContextComponents, Message } from '@/infra/llm/context-policy'

export type {
  ChatMessage,
  ExerciseChatInput,
  ExerciseChatResult,
} from '@/infra/llm/services/exercise-chat-service'

export type { EmbeddingResult } from '@/infra/llm/embeddings'

export type { SummaryResult } from '@/infra/llm/summary'

export type { ContextLog } from '@/infra/llm/observability'

export type { AIModelConfig, AIModelKey } from '@/infra/llm/models'

// ============================================================================
// Contract Types
// ============================================================================

export type { BlockId, ColorString, LineStyle, PositionEnum } from '@/infra/contracts/primitives'

export type { ContentBlock, ExerciseContent } from '@/server/payload/collections/Exercises/schemas'

// Re-export from Exercises collection index for convenience
export type {
  ContentBlockSchema,
  ContentSchema,
  QuestionFreeResponseBlockSchema,
} from '@/server/payload/collections/Exercises/index'

// ============================================================================
// Access Control Types
// ============================================================================

export type { Access as AccessFunction } from 'payload'

// ============================================================================
// Utility Types
// ============================================================================

// Re-export commonly used utility types
export type { PayloadRequest } from 'payload'
