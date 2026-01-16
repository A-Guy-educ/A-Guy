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
  User,
  Course,
  Chapter,
  Lesson,
  Exercise,
  ExerciseAsset,
  Conversation,
  MemoryItem,
  Page,
  Post,
  Category,
  Media,
  PricingPlan,
  Form,
  FormSubmission,
  Redirect,
  Search,
  Config,
} from '@/payload-types'

// ============================================================================
// Payload Config Types
// ============================================================================

export type { CollectionConfig, GlobalConfig, Field, Access } from 'payload'

// ============================================================================
// AI Types
// ============================================================================

export type { AIContext, LoadedDocs, DocTier } from '@/lib/ai/smart-doc-loader'

export type { MemoryItem as MemoryItemSearch, RetrievalResult } from '@/lib/ai/vector-search'

export type { Message, ContextComponents, ComposedPrompt } from '@/lib/ai/context-policy'

export type {
  ChatMessage,
  ExerciseChatInput,
  ExerciseChatResult,
} from '@/lib/ai/services/exercise-chat-service'

export type { EmbeddingResult } from '@/lib/ai/embeddings'

export type { SummaryResult } from '@/lib/ai/summary'

export type { ContextLog } from '@/lib/ai/observability'

export type { AIModelKey, AIModelConfig } from '@/lib/ai/models'

// ============================================================================
// Component Types
// ============================================================================

export type { Theme, ThemeContextType } from '@/providers/Theme/types'

// ============================================================================
// Contract Types
// ============================================================================

export type { BlockId, ColorString, PositionEnum, LineStyle } from '@/contracts/primitives'

export type { ContentBlock, ExerciseContent } from '@/collections/Exercises/schemas'

// Re-export from Exercises collection index for convenience
export type {
  ContentBlockSchema,
  ContentSchema,
  QuestionFreeResponseBlockSchema,
} from '@/collections/Exercises/index'

// ============================================================================
// API Service Types
// ============================================================================

export type {
  ChatApiResponse,
  ConversationApiResponse,
  ConversationMessage,
} from '@/services/api/api-service'

// ============================================================================
// Access Control Types
// ============================================================================

export type { Access as AccessFunction } from 'payload'

// ============================================================================
// Utility Types
// ============================================================================

// Re-export commonly used utility types
export type { PayloadRequest } from 'payload'
