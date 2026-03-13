/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern agent-runner
 * @ai-summary Agent execution with file watching, timeouts, and retry logic for Cody pipeline stages
 */

import type { ChildProcess } from 'child_process'
import * as fs from 'fs'
import ms from 'ms'
import * as path from 'path'

import type { CodyInput } from './cody-utils'
import { buildStagePrompt } from './stage-prompts'
import { createRunner, type RunnerBackend } from './runner-backend'
import { logger } from './logger'

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

/** Maximum size of stdout buffer to prevent memory leaks (1 MB) */
export const MAX_STDOUT_BUFFER_SIZE = 1_048_576

/** Default timeout for stages (10 minutes) */
export const DEFAULT_TIMEOUT = ms('10m')

/** Stage-specific timeouts in milliseconds */
export const STAGE_TIMEOUTS: Record<string, number> = {
  taskify: ms('10m'),
  spec: ms('15m'),
  gap: ms('15m'),
  clarify: ms('10m'),
  architect: ms('30m'),
  build: ms('45m'),
  'plan-gap': ms('15m'),
  test: ms('20m'),
  review: ms('15m'),
  fix: ms('20m'),
  verify: ms('10m'),
  docs: ms('10m'),
  pr: ms('5m'),
  autofix: ms('15m'),
}

/** LLM-specific timeout - max time to wait for LLM API response (3 minutes) */
export const LLM_TIMEOUT = ms('3m')

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
  /** URL of running OpenCode server (for --attach mode) */
  serverUrl?: string
  /** Session ID to fork from (for session continuation) */
  sessionId?: string
  /** XDG_DATA_HOME directory for OpenCode server mode (must match server's data dir) */
  dataDir?: string
}

