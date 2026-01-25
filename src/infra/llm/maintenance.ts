/**
 * Summary Maintenance Service
 * Manages conversation compression and message trimming
 *
 * Key Features:
 * - Automatic triggering based on message count thresholds
 * - Preserves recent window for immediate context
 * - Updates summary incrementally
 * - Tracks summarization metadata
 */

import { logger } from '@/infra/utils/logger'
import type { Payload } from 'payload'
import type { Message } from './context-policy'
import { getMessagesToSummarize, getRecentWindow, needsSummaryMaintenance } from './context-policy'
import { generateSummary } from './summary'

export interface MaintenanceResult {
  summaryUpdated: boolean
  messagesTrimmed: number
  tokensUsed: number
}

/**
 * Run summary maintenance if needed
 *
 * Triggers:
 * - Normal: messages.length > 40
 * - Safety: messages.length > 80
 *
 * Process:
 * 1. Summarize all except last 20 messages
 * 2. Update summary field
 * 3. Trim messages to keep only last 20
 */
export async function runSummaryMaintenance(
  payload: Payload,
  conversationId: string,
): Promise<MaintenanceResult> {
  try {
    // Load conversation
    const conversation = await payload.findByID({
      collection: 'conversations',
      id: conversationId,
    })

    const messages = (conversation.messages || []) as unknown as Message[]
    const messageCount = messages.length

    // Check if maintenance is needed
    if (!needsSummaryMaintenance(messageCount)) {
      return {
        summaryUpdated: false,
        messagesTrimmed: 0,
        tokensUsed: 0,
      }
    }

    logger.info({ conversationId, messageCount }, '[Maintenance] Running summary maintenance')

    // Get messages to summarize (all except last 20)
    const messagesToSummarize = getMessagesToSummarize(messages)
    const recentWindow = getRecentWindow(messages)

    if (messagesToSummarize.length === 0) {
      logger.debug({ conversationId }, '[Maintenance] No messages to summarize, skipping')
      return {
        summaryUpdated: false,
        messagesTrimmed: 0,
        tokensUsed: 0,
      }
    }

    // Generate summary
    const { summary, summaryUntilTimestamp, tokensUsed } = await generateSummary(
      payload,
      conversation.summary || '',
      messagesToSummarize,
    )

    // Update conversation
    const updated = await payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        summary,
        summaryUpdatedAt: new Date().toISOString(),
        summaryUntilTimestamp: summaryUntilTimestamp.toISOString(),
        // Keep only recent window - cast needed because Message type may not exactly match Conversation messages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: recentWindow as any,
      },
      depth: 0, // Don't populate relationships
    })

    // Verify update succeeded
    if (!updated.summaryUpdatedAt) {
      logger.warn({ conversationId }, '[Maintenance] summaryUpdatedAt not set after update')
    }

    const messagesTrimmed = messages.length - recentWindow.length

    logger.info({ conversationId, messagesTrimmed, tokensUsed }, '[Maintenance] Summary updated')

    return {
      summaryUpdated: true,
      messagesTrimmed,
      tokensUsed,
    }
  } catch (error) {
    logger.error({ err: error, conversationId }, '[Maintenance] Summary maintenance failed')
    // Don't throw - maintenance failures shouldn't break the chat
    return {
      summaryUpdated: false,
      messagesTrimmed: 0,
      tokensUsed: 0,
    }
  }
}
