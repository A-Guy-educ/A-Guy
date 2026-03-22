/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern agent-runner
 * @ai-summary Agent execution orchestrator — spawns agents, monitors output, handles retries.
 *   File watching, session management, and log parsing are in agent/ submodules.
 */

import type { ChildProcess } from 'child_process'
import * as fs from 'fs'
import ms from 'ms'
import * as path from 'path'

import type { CodyInput } from './cody-utils'
import { buildStagePrompt } from './stage-prompts'
import { createRunner, type RunnerBackend } from './runner-backend'
import { logger } from './logger'
import { STDERR_TAIL_LINES } from './config/constants'

// Re-export split modules for backward compatibility
export {
  STABILITY_CHECK_INTERVAL,
  STABILITY_CHECK_COUNT,
  POST_EXIT_DELAY,
  NUDGE_TIMEOUT,
  MAX_RETRIES,
  MAX_STDOUT_BUFFER_SIZE,
  DEFAULT_TIMEOUT,
  LLM_TIMEOUT,
  STALL_TIMEOUT,
} from './agent/constants'
export { waitForFileStable } from './agent/file-watcher'
export { formatJsonEvent } from './agent/log-parser'

// Import from split modules for internal use
import {
  MAX_RETRIES,
  MAX_STDOUT_BUFFER_SIZE,
  DEFAULT_TIMEOUT,
  STABILITY_CHECK_INTERVAL,
  STABILITY_CHECK_COUNT,
  POST_EXIT_DELAY,
  STALL_TIMEOUT,
} from './agent/constants'
import { waitForFileStable, findOutputFile, sleep } from './agent/file-watcher'
import { recoverSessionId, nudgeSession } from './agent/session'
import { formatJsonEvent, prefixLogLine } from './agent/log-parser'

// ============================================================================
// Model Resolution
// ============================================================================

/** Cache for opencode.json model config */
let opencodeConfigCache: { agent?: Record<string, { model?: string }> } | null = null

/**
 * Get the model name for a stage from opencode.json
 */