export interface AgentRunResult {
  succeeded: boolean
  timedOut: boolean
  retries: number
  /** Validation errors from failed content validation attempts */
  validationErrors?: string[]
  /** Session ID from opencode for chat history capture */
  sessionId?: string
  /** Accumulated token usage across all steps */
  tokenUsage?: { input: number; output: number; cacheRead: number }
  /** Accumulated cost in USD across all steps */
  cost?: number
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
 * Format a JSON event line from opencode into a human-readable log line.
 * Returns the formatted string, or null to skip (for noisy/unimportant events).
 * Also extracts sessionID from events when found.
 */
export function formatJsonEvent(line: string): {
  display: string | null
  sessionId?: string
  stepTokens?: { input: number; output: number; cacheRead: number }
  stepCost?: number
} {
  try {
    const event = JSON.parse(line)
    const type: string = event.type
    const sessionId: string | undefined = event.sessionID

    switch (type) {
      case 'session_start':
        return { display: `🎯 Session started: ${sessionId?.slice(0, 16) || 'unknown'}`, sessionId }

      case 'step_start':
        return { display: null, sessionId } // Quiet — step_finish is more useful

      case 'step_finish': {
        const tokens = event.part?.tokens?.total || 0
        const cost = event.part?.cost ?? 0
        const reason = event.part?.reason || ''
        const cached = event.part?.tokens?.cache?.read || 0
        const inputTokens = event.part?.tokens?.input || 0
        const outputTokens = event.part?.tokens?.output || 0
        const costStr = typeof cost === 'number' && cost > 0 ? ` · $${cost.toFixed(4)}` : ''
        const cacheStr = cached > 0 ? ` · ${cached} cached` : ''
        return {
          display: `  ✅ Step done (${tokens} tok${cacheStr}${costStr}) [${reason}]`,
          sessionId,
          stepTokens: { input: inputTokens, output: outputTokens, cacheRead: cached },
          stepCost: typeof cost === 'number' ? cost : 0,
        }
      }

      case 'tool_use': {
        const tool = event.part?.tool || 'unknown'
        const status = event.part?.state?.status || ''
        const title = event.part?.state?.title || event.part?.state?.input?.description || ''
        const exit = event.part?.state?.metadata?.exit
        const exitStr = exit !== undefined && exit !== 0 ? ` exit=${exit}` : ''
        const titleStr = title ? `: ${title}` : ''
        if (status === 'completed') {
          return { display: `  🔧 ${tool}${titleStr}${exitStr}`, sessionId }
        }
        return { display: null, sessionId } // Skip pending/running states
      }

      case 'text': {
        // Agent reasoning — complete thought blocks (not char-by-char deltas)
        // Typically 6-17 per stage, ~100-200 chars each — not noisy
        const text = (event.part?.text || '').trim()
        if (!text) return { display: null, sessionId }
        const truncated = text.length > 300 ? text.slice(0, 297) + '...' : text
        return { display: `  💭 ${truncated}`, sessionId }
      }

      case 'text_delta':
      case 'content':
        return { display: null, sessionId } // Skip streaming text deltas (too noisy)

      case 'error': {
        const msg = event.part?.message || event.message || JSON.stringify(event.part)
        return { display: `  🔴 Error: ${msg}`, sessionId }
      }

      default:
        return { display: null, sessionId } // Skip unknown event types
    }
  } catch {
    // Not valid JSON — might be a plain log line from pino/logger
    // Show it as-is if it looks meaningful
    const trimmed = line.trim()
    if (!trimmed) return { display: null }
    return { display: trimmed }
  }
}

/**
 * Format a timestamp as HH:MM:SS for log prefixing.
 */
function formatTimestamp(): string {
  const now = new Date()
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

/**
 * Prefix a display line with [stage HH:MM:SS] for log context.
 */
function prefixLogLine(stage: string, display: string): string {
  return `[${stage} ${formatTimestamp()}] ${display.trimStart()}`
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
    serverUrl,
    sessionId,
    dataDir,
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
      logger.info(`  Attempt ${retries + 1}/${maxRetries + 1}`)

      // FIX #2: Delete stale output files before retry to prevent agent confusion
      // The agent might see old output and think work is already done
      if (retries > 0 && fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile)
        logger.info(`  🗑️ Deleted stale output file before retry`)
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
      currentChild = backend.spawn(stage, prompt, agentEnv, cwd, {
        serverUrl,
        sessionId,
        dataDir,
      })

      // Explicitly close stdin to prevent opencode from waiting for input
      if (currentChild.stdin) {
        currentChild.stdin.end()
      }

      let resolved = false
      let timeoutTimer: NodeJS.Timeout | null = null
      let stdoutBuffer = ''
      let extractedSessionId: string | undefined
      const accumulatedTokens = { input: 0, output: 0, cacheRead: 0 }
      let accumulatedCost = 0
      // Write raw JSON events to artifact file for full debugging
      let jsonLogFd: number | null = null
      try {
        const jsonLogPath = path.join(path.dirname(outputFile), `${stage}-events.jsonl`)
        jsonLogFd = fs.openSync(jsonLogPath, 'w')
      } catch {
        // Non-fatal: skip artifact file if can't create
      }

      // Stderr capture for failure debugging
      let stderrLineCount = 0
      const stderrTailLines: string[] = [] // Rolling buffer of last N lines
      const STDERR_TAIL_SIZE = 50
      let stderrLogFd: number | null = null
      try {
        const stderrLogPath = path.join(path.dirname(outputFile), `${stage}-stderr.log`)
        stderrLogFd = fs.openSync(stderrLogPath, 'w')
      } catch {
        // Non-fatal: skip stderr file if can't create
      }

      // Register cleanup handler to prevent FD leak on unexpected exit
      const cleanupFd = () => {
        if (jsonLogFd !== null) {
          try {
            fs.closeSync(jsonLogFd)
          } catch {
            /* ignore */
          }
          jsonLogFd = null
        }
        if (stderrLogFd !== null) {
          try {
            fs.closeSync(stderrLogFd)
          } catch {
            /* ignore */
          }
          stderrLogFd = null
        }
      }
      process.on('exit', cleanupFd)

      // Handle stdout - parse JSON events and display formatted output
      if (currentChild.stdout) {
        currentChild.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString()
          stdoutBuffer += chunk

          // Process line by line (JSON events are one per line)
          const lines = stdoutBuffer.split('\n')
          stdoutBuffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue

            // Write raw JSON to artifact file for debugging
            if (jsonLogFd !== null) {
              fs.writeSync(jsonLogFd, line + '\n')
            }

            // Parse and format for human-readable output
            const result = formatJsonEvent(line)

            // Extract sessionId from first event that has it
            if (result.sessionId && !extractedSessionId) {
              extractedSessionId = result.sessionId
            }

            // Accumulate token/cost data from step_finish events
            if (result.stepTokens) {
              accumulatedTokens.input += result.stepTokens.input
              accumulatedTokens.output += result.stepTokens.output
              accumulatedTokens.cacheRead += result.stepTokens.cacheRead
            }
            if (result.stepCost) {
              accumulatedCost += result.stepCost
            }

            // Display formatted output
            if (result.display) {
              process.stderr.write(prefixLogLine(stage, result.display) + '\n')
            }
          }

          // Cap buffer size to prevent memory leaks on verbose agents
          if (stdoutBuffer.length > MAX_STDOUT_BUFFER_SIZE) {
            // Keep only the last portion, breaking at a newline boundary
            const lastNewline = stdoutBuffer.lastIndexOf('\n', MAX_STDOUT_BUFFER_SIZE / 2)
            stdoutBuffer =
              lastNewline > 0
                ? stdoutBuffer.slice(lastNewline + 1)
                : stdoutBuffer.slice(-MAX_STDOUT_BUFFER_SIZE / 2)
          }
        })
      }

      // Handle stderr - write to file, surface on failure
      if (currentChild.stderr) {
        let stderrBuffer = ''
        currentChild.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString()
          stderrBuffer += chunk

          const lines = stderrBuffer.split('\n')
          stderrBuffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            stderrLineCount++

            // Write to file
            if (stderrLogFd !== null) {
              try {
                fs.writeSync(stderrLogFd, line + '\n')
              } catch {
                /* ignore */
              }
            }

            // Keep rolling tail buffer
            stderrTailLines.push(line)
            if (stderrTailLines.length > STDERR_TAIL_SIZE) {
              stderrTailLines.shift()
            }
          }
        })
      }

      const finish = (result: { succeeded: boolean; timedOut: boolean }) => {
        if (resolved) return
        resolved = true

        if (timeoutTimer) clearTimeout(timeoutTimer)

        // Flush remaining stdout buffer
        if (stdoutBuffer.trim()) {
          if (jsonLogFd !== null) {
            fs.writeSync(jsonLogFd, stdoutBuffer + '\n')
          }
          const lastResult = formatJsonEvent(stdoutBuffer)
          if (lastResult.sessionId && !extractedSessionId) {
            extractedSessionId = lastResult.sessionId
          }
          if (lastResult.display) {
            process.stderr.write(prefixLogLine(stage, lastResult.display) + '\n')
          }
        }

        // Kill process if still running
        if (currentChild && !currentChild.killed) {
          currentChild.kill('SIGTERM')
          setTimeout(() => {
            if (currentChild && !currentChild.killed) currentChild.kill('SIGKILL')
          }, ms('5s'))
        }

        // Close JSON log file descriptor
        if (jsonLogFd !== null) {
          try {
            fs.closeSync(jsonLogFd)
          } catch {
            /* ignore */
          }
          jsonLogFd = null
        }
        // Close stderr log file descriptor
        if (stderrLogFd !== null) {
          try {
            fs.closeSync(stderrLogFd)
          } catch {
            /* ignore */
          }
          stderrLogFd = null
        }
        // Remove exit cleanup handler (FD already closed)
        process.removeListener('exit', cleanupFd)
        const tokenUsage =
          accumulatedTokens.input > 0 || accumulatedTokens.output > 0
            ? accumulatedTokens
            : undefined
        const cost = accumulatedCost > 0 ? accumulatedCost : undefined
        resolve({
          ...result,
          retries,
          validationErrors,
          sessionId: extractedSessionId,
          tokenUsage,
          cost,
        })
      }

      // Parse output file path
      const outputExt = path.extname(outputFile)
      const expectedBase = path.basename(outputFile, outputExt)
      const taskDirForPoll = path.dirname(outputFile)

      // Timeout (uses remaining time to prevent accumulation across retries)
      timeoutTimer = setTimeout(() => {
        logger.info(`  ⏱️ Timeout reached (${remainingTimeout / 1000 / 60} minutes)`)
        finish({ succeeded: false, timedOut: true })
      }, remainingTimeout)

      // Process exit handler - wait for file stability after exit
      currentChild.on('exit', async (code) => {
        logger.info(`  📡 Process exited with code: ${code}`)

        // Surface stderr on failure
        if (code !== 0 && stderrTailLines.length > 0) {
          const isCI = !!process.env.GITHUB_ACTIONS
          if (isCI) process.stderr.write('::group::Agent stderr (last lines)\n')
          for (const line of stderrTailLines) {
            process.stderr.write('  ' + line + '\n')
          }
          if (isCI) process.stderr.write('::endgroup::\n')
        } else if (stderrLineCount > 0) {
          logger.info(
            `  📝 Agent stderr: ${stderrLineCount} lines captured (see ${stage}-stderr.log)`,
          )
        }

        if (resolved) return

        // Brief delay to allow filesystem to flush
        logger.info(`  ⏳ Waiting for filesystem to flush...`)
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
              logger.info(
                `  🔍 Debug: Files in ${path.basename(taskDirForPoll)}: ${files.join(', ')}`,
              )
            } catch {
              // Ignore errors
            }

            logger.info(`  ⚠️ Stage failed (${reason}), retrying (${retries}/${maxRetries})...`)
            setTimeout(() => attemptWithRetry(feedbackMsg), ms('2s'))
            return
          } else {
            // Exhausted retries
            try {
              const files = fs.readdirSync(taskDirForPoll)
              logger.info(
                `  🔍 Debug: Files in ${path.basename(taskDirForPoll)}: ${files.join(', ')}`,
              )
            } catch {
              // Ignore errors
            }
            logger.info(`  ❌ Agent exited ${code} without producing output file`)
            finish({ succeeded: false, timedOut: false })
            return
          }
        }

        // File found - wait for it to stabilize
        logger.info(
          `  📄 Output file detected: ${path.basename(detectedFile)}, checking stability...`,
        )

        try {
          const { stable, finalSize } = await waitForFileStable(detectedFile, {
            interval: STABILITY_CHECK_INTERVAL,
            stableCount: STABILITY_CHECK_COUNT,
            timeout: remainingTimeout,
            onCheck: (size, checkNum) => {
              if (checkNum === 0) {
                logger.info(`  🔍 File size: ${size} bytes, waiting for stability...`)
              }
            },
          })

          if (!stable) {
            logger.info(`  ⚠️ File did not stabilize within timeout`)
            if (retries < maxRetries) {
              retries++
              const feedbackMsg = `CRITICAL FAILURE: Output file was not fully written. The file size changed during stability check. Please ensure you write the complete file before exiting.`
              logger.info(`  ⚠️ Retrying with feedback (${retries}/${maxRetries})...`)
              setTimeout(() => attemptWithRetry(feedbackMsg), ms('2s'))
              return
            } else {
              logger.info(`  ❌ File stability check failed, retries exhausted`)
              finish({ succeeded: false, timedOut: false })
              return
            }
          }

          logger.info(`  ✅ File stable (${finalSize} bytes)`)

          // Rename if timestamped variant
          if (detectedFile !== outputFile) {
            logger.info(
              `  📄 Renaming: ${path.basename(detectedFile)} → ${path.basename(outputFile)}`,
            )
            fs.renameSync(detectedFile, outputFile)
          }

          // VALIDATION: Check content if validator provided
          if (validateOutput) {
            const validationResult = validateOutput(outputFile)
            if (!validationResult.valid) {
              const errorMsg = validationResult.error || 'Content validation failed'
              logger.info(`  ⚠️ Validation failed: ${errorMsg}`)

              // Delete the invalid output file
              try {
                fs.unlinkSync(outputFile)
                logger.info(`  🗑️ Deleted invalid output file`)
              } catch {
                // File might not exist, continue
              }

              // Store validation error for feedback
              validationErrors.push(errorMsg)

              // Retry with feedback if we have retries left
              if (retries < maxRetries) {
                retries++
                const feedbackMsg = `VALIDATION ERROR from previous attempt:\n${errorMsg}\n\nFix this issue in your output. Ensure your output follows the exact required format.`
                logger.info(`  🔄 Retrying with validation feedback (${retries}/${maxRetries})...`)
                setTimeout(() => attemptWithRetry(feedbackMsg), ms('2s'))
                return
              } else {
                logger.info(`  ❌ Validation failed and retries exhausted`)
                finish({ succeeded: false, timedOut: false })
                return
              }
            }
          }

          // Success!
          logger.info(`  ✅ Stage completed successfully`)
          finish({ succeeded: true, timedOut: false })
        } catch (error) {
          logger.info(`  ❌ Error waiting for file stability: ${error}`)
          finish({ succeeded: false, timedOut: false })
        }
      })

      // Handle spawn errors (e.g., command not found)
      currentChild.on('error', (err) => {
        if (resolved) return
        const error = err as NodeJS.ErrnoException
        if (error.code === 'ENOENT') {
          logger.error(`  ❌ Command not found: ${error.path || 'opencode'}. Is it installed?`)
          logger.error('  Install with: npm install -g opencode')
        } else {
          logger.error(`  ❌ Agent process error: ${err.message}`)
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
