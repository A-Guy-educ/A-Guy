/**
 * State management for Nightly Docs Agent
 *
 * Tracks last successful run to enable delta-based processing.
 */

import fs from 'node:fs'
import path from 'node:path'

// ============================================================================
// Types
// ============================================================================

export interface State {
  lastCommit: string
  lastRun: string
  processedFiles: string[]
}

// ============================================================================
// State Operations
// ============================================================================

/**
 * Load state from file
 */
export function loadState(statePath: string): State | null {
  try {
    if (!fs.existsSync(statePath)) {
      return null
    }

    const content = fs.readFileSync(statePath, 'utf-8')
    const state = JSON.parse(content)

    // Validate state structure
    if (typeof state.lastCommit !== 'string' || typeof state.lastRun !== 'string') {
      console.warn('[WARN] Invalid state file format, ignoring')
      return null
    }

    return {
      lastCommit: state.lastCommit,
      lastRun: state.lastRun,
      processedFiles: state.processedFiles || [],
    }
  } catch (err) {
    console.warn(`[WARN] Failed to load state: ${err}`)
    return null
  }
}

/**
 * Save state to file
 */
export function saveState(statePath: string, state: State): void {
  // Ensure directory exists
  const dir = path.dirname(statePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8')
}

/**
 * Clear state file (for testing/reset)
 */
export function clearState(statePath: string): void {
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath)
  }
}