function getStageModel(stage: string): string {
  if (!opencodeConfigCache) {
    try {
      const configPath = path.resolve(process.cwd(), 'opencode.json')
      if (fs.existsSync(configPath)) {
        opencodeConfigCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      }
    } catch {
      opencodeConfigCache = {}
    }
  }
  return opencodeConfigCache?.agent?.[stage]?.model ?? 'unknown'
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
  /** URL of running OpenCode server (for --attach mode) */
  serverUrl?: string
  /** Session ID to fork from (for session continuation) */
  sessionId?: string
  /** XDG_DATA_HOME directory for OpenCode server mode (must match server's data dir) */
  dataDir?: string
  /** Override agent name (for stages that use a different agent, e.g., fix stage uses build agent) */
  agentName?: string
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
// Main Runner
// ============================================================================

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
    agentName,
  } = options

  // Resolve timeout — stage-specific timeouts are now passed from StageDefinition
  const effectiveTimeout = timeout ?? DEFAULT_TIMEOUT

  // Use agentName override if provided, otherwise use stage
  const effectiveAgent = agentName ?? stage

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

      // FIX #10: Calculate remaining timeout (subtract elapsed time from ALL previous attempts).
      // startTime is captured once before the first attempt, so elapsed accurately reflects
      // total time spent across all retries including inter-retry delays.
      const elapsed = Date.now() - startTime
      const remainingTimeout = effectiveTimeout - elapsed
      if (remainingTimeout <= 0) {
        logger.info(
          `  ⏱️ No time remaining after ${retries} retries (${Math.round(elapsed / 1000)}s elapsed)`,
        )
        resolve({ succeeded: false, timedOut: true, retries, validationErrors })
        return
      }
      if (remainingTimeout < 60_000 && retries > 0) {
        logger.warn(
          `  ⚠️ Only ${Math.round(remainingTimeout / 1000)}s remaining for attempt ${retries + 1}`,
        )
      }

      // Build the prompt for the stage (rebuilt each attempt to include feedback)
      const prompt = buildStagePrompt(input, stage, feedback)

      // Log the model being used for this stage
      const model = getStageModel(stage)
      logger.info(`  🤖 Running ${stage} with model: ${model}`)

      // Spawn using the configured backend (local or GitHub)
      // Use effectiveAgent for the --agent flag (may be overridden via agentName option)
      currentChild = backend.spawn(effectiveAgent, prompt, agentEnv, cwd, {
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
      let stallTimer: NodeJS.Timeout | null = null
      let stdoutBuffer = ''
      let extractedSessionId: string | undefined
      let hasCompleted = false // Track if we've detected completion via step_finish event
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
      const STDERR_TAIL_SIZE = STDERR_TAIL_LINES
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

          // Reset stall timer on any stdout activity
          resetStallTimer()

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

            // R2-FIX #13: Detect completion via step_finish event.
            // This fixes the hang in fork mode where process never exits.
            // When we detect completion, call finish() to trigger file detection,
            // nudge logic, and retry - all the fallback logic that normally runs
            // in the exit handler.
            if (result.completed && !hasCompleted && !resolved) {
              hasCompleted = true
              logger.info(`  🎯 Agent signaled completion via event, triggering finish...`)
              // Call finish with succeeded=true - it handles all the fallback logic
              finish({ succeeded: true, timedOut: false })
            }
          }

          // FIX #5: Cap buffer size to prevent memory leaks on verbose agents.
          // When the buffer exceeds MAX, discard the oldest data and keep the most
          // recent MAX/2 bytes, breaking at a newline boundary for clean parsing.
          if (stdoutBuffer.length > MAX_STDOUT_BUFFER_SIZE) {
            const keepFrom = stdoutBuffer.length - MAX_STDOUT_BUFFER_SIZE / 2
            const nextNewline = stdoutBuffer.indexOf('\n', keepFrom)
            stdoutBuffer =
              nextNewline > 0 ? stdoutBuffer.slice(nextNewline + 1) : stdoutBuffer.slice(keepFrom)
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
        if (stallTimer) clearTimeout(stallTimer)

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

      // Stall detection: if no stdout events for STALL_TIMEOUT, the LLM is likely
      // hung (API stall, infinite generation). Kill early and retry instead of
      // wasting the full stage timeout sitting idle.
      const resetStallTimer = () => {
        if (stallTimer) clearTimeout(stallTimer)
        const stallLimit = Math.min(STALL_TIMEOUT, remainingTimeout)
        stallTimer = setTimeout(() => {
          if (resolved) return
          logger.warn(
            `  ⚠️ Agent stalled — no output for ${STALL_TIMEOUT / 1000 / 60} minutes, killing`,
          )
          finish({ succeeded: false, timedOut: true })
        }, stallLimit)
      }
      resetStallTimer()

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
          // Nudge: If agent exited cleanly (code 0) and we have a live session,
          // try a lightweight continuation before burning a full retry.
          // The agent still has all context — it just forgot to write the file.
          // If extractedSessionId is missing (some models don't emit sessionID in events),
          // try to recover it from the OpenCode DB before giving up on nudge.
          if (code === 0 && serverUrl && !extractedSessionId) {
            extractedSessionId = recoverSessionId(dataDir)
          }
          if (code === 0 && serverUrl && extractedSessionId) {
            // R2-FIX #12: Skip nudge if insufficient time remaining (need at least 30s)
            const nudgeElapsed = Date.now() - startTime
            const nudgeRemaining = effectiveTimeout - nudgeElapsed
            if (nudgeRemaining < 30_000) {
              logger.info(
                `  🔔 Skipping nudge — only ${Math.round(nudgeRemaining / 1000)}s remaining`,
              )
            }
            const nudgedFile =
              nudgeRemaining >= 30_000
                ? await nudgeSession(
                    backend,
                    effectiveAgent,
                    outputFile,
                    agentEnv,
                    cwd,
                    serverUrl,
                    extractedSessionId,
                    dataDir,
                  )
                : null
            if (nudgedFile) {
              // Nudge succeeded — continue to file stability check
              // Re-assign detectedFile by jumping to the stability check below
              const { stable, finalSize } = await waitForFileStable(nudgedFile, {
                interval: STABILITY_CHECK_INTERVAL,
                stableCount: STABILITY_CHECK_COUNT,
                timeout: Math.min(ms('30s'), remainingTimeout),
                onCheck: (size, checkNum) => {
                  if (checkNum === 0) {
                    logger.info(`  🔍 File size: ${size} bytes, waiting for stability...`)
                  }
                },
              })
              if (stable && finalSize > 0) {
                logger.info(`  ✅ Output file stable (${finalSize} bytes) after nudge`)
                finish({ succeeded: true, timedOut: false })
                return
              }
              // Nudge produced file but it's not stable — fall through to retry
              logger.info(`  ⚠️ Nudge produced file but it's not stable, falling through to retry`)
            }
          }

          // File not found (or nudge failed) - retry or fail
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
            setTimeout(() => {
              try {
                attemptWithRetry(feedbackMsg)
              } catch (err) {
                logger.error(`  ❌ attemptWithRetry threw: ${err}`)
                finish({ succeeded: false, timedOut: false })
              }
            }, ms('2s'))
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
              setTimeout(() => {
                try {
                  attemptWithRetry(feedbackMsg)
                } catch (err) {
                  logger.error(`  ❌ attemptWithRetry threw: ${err}`)
                  finish({ succeeded: false, timedOut: false })
                }
              }, ms('2s'))
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
                setTimeout(() => {
                  try {
                    attemptWithRetry(feedbackMsg)
                  } catch (err) {
                    logger.error(`  ❌ attemptWithRetry threw: ${err}`)
                    finish({ succeeded: false, timedOut: false })
                  }
                }, ms('2s'))
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
    try {
      attemptWithRetry(undefined)
    } catch (err) {
      logger.error(`  ❌ attemptWithRetry initial call threw: ${err}`)
      resolve({ succeeded: false, timedOut: false, retries: 0, validationErrors: [] })
    }
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
