/**
 * Observability & Logging for Chat Context System
 *
 * Provides structured logging for:
 * - Context usage per model call
 * - Feature flag status
 * - Performance metrics
 * - Debug snapshots (dev only)
 */

import { logger } from '@/utilities/logger'
import type { ComposedPrompt } from './context-policy'

export interface ContextLog {
  timestamp: string
  conversationId: string
  userId: string
  policyVersion: string
  summary: {
    present: boolean
    length: number
  }
  memory: {
    localCount: number
    globalCount: number
    totalCount: number
    retrievalLatencyMs: number
  }
  messages: {
    windowSize: number
    totalCount: number
  }
  // Feature flags removed - all features always enabled
  featuresEnabled: {
    summaryMaintenance: boolean
    memoryExtraction: boolean
    memoryRetrieval: boolean
  }
  modelLatencyMs?: number
}

/**
 * Log context usage for a model call
 * Use for monitoring and debugging
 */
export function logContextUsage(log: ContextLog): void {
  logger.info(log, '[Context Usage]')
}

/**
 * Log prompt snapshot (development only)
 * Useful for debugging prompt composition
 */
export function logPromptSnapshot(conversationId: string, prompt: ComposedPrompt): void {
  // Only in development
  if (process.env.NODE_ENV !== 'development') return

  logger.debug(
    {
      conversationId,
      systemMessageLength: prompt.messages[0]?.content.length,
      totalMessages: prompt.messages.length,
      metadata: prompt.metadata,
    },
    '[Prompt Snapshot]',
  )
}

/**
 * Create a context log entry
 * Helper to standardize log creation
 */
export function createContextLog(params: {
  conversationId: string
  userId: string
  policyVersion: string
  summaryPresent: boolean
  summaryLength: number
  memoryLocalCount: number
  memoryGlobalCount: number
  memoryRetrievalLatencyMs: number
  messageWindowSize: number
  messageTotalCount: number
  modelLatencyMs?: number
}): ContextLog {
  return {
    timestamp: new Date().toISOString(),
    conversationId: params.conversationId,
    userId: params.userId,
    policyVersion: params.policyVersion,
    summary: {
      present: params.summaryPresent,
      length: params.summaryLength,
    },
    memory: {
      localCount: params.memoryLocalCount,
      globalCount: params.memoryGlobalCount,
      totalCount: params.memoryLocalCount + params.memoryGlobalCount,
      retrievalLatencyMs: params.memoryRetrievalLatencyMs,
    },
    messages: {
      windowSize: params.messageWindowSize,
      totalCount: params.messageTotalCount,
    },
    featuresEnabled: {
      summaryMaintenance: true,
      memoryExtraction: true,
      memoryRetrieval: true,
      documentMemory: true,
    },
    modelLatencyMs: params.modelLatencyMs,
  }
}

/**
 * Log maintenance operation
 */
export function logMaintenance(params: {
  conversationId: string
  operation: 'summary' | 'extraction'
  success: boolean
  messageCount?: number
  messagesTrimmed?: number
  memoryItemsCreated?: number
  tokensUsed?: number
  error?: string
}): void {
  const level = params.success ? 'info' : 'error'
  logger[level](
    {
      timestamp: new Date().toISOString(),
      ...params,
    },
    '[Maintenance]',
  )
}
