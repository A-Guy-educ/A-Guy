/**
 * Feature Flags for Chat Context System
 *
 * Rollout order:
 * 1. SUMMARY_MAINTENANCE_ENABLED - Compress old messages into summaries
 * 2. MEMORY_EXTRACTION_ENABLED - Extract and store memory items
 * 3. MEMORY_RETRIEVAL_ENABLED - Retrieve memory items for context
 *
 * All flags default to OFF for safe deployment
 */

export const featureFlags = {
  /**
   * Enable automatic conversation summary maintenance
   * - Triggers when messages.length > 40 (normal)
   * - Triggers when messages.length > 80 (safety)
   * - Compresses older messages into summary field
   * - Trims messages to keep only last 20
   */
  SUMMARY_MAINTENANCE_ENABLED: process.env.SUMMARY_MAINTENANCE_ENABLED === 'true',

  /**
   * Enable memory extraction from conversations
   * - Extracts important facts, preferences, decisions
   * - Creates memory_items for long-term recall
   * - Runs after model reply (non-blocking)
   */
  MEMORY_EXTRACTION_ENABLED: process.env.MEMORY_EXTRACTION_ENABLED === 'true',

  /**
   * Enable memory retrieval for context building
   * - Queries MongoDB Atlas vector search
   * - Retrieves relevant memory items per user
   * - Injects into prompt before model call
   */
  MEMORY_RETRIEVAL_ENABLED: process.env.MEMORY_RETRIEVAL_ENABLED === 'true',
} as const

export type FeatureFlags = typeof featureFlags

/**
 * Log current feature flag status
 * Useful for debugging and deployment verification
 */
export function logFeatureFlags(): void {
  console.log('[Feature Flags] Chat Context System:', {
    summaryMaintenance: featureFlags.SUMMARY_MAINTENANCE_ENABLED,
    memoryExtraction: featureFlags.MEMORY_EXTRACTION_ENABLED,
    memoryRetrieval: featureFlags.MEMORY_RETRIEVAL_ENABLED,
  })
}

/**
 * Get feature flag status object
 * For logging and observability
 */
export function getFeatureFlagStatus(): {
  summaryMaintenance: boolean
  memoryExtraction: boolean
  memoryRetrieval: boolean
} {
  return {
    summaryMaintenance: featureFlags.SUMMARY_MAINTENANCE_ENABLED,
    memoryExtraction: featureFlags.MEMORY_EXTRACTION_ENABLED,
    memoryRetrieval: featureFlags.MEMORY_RETRIEVAL_ENABLED,
  }
}
