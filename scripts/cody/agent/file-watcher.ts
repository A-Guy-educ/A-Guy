/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern file-watcher
 * @ai-summary File watching and stability checking for agent output detection
 */

import * as fs from 'fs'
import * as path from 'path'
import ms from 'ms'

import { STABILITY_CHECK_INTERVAL, STABILITY_CHECK_COUNT } from './constants'

/**
 * Wait for a file to become stable (size doesn't change for N consecutive checks).
 * This handles filesystem flush delays after the agent process exits.
 *
 * @param filePath - Path to the file to check
 * @param options - Stability check configuration
 * @returns Promise that resolves when file is stable, or rejects on timeout/error
 */
export async function waitForFileStable(
  filePath: string,
  options: {
    interval?: number
    stableCount?: number
    timeout?: number
    onCheck?: (size: number, checkNumber: number) => void
  } = {},
): Promise<{ stable: boolean; finalSize: number }> {
  const {
    interval = STABILITY_CHECK_INTERVAL,
    stableCount = STABILITY_CHECK_COUNT,
    timeout = ms('30s'),
    onCheck,
  } = options

  const startTime = Date.now()
  let lastSize = 0
  let stableCheckCount = 0

  while (true) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      return { stable: false, finalSize: lastSize }
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      stableCheckCount = 0
      lastSize = 0
      await sleep(interval)
      continue
    }

    // Get current file size
    const stat = fs.statSync(filePath)
    const currentSize = stat.size

    if (onCheck) {
      onCheck(currentSize, stableCheckCount)
    }

    // Check if size is stable (skip first check - we need 2 consecutive stable checks)
    if (currentSize > 0 && currentSize === lastSize) {
      stableCheckCount++
      if (stableCheckCount >= stableCount) {
        return { stable: true, finalSize: currentSize }
      }
    } else {
      stableCheckCount = 0
    }

    lastSize = currentSize
    await sleep(interval)
  }
}

/**
 * Simple sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Find output file in directory (supports timestamped variants like spec-123456.md)
 */
export function findOutputFile(
  taskDir: string,
  expectedBase: string,
  outputExt: string,
): string | null {
  if (fs.existsSync(path.join(taskDir, expectedBase + outputExt))) {
    return path.join(taskDir, expectedBase + outputExt)
  }

  // Check for timestamped variants
  const files = fs.readdirSync(taskDir)
  const prefixMatch = files.find((f) => f.startsWith(expectedBase + '-') && f.endsWith(outputExt))
  return prefixMatch ? path.join(taskDir, prefixMatch) : null
}
