/**
 * @fileType utility
 * @domain ci | pipeline | agent-execution
 * @pattern agent-runner
 * @ai-summary Agent execution with file watching, timeouts, and retry logic for pipeline stages
 */

import { spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import type { OrchestratorInput } from './orchestrator-utils'
import { buildStagePrompt, SPEC_STAGES } from './stage-prompts'

// ============================================================================
// Configuration
// ============================================================================

/** Check for output file every 3 seconds */
export const FILE_POLL_INTERVAL = 3_000

/** Wait 2 seconds after file appears to ensure write is complete */
export const FILE_SETTLE_DELAY = 2_000

/** Maximum retry attempts for failed stages */
export const MAX_RETRIES = 2

/** Default timeout for stages (10 minutes) */
export const DEFAULT_TIMEOUT = 10 * 60_000

/** Stage-specific timeouts in milliseconds */
export const STAGE_TIMEOUTS: Record<string, number> = {
  architect: 5 * 60_000,
  build: 30 * 60_000,
  test: 10 * 60_000,
  verify: 5 * 60_000,
  auditor: 5 * 60_000,
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
  /** Model to use for OpenCode */
  model?: string
  /** Additional environment variables */
  env?: NodeJS.ProcessEnv
  /** Working directory */
  cwd?: string
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
  input: OrchestratorInput,
  stage: string,
  outputFile: string,
  timeout?: number,
  options: AgentRunnerOptions = {},
): Promise<AgentRunResult> {
  const {
    maxRetries = MAX_RETRIES,
    model = process.env.OPENCODE_MODEL || 'minimax-coding-plan/MiniMax-M2.5',
    env: extraEnv = {},
    cwd = process.cwd(),
  } = options

  // Resolve timeout
  const effectiveTimeout = timeout ?? STAGE_TIMEOUTS[stage] ?? DEFAULT_TIMEOUT

  return new Promise((resolve) => {
    // Build environment for the agent
    const agentEnv = {
      ...process.env,
      ...extraEnv,
      MODEL: model,
      AGENT: stage,
      PROMPT: buildStagePrompt(input, stage),
      // Skip husky hooks for spec-only stages (they auto-commit but don't produce code)
      // Impl stages (build, test, verify, pr, etc.) should respect commitlint
      ...(SPEC_STAGES.includes(stage as never) && { SKIP_HOOKS: '1' }),
    }

    let retries = 0
    let currentChild: ChildProcess | null = null

    const attemptWithRetry = (): void => {
      console.log(`  Attempt ${retries + 1}/${maxRetries + 1}`)

      // Spawn opencode github run (no CLI flags - env vars control behavior)
      currentChild = spawn('opencode', ['github', 'run'], {
        cwd,
        stdio: 'inherit',
        env: agentEnv,
      })

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
              return
            }
          }

          const stat = fs.statSync(detectedFile)
          if (stat.size > 10) {
            settling = true

            // Rename if timestamped
            if (detectedFile !== outputFile) {
              console.log(
                `  📄 Output: ${path.basename(detectedFile)} → ${path.basename(outputFile)}`,
              )
              fs.renameSync(detectedFile, outputFile)
            }

            setTimeout(() => finish({ succeeded: true, timedOut: false }), FILE_SETTLE_DELAY)
          }
        } catch {
          // Ignore stat errors
        }
      }, FILE_POLL_INTERVAL)

      // Timeout
      timeoutTimer = setTimeout(() => {
        finish({ succeeded: false, timedOut: true })
      }, effectiveTimeout)

      // Process exit with retry logic
      currentChild.on('exit', (code) => {
        if (!resolved) {
          // Success if file was created
          if (fs.existsSync(outputFile)) {
            finish({ succeeded: true, timedOut: false })
          } else if (code !== 0 && retries < maxRetries) {
            // Retry on failure
            retries++
            console.log(`  ⚠ Stage failed (exit ${code}), retrying (${retries}/${maxRetries})...`)
            if (pollTimer) clearInterval(pollTimer)
            if (timeoutTimer) clearTimeout(timeoutTimer)
            if (currentChild && !currentChild.killed) {
              currentChild.kill('SIGTERM')
            }
            // Brief delay before retry
            setTimeout(attemptWithRetry, 2000)
          } else {
            finish({ succeeded: code === 0, timedOut: false })
          }
        }
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
  input: OrchestratorInput,
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
