/**
 * Observability & Logging for Chat Context System
 *
 * Provides structured logging for:
 * - Context usage per model call
 * - Feature flag status
 * - Performance metrics
 * - Debug snapshots (dev only)
 */

import { logger } from '@/infra/utils/logger'
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
    contextCount: number
    parentCount: number
    globalCount: number
    totalCount: number
    retrievalLatencyMs: number
    hierarchyKeys: string[]
  }
  messages: {
    windowSize: number
    totalCount: number
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
  memoryContextCount: number
  memoryGlobalCount: number
  memoryRetrievalLatencyMs: number
  messageWindowSize: number
  messageTotalCount: number
  modelLatencyMs?: number
  hierarchyKeys?: string[]
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
      contextCount: params.memoryContextCount,
      parentCount: params.memoryContextCount - params.memoryLocalCount,
      globalCount: params.memoryGlobalCount,
      totalCount: params.memoryLocalCount + params.memoryContextCount + params.memoryGlobalCount,
      retrievalLatencyMs: params.memoryRetrievalLatencyMs,
      hierarchyKeys: params.hierarchyKeys || [],
    },
    messages: {
      windowSize: params.messageWindowSize,
      totalCount: params.messageTotalCount,
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
