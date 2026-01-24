/**
 * Delta computation for Nightly Docs Agent
 *
 * Computes the set of changed files since last run.
 */

import { execSync } from 'node:child_process'
import type { State } from './state'

// ============================================================================
// Types
// ============================================================================

export interface FileChange {
  path: string
  status: 'add' | 'modify' | 'delete' | 'rename'
  oldPath?: string
}

export interface Delta {
  files: FileChange[]
  baseCommit: string
  headCommit: string
}

// ============================================================================
// Git Commands
// ============================================================================

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string }
    throw new Error(`Git command failed: ${cmd}\n${error.stderr || error.message}`)
  }
}

function getCurrentCommit(): string {
  return exec('git rev-parse HEAD')
}

function getDiffNameStatus(baseCommit: string, headCommit: string): string {
  return exec(`git diff --name-status ${baseCommit}..${headCommit}`)
}

function getLogNameStatus(since: string): string {
  return exec(`git log --since="${since}" --name-status --format=""`)
}

// ============================================================================
// Delta Computation
// ============================================================================

/**
 * Parse git diff/log name-status output
 */
function parseNameStatus(output: string): FileChange[] {
  const changes: FileChange[] = []
  const seen = new Set<string>()

  for (const line of output.split('\n')) {
    if (!line.trim()) continue

    const parts = line.split('\t')
    if (parts.length < 2) continue

    const statusCode = parts[0]
    const filePath = parts[parts.length - 1]

    // Skip duplicates (can happen with log output)
    if (seen.has(filePath)) continue
    seen.add(filePath)

    let status: FileChange['status']
    let oldPath: string | undefined

    if (statusCode === 'A') {
      status = 'add'
    } else if (statusCode === 'M') {
      status = 'modify'
    } else if (statusCode === 'D') {
      status = 'delete'
    } else if (statusCode.startsWith('R')) {
      status = 'rename'
      oldPath = parts[1]
    } else {
      // Unknown status, treat as modify
      status = 'modify'
    }

    changes.push({ path: filePath, status, oldPath })
  }

  return changes
}

/**
 * Compute delta since last run or fallback period
 */
export function computeDelta(state: State | null, sinceArg?: string, fallbackHours = 24): Delta {
  const headCommit = getCurrentCommit()

  // Priority 1: Use CLI --since argument
  if (sinceArg) {
    const output = getLogNameStatus(sinceArg)
    return {
      files: parseNameStatus(output),
      baseCommit: `since:${sinceArg}`,
      headCommit,
    }
  }

  // Priority 2: Use state file
  if (state?.lastCommit) {
    try {
      // Verify the commit still exists
      exec(`git rev-parse ${state.lastCommit}`)

      const output = getDiffNameStatus(state.lastCommit, headCommit)
      return {
        files: parseNameStatus(output),
        baseCommit: state.lastCommit,
        headCommit,
      }
    } catch {
      // Commit not found (maybe history was rewritten), fall through to fallback
      console.warn(`[WARN] State commit ${state.lastCommit} not found, using fallback`)
    }
  }

  // Priority 3: Fallback to time-based lookback
  const since = `${fallbackHours} hours ago`
  const output = getLogNameStatus(since)
  return {
    files: parseNameStatus(output),
    baseCommit: `since:${since}`,
    headCommit,
  }
}

/**
 * Get the content diff for a specific file
 * Used to check content patterns for modify events
 */
export function getFileDiff(filePath: string, baseCommit: string): string {
  if (baseCommit.startsWith('since:')) {
    // For time-based delta, get the last commit's diff
    try {
      return exec(`git diff HEAD~1 -- "${filePath}"`)
    } catch {
      return ''
    }
  }

  try {
    return exec(`git diff ${baseCommit}..HEAD -- "${filePath}"`)
  } catch {
    return ''
  }
}
