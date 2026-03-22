/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern session-management
 * @ai-summary Session recovery and nudge logic for agent continuation
 */

import * as path from 'path'
import { execFileSync } from 'child_process'

import { logger } from '../logger'
import type { RunnerBackend } from '../runner-backend'
import { resolveOpenCodeBinary } from '../opencode-server'
import { NUDGE_TIMEOUT, POST_EXIT_DELAY } from './constants'
import { findOutputFile, sleep } from './file-watcher'

/**
 * Recover the latest session ID from OpenCode's database when JSON events
 * didn't include sessionID (e.g., some model providers omit it).
 * Uses `opencode session list` to query the local SQLite DB.
 */
export function recoverSessionId(dataDir?: string): string | undefined {
  if (!dataDir) return undefined

  try {
    const binary = resolveOpenCodeBinary()
    const output = execFileSync(binary, ['session', 'list', '--format', 'json', '-n', '1'], {
      encoding: 'utf-8',
      timeout: 10_000,
      env: { ...process.env, XDG_DATA_HOME: dataDir },
    })

    const sessions = JSON.parse(output)
    if (Array.isArray(sessions) && sessions.length > 0 && sessions[0].id) {
      logger.info(`  🔍 Recovered session ID from DB: ${sessions[0].id.slice(0, 16)}...`)
      return sessions[0].id
    }
  } catch (err) {
    logger.debug({ err }, 'Failed to recover session ID from OpenCode DB')
  }
  return undefined
}

/**
 * Nudge an agent session to write the missing output file.
 * When an agent exits 0 but forgets the output file, this sends a short
 * continuation message into the same session. Much cheaper than a full retry
 * since the agent still has all context loaded.
 *
 * Returns the detected output file path on success, or null on failure.
 */
export async function nudgeSession(
  backend: RunnerBackend,
  stage: string,
  outputFile: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
  serverUrl: string,
  sessionId: string,
  dataDir?: string,
): Promise<string | null> {
  const nudgePrompt = `CRITICAL: You exited without writing the required output file. Write it NOW to: ${outputFile}`

  logger.info(`  🔔 Nudging session ${sessionId.slice(0, 16)}... to write output file`)

  return new Promise((resolve) => {
    const nudgeChild = backend.spawn(stage, nudgePrompt, env, cwd, {
      serverUrl,
      sessionId,
      dataDir,
    })

    // Close stdin
    if (nudgeChild.stdin) nudgeChild.stdin.end()

    // Log nudge output for debugging
    if (nudgeChild.stdout) {
      nudgeChild.stdout.on('data', () => {
        // Silently consume — we only care about the file appearing
      })
    }
    if (nudgeChild.stderr) {
      nudgeChild.stderr.on('data', () => {
        // Silently consume
      })
    }

    // Timeout
    // R2-FIX #12: Use the smaller of NUDGE_TIMEOUT and remaining stage timeout.
    // Without this, a stuck nudge could cause the stage to exceed its overall timeout.
    const nudgeTimeoutMs = NUDGE_TIMEOUT * 1000
    const timer = setTimeout(() => {
      logger.info(`  🔔 Nudge timed out after ${NUDGE_TIMEOUT}s`)
      try {
        nudgeChild.kill()
      } catch {
        /* ignore */
      }
      resolve(null)
    }, nudgeTimeoutMs)

    nudgeChild.on('exit', async (nudgeCode) => {
      clearTimeout(timer)
      logger.info(`  🔔 Nudge process exited with code: ${nudgeCode}`)

      // Brief delay for filesystem flush
      await sleep(POST_EXIT_DELAY)

      // Check if the file appeared
      const outputExt = path.extname(outputFile)
      const expectedBase = path.basename(outputFile, outputExt)
      const taskDirForPoll = path.dirname(outputFile)
      const detected = findOutputFile(taskDirForPoll, expectedBase, outputExt)
      if (detected) {
        logger.info(`  🔔 ✅ Nudge succeeded — output file detected`)
        resolve(detected)
      } else {
        logger.info(`  🔔 ❌ Nudge failed — output file still missing`)
        resolve(null)
      }
    })
  })
}
