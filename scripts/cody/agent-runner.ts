/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern agent-runner
 * @ai-summary Agent execution with file watching, timeouts, and retry logic for Cody pipeline stages
 */

import type { ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import type { CodyInput } from './cody-utils'
import { buildStagePrompt } from './stage-prompts'
import { createRunner, type RunnerBackend } from './runner-backend'

// ============================================================================
// Configuration
// ============================================================================

/** Check for output file every 3 seconds */
export const FILE_POLL_INTERVAL = 3_000

/** Number of consecutive stable size checks before settling (file detection stabilization) */
export const FILE_STABLE_CHECKS = 2

/** Maximum retry attempts for failed stages */
export const MAX_RETRIES = 2

/** Default timeout for stages (10 minutes) */
export const DEFAULT_TIMEOUT = 10 * 60_000

/** Stage-specific timeouts in milliseconds */
export const STAGE_TIMEOUTS: Record<string, number> = {
  architect: 30 * 60_000,
  build: 45 * 60_000,
  gap: 15 * 60_000,
  'plan-review': 10 * 60_000,
  verify: 10 * 60_000,
  auditor: 5 * 60_000,
  'apply-audit': 5 * 60_000,
  pr: 5 * 60_000,
}

// ============================================================================
// Types
// ============================================================================

export interface AgentRunnerOptions {
  /** Custom stage timeouts (merges with defaults) */
  stageTimeouts?: Record<string, number>
  /** Custom default timeout */
  defaultTimeout?: number
  /** Maximum retry attempts (0 = no retries) */
  maxRetries?: number
  /** Additional environment variables */
  env?: NodeJS.ProcessEnv
  /** Working directory */
  cwd?: string
  /** Runner backend (defaults to auto-detect from GITHUB_ACTIONS env) */
  backend?: RunnerBackend
}

export interface AgentRunResult {
  succeeded: boolean
  timedOut: boolean
  retries: number
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Run an OpenCode agent with file watching, timeouts, and optional retry logic.
 *
 * This function spawns the `opencode github run` command and monitors for the
 * output file. It handles:
 * - Polling for output file existence
 * - Timeout enforcement
 * - Retry on failure (configurable)
 * - Process cleanup on completion
 *
 * @param input - Orchestrator input with taskId
 * @param stage - The stage to run (e.g., 'build', 'test')
 * @param outputFile - Expected output file path
 * @param timeout - Timeout in milliseconds (defaults to stage-specific or 10min)
 * @param options - Optional configuration
 * @returns Promise resolving to success/timedOut/retries
 */
export function runAgentWithFileWatch(
  input: CodyInput,
  stage: string,
  outputFile: string,
  timeout?: number,
  options: AgentRunnerOptions = {},
): Promise<AgentRunResult> {
  const {
    maxRetries = MAX_RETRIES,
    env: extraEnv = {},
    cwd = process.cwd(),
    backend = createRunner(),
  } = options

  // Resolve timeout
  const effectiveTimeout = timeout ?? STAGE_TIMEOUTS[stage] ?? DEFAULT_TIMEOUT

  return new Promise((resolve) => {
    // Build environment for the agent
    const agentEnv = {
      ...process.env,
      ...extraEnv,
      // Skip Next.js build in pre-push hook — CI uses scripted verify (no build)
      SKIP_BUILD: '1',
      // Skip husky hooks for all pipeline stages - the pipeline runs its own quality gates
      // before committing, so pre-commit hooks would be redundant and could cause issues
      SKIP_HOOKS: '1',
    }

    // Build the prompt for the stage
    const prompt = buildStagePrompt(input, stage)

    let retries = 0
    let currentChild: ChildProcess | null = null
    const startTime = Date.now()

    const attemptWithRetry = (): void => {
      console.log(`  Attempt ${retries + 1}/${maxRetries + 1}`)

      // Calculate remaining timeout (subtract elapsed time from previous attempts)
      const elapsed = Date.now() - startTime
      const remainingTimeout = effectiveTimeout - elapsed
      if (remainingTimeout <= 0) {
        resolve({ succeeded: false, timedOut: true, retries })
        return
      }

      // Spawn using the configured backend (local or GitHub)
      currentChild = backend.spawn(stage, prompt, agentEnv, cwd)

      let resolved = false
      let settling = false
      let pollTimer: NodeJS.Timeout | null = null
      let timeoutTimer: NodeJS.Timeout | null = null

      const finish = (result: { succeeded: boolean; timedOut: boolean }) => {
        if (resolved) return
        resolved = true

        if (pollTimer) clearInterval(pollTimer)
        if (timeoutTimer) clearTimeout(timeoutTimer)

        // Kill process if still running
        if (currentChild && !currentChild.killed) {
          currentChild.kill('SIGTERM')
          setTimeout(() => {
            if (currentChild && !currentChild.killed) currentChild.kill('SIGKILL')
          }, 5000)
        }

        resolve({ ...result, retries })
      }

      // Poll for output file
      const expectedBase = path.basename(outputFile, '.md')
      const taskDirForPoll = path.dirname(outputFile)
      let stableCheckCount = 0
      let lastFileSize = 0

      pollTimer = setInterval(() => {
        if (settling) return

        try {
          let detectedFile = outputFile

          // Check exact match first
          if (!fs.existsSync(outputFile)) {
            // Check for prefix match (timestamped variant)
            const files = fs.readdirSync(taskDirForPoll)
            const prefixMatch = files.find(
              (f) => f.startsWith(expectedBase + '-') && f.endsWith('.md'),
            )
            if (prefixMatch) {
              detectedFile = path.join(taskDirForPoll, prefixMatch)
            } else {
              // Reset stable checks if file doesn't exist
              stableCheckCount = 0
              lastFileSize = 0
              return
            }
          }

          const stat = fs.statSync(detectedFile)

          // Check if file size is stable (hasn't changed since last check)
          if (stat.size > 10 && stat.size === lastFileSize) {
            stableCheckCount++
            if (stableCheckCount >= FILE_STABLE_CHECKS) {
              settling = true

              // Rename if timestamped
              if (detectedFile !== outputFile) {
                console.log(
                  `  📄 Output: ${path.basename(detectedFile)} → ${path.basename(outputFile)}`,
                )
                fs.renameSync(detectedFile, outputFile)
              }

              finish({ succeeded: true, timedOut: false })
              return
            }
          } else {
            // File is still being written, reset stable count
            stableCheckCount = 0
          }

          lastFileSize = stat.size
        } catch {
          // Ignore stat errors
          stableCheckCount = 0
          lastFileSize = 0
        }
      }, FILE_POLL_INTERVAL)

      // Timeout (uses remaining time to prevent accumulation across retries)
      timeoutTimer = setTimeout(() => {
        finish({ succeeded: false, timedOut: true })
      }, remainingTimeout)

      // Process exit with retry logic
      currentChild.on('exit', (code) => {
        if (!resolved) {
          // Success only if file was created (not just exit code 0)
          if (fs.existsSync(outputFile)) {
            finish({ succeeded: true, timedOut: false })
          } else if (retries < maxRetries) {
            // Retry on ANY failure — exit non-zero OR exit 0 without output file
            retries++
            const reason = code === 0 ? 'no output file' : `exit ${code}`
            console.log(`  ⚠ Stage failed (${reason}), retrying (${retries}/${maxRetries})...`)
            if (pollTimer) clearInterval(pollTimer)
            if (timeoutTimer) clearTimeout(timeoutTimer)
            if (currentChild && !currentChild.killed) {
              currentChild.kill('SIGTERM')
            }
            // Brief delay before retry
            setTimeout(attemptWithRetry, 2000)
          } else {
            // Exhausted retries without producing output file
            console.log(`  ❌ Agent exited ${code} without producing output file`)
            finish({ succeeded: false, timedOut: false })
          }
        }
      })

      // Handle spawn errors (e.g., command not found)
      currentChild.on('error', (err) => {
        if (resolved) return
        const error = err as NodeJS.ErrnoException
        if (error.code === 'ENOENT') {
          console.error(`  ❌ Command not found: ${error.path || 'opencode'}. Is it installed?`)
          console.error('  Install with: npm install -g opencode')
        } else {
          console.error(`  ❌ Agent process error: ${err.message}`)
        }
        finish({ succeeded: false, timedOut: false })
      })
    }

    // Start first attempt
    attemptWithRetry()
  })
}

/**
 * Simple agent runner without retries (for use with external retry logic)
 */
export function runAgentOnce(
  input: CodyInput,
  stage: string,
  outputFile: string,
  timeout?: number,
  options: Omit<AgentRunnerOptions, 'maxRetries'> = {},
): Promise<AgentRunResult> {
  return runAgentWithFileWatch(input, stage, outputFile, timeout, {
    ...options,
    maxRetries: 0,
  })
}
