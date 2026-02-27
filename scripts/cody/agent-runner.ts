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

/** Delay between stability checks after process exit (milliseconds) */
export const STABILITY_CHECK_INTERVAL = 500

/** Number of consecutive stable size checks before settling */
export const STABILITY_CHECK_COUNT = 2

/** Additional delay to wait after process exit before checking (filesystem flush) */
export const POST_EXIT_DELAY = 500

/** Maximum retry attempts for failed stages */
export const MAX_RETRIES = 2

/** Default timeout for stages (10 minutes) */
export const DEFAULT_TIMEOUT = 10 * 60_000

/** Stage-specific timeouts in milliseconds */
export const STAGE_TIMEOUTS: Record<string, number> = {
  taskify: 10 * 60_000,
  spec: 15 * 60_000,
  gap: 15 * 60_000,
  clarify: 10 * 60_000,
  architect: 30 * 60_000,
  build: 45 * 60_000,
  'plan-gap': 15 * 60_000,
  verify: 10 * 60_000,
  auditor: 5 * 60_000,
  'apply-audit': 5 * 60_000,
  pr: 5 * 60_000,
}

// ============================================================================
// Types
// ============================================================================

/**
 * Result of content validation after agent produces output
 */
export interface ValidationResult {
  /** Whether the output is valid */
  valid: boolean
  /** Error message if validation failed (for feedback to agent on retry) */
  error?: string
}

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
  /** Content validation function to run after output file is detected.
   *  On validation failure, the output file is deleted and the agent is retried with the error in the prompt. */
  validateOutput?: (outputFile: string) => ValidationResult
}

export interface AgentRunResult {
  succeeded: boolean
  timedOut: boolean
  retries: number
  /** Validation errors from failed content validation attempts */
  validationErrors?: string[]
}

// ============================================================================
// Functions
// ============================================================================

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
    timeout = 30_000,
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
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Find output file in directory (supports timestamped variants like spec-123456.md)
 */
function findOutputFile(taskDir: string, expectedBase: string, outputExt: string): string | null {
  if (fs.existsSync(path.join(taskDir, expectedBase + outputExt))) {
    return path.join(taskDir, expectedBase + outputExt)
  }

  // Check for timestamped variants
  const files = fs.readdirSync(taskDir)
  const prefixMatch = files.find((f) => f.startsWith(expectedBase + '-') && f.endsWith(outputExt))
  return prefixMatch ? path.join(taskDir, prefixMatch) : null
}

