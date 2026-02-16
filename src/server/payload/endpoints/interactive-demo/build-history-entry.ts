/**
 * Centralized History Entry Builder for Interactive Demo
 *
 * FIX #7: Enforces required fields so Payload array validation never rejects
 * FIX #10: Uses Date object for Payload date field compatibility
 */

import type { LessonSession } from '@/payload-types'

type HistoryRole = 'system' | 'user' | 'assistant'
type HistoryBlockType = 'content' | 'mcq' | 'open' | 'remediation'

interface BuildHistoryEntryParams {
  role: HistoryRole
  blockType: HistoryBlockType
  content: string
  metadata?: Record<string, unknown>
}

type HistoryEntry = NonNullable<LessonSession['history']>[number]

/**
 * Factory for history entries. Enforces all required fields so Payload
 * array validation never rejects a history append at runtime.
 */
export function buildHistoryEntry(params: BuildHistoryEntryParams): HistoryEntry {
  return {
    role: params.role,
    blockType: params.blockType,
    content: params.content,
    timestamp: new Date().toISOString(), // FIX #10: ISO string for Payload date field
    ...(params.metadata !== undefined && { metadata: params.metadata }),
  }
}
