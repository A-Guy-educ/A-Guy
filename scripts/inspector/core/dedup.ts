/**
 * @fileType utility
 * @domain inspector
 * @pattern dedup
 * @ai-summary Prevents duplicate actions within a time window
 */

import type { ActionRequest, InspectorContext } from './types'

const _DEFAULT_DEDUP_WINDOW_MS = 60 * 60 * 1000 // 60 minutes

/**
 * Check if an action should be deduplicated based on its dedupKey and execution history.
 */
export function shouldDedup(action: ActionRequest, ctx: InspectorContext): boolean {
  // No dedup key = always allow
  if (!action.dedupKey) {
    return false
  }

  const windowMs = (action.dedupWindowMinutes ?? 60) * 60 * 1000
  const dedupKey = `dedup:${action.plugin}:${action.dedupKey}`

  // Get all dedup entries for this plugin
  const dedupEntries = ctx.state.get<Record<string, string>>('cody:dedupEntries') || {}

  const lastExecuted = dedupEntries[dedupKey]
  if (!lastExecuted) {
    // No previous execution = not a duplicate
    return false
  }

  const lastTime = parseInt(lastExecuted, 10)
  if (Number.isNaN(lastTime)) {
    // Invalid timestamp = not a duplicate
    return false
  }

  const elapsed = Date.now() - lastTime

  // Within window = deduplicate
  return elapsed < windowMs
}

/**
 * Mark an action as executed in the state store.
 * Call this AFTER successful execution.
 */
export function markExecuted(action: ActionRequest, ctx: InspectorContext): void {
  if (!action.dedupKey) return

  const dedupKey = `dedup:${action.plugin}:${action.dedupKey}`
  const dedupEntries = ctx.state.get<Record<string, string>>('cody:dedupEntries') || {}

  dedupEntries[dedupKey] = String(Date.now())

  ctx.state.set('cody:dedupEntries', dedupEntries)
}

/**
 * Clean up expired dedup entries to prevent unbounded growth.
 * Should be called periodically (e.g., at the start of each inspector run).
 */
export function cleanupExpiredDedup(ctx: InspectorContext, maxAgeMs = 24 * 60 * 60 * 1000): number {
  const dedupEntries = ctx.state.get<Record<string, string>>('cody:dedupEntries') || {}
  const now = Date.now()
  let cleaned = 0

  const updated: Record<string, string> = {}

  for (const [key, timestamp] of Object.entries(dedupEntries)) {
    const time = parseInt(timestamp, 10)
    if (Number.isNaN(time)) {
      // Invalid entry, remove it
      cleaned++
      continue
    }

    if (now - time > maxAgeMs) {
      // Expired, remove it
      cleaned++
      continue
    }

    // Keep valid entries
    updated[key] = timestamp
  }

  ctx.state.set('cody:dedupEntries', updated)
  return cleaned
}
