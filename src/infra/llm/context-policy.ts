/**
 * Context Policy Module
 * Deterministic prompt composition for AI chat
 *
 * Policy V1 Contract:
 * 1. System message (static)
 * 2. Conversation summary (if exists)
 * 3. Retrieved memory items (Top-K)
 * 4. Recent messages window (last N messages)
 *
 * CRITICAL: No ad-hoc insertions. No reordering. No message duplication.
 */

import type { MemoryItem } from './vector-search'

export const CONTEXT_POLICY_VERSION = 'v1'

// Memory block delimiters for testability
export const MEMORY_BLOCK_START = 'MEMORY_CONTEXT_START'
export const MEMORY_BLOCK_END = 'MEMORY_CONTEXT_END'

export const CONTEXT_POLICY_V1 = {
  recentWindowSize: 20,
  memoryTopK: 8,
  vectorCandidates: 200,
  summaryThreshold: 40,
  safetyThreshold: 80,
} as const

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string | Date
}

export interface ContextComponents {
  systemMessage: string
  summary?: string
  memoryItems: MemoryItem[]
  recentMessages: Message[]
}

export interface ComposedPrompt {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  metadata: {
    policyVersion: string
    summaryLength: number
    memoryCount: number
    messageCount: number
  }
}

/**
 * Compose a deterministic prompt following Context Policy V1
 *
 * Order (MUST be maintained):
 * 1. System message (static)
 * 2. Conversation summary (if exists)
 * 3. Retrieved memory items (Top-K)
 * 4. Recent messages window
 */
export function composePrompt(
  systemInstructions: string,
  components: ContextComponents,
): ComposedPrompt {
  const messages: ComposedPrompt['messages'] = []

  // 1. System message
  let systemContent = systemInstructions

  // 2. Append summary to system message (if exists)
  if (components.summary && components.summary.trim().length > 0) {
    systemContent += '\n\n## Conversation Summary\n' + components.summary
  }

  // 3. Append memory items to system message (if any)
  if (components.memoryItems.length > 0) {
    systemContent += '\n\n' + MEMORY_BLOCK_START + '\n'
    systemContent += '## Relevant Context from Past Conversations\n'

    // Sort by importance (descending) and limit text length
    const sortedMemories = [...components.memoryItems]
      .sort((a, b) => b.importance - a.importance)
      .map((item) => ({
        ...item,
        // Truncate long memories (keep first 400 chars + ellipsis)
        text: item.text.length > 400 ? item.text.substring(0, 400) + '...' : item.text,
      }))

    // Group by importance for better structure
    const highImportance = sortedMemories.filter((m) => m.importance >= 4)
    const mediumImportance = sortedMemories.filter((m) => m.importance === 3)
    const lowImportance = sortedMemories.filter((m) => m.importance <= 2)

    if (highImportance.length > 0) {
      systemContent += '\n### High Importance (Remember These)\n'
      systemContent += highImportance
        .map((item, idx) => {
          return `${idx + 1}. [${item.type}] ${item.text}`
        })
        .join('\n')
    }

    if (mediumImportance.length > 0) {
      systemContent += '\n### Medium Importance\n'
      systemContent += mediumImportance
        .map((item, idx) => {
          return `${idx + 1}. [${item.type}] ${item.text}`
        })
        .join('\n')
    }

    if (lowImportance.length > 0 && highImportance.length + mediumImportance.length < 5) {
      // Only include low importance if we don't have enough high/medium
      systemContent += '\n### Additional Context\n'
      systemContent += lowImportance
        .slice(0, 3) // Limit low-importance memories
        .map((item, idx) => {
          return `${idx + 1}. [${item.type}] ${item.text}`
        })
        .join('\n')
    }
    systemContent += '\n' + MEMORY_BLOCK_END
  }

  messages.push({
    role: 'system',
    content: systemContent,
  })

  // 4. Recent messages window
  for (const msg of components.recentMessages) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })
  }

  return {
    messages,
    metadata: {
      policyVersion: CONTEXT_POLICY_VERSION,
      summaryLength: components.summary?.length || 0,
      memoryCount: components.memoryItems.length,
      messageCount: components.recentMessages.length,
    },
  }
}

/**
 * Get the last N messages (recent window)
 */
export function getRecentWindow(
  messages: Message[],
  windowSize: number = CONTEXT_POLICY_V1.recentWindowSize,
): Message[] {
  return messages.slice(-windowSize)
}

/**
 * Get older messages that should be summarized
 */
export function getMessagesToSummarize(
  messages: Message[],
  windowSize: number = CONTEXT_POLICY_V1.recentWindowSize,
): Message[] {
  if (messages.length <= windowSize) {
    return []
  }
  return messages.slice(0, -windowSize)
}

/**
 * Build query text for vector retrieval
 * Uses the newest user message(s)
 */
export function buildRetrievalQuery(messages: Message[]): string {
  // Get last 3 user messages
  const userMessages = messages.filter((m) => m.role === 'user').slice(-3)

  if (userMessages.length === 0) {
    return ''
  }

  // Combine recent user messages for context-aware retrieval
  return userMessages.map((m) => m.content).join(' ')
}

/**
 * Check if summary maintenance is needed
 */
export function needsSummaryMaintenance(messageCount: number): boolean {
  return (
    messageCount > CONTEXT_POLICY_V1.summaryThreshold ||
    messageCount > CONTEXT_POLICY_V1.safetyThreshold
  )
}