/**
 * Run an OpenCode agent with file watching, timeouts, and optional retry logic.
 *
 * This function spawns the `opencode github run` command and monitors for the
 * output file. It handles:
 * - Wait for process exit, then check for stable output file (no continuous polling)
 * - Timeout enforcement
 * - Retry on failure (configurable)
 * - Process cleanup on completion
 * - Content validation with retry on failure
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
    validateOutput,
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

    let retries = 0
    const validationErrors: string[] = []
    let currentChild: ChildProcess | null = null
    const startTime = Date.now()

    const attemptWithRetry = (feedback?: string): void => {
      console.log(`  Attempt ${retries + 1}/${maxRetries + 1}`)

      // FIX #2: Delete stale output files before retry to prevent agent confusion
      // The agent might see old output and think work is already done
      if (retries > 0 && fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile)
        console.log(`  🗑️ Deleted stale output file before retry`)
      }

      // Calculate remaining timeout (subtract elapsed time from previous attempts)
      const elapsed = Date.now() - startTime
      const remainingTimeout = effectiveTimeout - elapsed
      if (remainingTimeout <= 0) {
        resolve({ succeeded: false, timedOut: true, retries, validationErrors })
        return
      }

      // Build the prompt for the stage (rebuilt each attempt to include feedback)
      const prompt = buildStagePrompt(input, stage, feedback)

      // Spawn using the configured backend (local or GitHub)
      currentChild = backend.spawn(stage, prompt, agentEnv, cwd)

      let resolved = false
      let timeoutTimer: NodeJS.Timeout | null = null

      const finish = (result: { succeeded: boolean; timedOut: boolean }) => {
        if (resolved) return
        resolved = true

        if (timeoutTimer) clearTimeout(timeoutTimer)

        // Kill process if still running
        if (currentChild && !currentChild.killed) {
          currentChild.kill('SIGTERM')
          setTimeout(() => {
            if (currentChild && !currentChild.killed) currentChild.kill('SIGKILL')
          }, 5000)
        }

        resolve({ ...result, retries, validationErrors })
      }

      // Parse output file path
      const outputExt = path.extname(outputFile)
      const expectedBase = path.basename(outputFile, outputExt)
      const taskDirForPoll = path.dirname(outputFile)

      // Timeout (uses remaining time to prevent accumulation across retries)
      timeoutTimer = setTimeout(() => {
        console.log(`  ⏱️ Timeout reached (${remainingTimeout / 1000 / 60} minutes)`)
        finish({ succeeded: false, timedOut: true })
      }, remainingTimeout)

      // Process exit handler - wait for file stability after exit
      currentChild.on('exit', async (code) => {
        console.log(`  📡 Process exited with code: ${code}`)

        if (resolved) return

        // Brief delay to allow filesystem to flush
        console.log(`  ⏳ Waiting for filesystem to flush...`)
        await sleep(POST_EXIT_DELAY)

        // Find the output file (exact match or timestamped variant)
        const detectedFile = findOutputFile(taskDirForPoll, expectedBase, outputExt)

        if (!detectedFile) {
          // File not found - retry or fail
          if (retries < maxRetries) {
            retries++
            const reason = code === 0 ? 'no output file' : `exit ${code}`
            const feedbackMsg =
              code === 0
                ? `CRITICAL FAILURE: You exited with code 0 but did NOT produce the required output file. You MUST write the output file before exiting. Check that your tool calls are actually writing to the correct path.`
                : `CRITICAL FAILURE: You exited with code ${code}. Fix the error and ensure you write the output file before exiting.`

            // Debug: List files in task directory on failure
            try {
              const files = fs.readdirSync(taskDirForPoll)
              console.log(
                `  🔍 Debug: Files in ${path.basename(taskDirForPoll)}: ${files.join(', ')}`,
              )
            } catch {
              // Ignore errors
            }

            console.log(`  ⚠️ Stage failed (${reason}), retrying (${retries}/${maxRetries})...`)
            setTimeout(() => attemptWithRetry(feedbackMsg), 2000)
            return
          } else {
            // Exhausted retries
            try {
              const files = fs.readdirSync(taskDirForPoll)
              console.log(
                `  🔍 Debug: Files in ${path.basename(taskDirForPoll)}: ${files.join(', ')}`,
              )
            } catch {
              // Ignore errors
            }
            console.log(`  ❌ Agent exited ${code} without producing output file`)
            finish({ succeeded: false, timedOut: false })
            return
          }
        }

        // File found - wait for it to stabilize
        console.log(
          `  📄 Output file detected: ${path.basename(detectedFile)}, checking stability...`,
        )

        try {
          const { stable, finalSize } = await waitForFileStable(detectedFile, {
            interval: STABILITY_CHECK_INTERVAL,
            stableCount: STABILITY_CHECK_COUNT,
            timeout: remainingTimeout,
            onCheck: (size, checkNum) => {
              if (checkNum === 0) {
                console.log(`  🔍 File size: ${size} bytes, waiting for stability...`)
              }
            },
          })

          if (!stable) {
            console.log(`  ⚠️ File did not stabilize within timeout`)
            if (retries < maxRetries) {
              retries++
              const feedbackMsg = `CRITICAL FAILURE: Output file was not fully written. The file size changed during stability check. Please ensure you write the complete file before exiting.`
              console.log(`  ⚠️ Retrying with feedback (${retries}/${maxRetries})...`)
              setTimeout(() => attemptWithRetry(feedbackMsg), 2000)
              return
            } else {
              console.log(`  ❌ File stability check failed, retries exhausted`)
              finish({ succeeded: false, timedOut: false })
              return
            }
          }

          console.log(`  ✅ File stable (${finalSize} bytes)`)

          // Rename if timestamped variant
          if (detectedFile !== outputFile) {
            console.log(
              `  📄 Renaming: ${path.basename(detectedFile)} → ${path.basename(outputFile)}`,
            )
            fs.renameSync(detectedFile, outputFile)
          }

          // VALIDATION: Check content if validator provided
          if (validateOutput) {
            const validationResult = validateOutput(outputFile)
            if (!validationResult.valid) {
              const errorMsg = validationResult.error || 'Content validation failed'
              console.log(`  ⚠️ Validation failed: ${errorMsg}`)

              // Delete the invalid output file
              try {
                fs.unlinkSync(outputFile)
                console.log(`  🗑️ Deleted invalid output file`)
              } catch {
                // File might not exist, continue
              }

              // Store validation error for feedback
              validationErrors.push(errorMsg)

              // Retry with feedback if we have retries left
              if (retries < maxRetries) {
                retries++
                const feedbackMsg = `VALIDATION ERROR from previous attempt:\n${errorMsg}\n\nFix this issue in your output. Ensure your output follows the exact required format.`
                console.log(`  🔄 Retrying with validation feedback (${retries}/${maxRetries})...`)
                setTimeout(() => attemptWithRetry(feedbackMsg), 2000)
                return
              } else {
                console.log(`  ❌ Validation failed and retries exhausted`)
                finish({ succeeded: false, timedOut: false })
                return
              }
            }
          }

          // Success!
          console.log(`  ✅ Stage completed successfully`)
          finish({ succeeded: true, timedOut: false })
        } catch (error) {
          console.log(`  ❌ Error waiting for file stability: ${error}`)
          finish({ succeeded: false, timedOut: false })
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

    // Start first attempt (no feedback)
    attemptWithRetry(undefined)
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
