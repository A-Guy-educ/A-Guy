/**
 * @fileType script
 * @domain cody
 * @pattern entry-point
 * @ai-summary New CLI entry point for Cody pipeline state machine
 */

// Load .env before anything else so GH_PAT, API keys, etc. are available.
// In CI, environment variables are injected by the workflow — this is a no-op
// if .env doesn't exist (dotenv silently skips missing files).
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })

import ms from 'ms'

import { parseCliArgs, validateAuth, ensureTaskDir } from './cody-utils'
import { preflight } from './preflight'
import { createRunner } from './runner-backend'
import { logger } from './logger'
import { commitPipelineFiles } from './git-utils'

import type { PipelineContext } from './engine/types'
import { resolvePipelineForMode } from './engine/pipeline-resolver'
import { flattenPipelineOrder } from './pipeline/definitions'
import { PipelinePausedError } from './engine/types'
import { startServer, stopServer, checkpointDb, findLastSessionId } from './opencode-server'
import {
  runSpecMode,
  runImplMode,
  runFullMode,
  runRerunMode,
  runFixMode,
  runStatusMode,
} from './modes'

// FIX #3: Import status functions at module level instead of dynamic imports in signal handlers.
// Dynamic `await import()` in signal handlers is unsafe — Node.js signal handlers have limited
// async support and may be killed before the import resolves.
import {
  loadState as loadStateForSignal,
  writeState as writeStateForSignal,
  updateStage as updateStageForSignal,
  completeState as completeStateForSignal,
} from './engine/status'

// Re-export for backward compatibility (canonical source: ./task-setup)
export { ensureTaskMd } from './task-setup'
import type { OpenCodeServer } from './opencode-server'
import { ensureTaskMarkerComment, postComment } from './github-api'

// ============================================================================
// Failure Comment Formatting
// ============================================================================

/**
 * Build an enriched failure comment for GitHub issues.
 * Includes failed stage, error, cost, and stage progression.
 */
function formatFailureComment(
  input: { taskId: string; runUrl?: string },
  state: import('./engine/types').PipelineStateV2 | null,
  error: unknown,
): string {
  const errorMsg = error instanceof Error ? error.message : String(error)
  const lines: string[] = [`❌ Pipeline failed for \`${input.taskId}\``]

  if (state?.stages) {
    // Find the failed stage
    const failedEntry = Object.entries(state.stages).find(
      ([, s]) => s.state === 'failed' || s.state === 'timeout',
    )
    if (failedEntry) {
      const [stageName, stageState] = failedEntry
      const elapsedStr =
        stageState.elapsed != null
          ? ` (after ${Math.floor(stageState.elapsed / 60)}m ${stageState.elapsed % 60}s)`
          : ''
      lines.push(`\n**Failed stage:** \`${stageName}\`${elapsedStr}`)
    }

    lines.push(`**Error:** ${errorMsg}`)

    // Total cost across all stages
    const totalCost = Object.values(state.stages).reduce((sum, s) => sum + (s.cost ?? 0), 0)
    if (totalCost > 0) {
      const completedCount = Object.values(state.stages).filter(
        (s) => s.state === 'completed',
      ).length
      lines.push(`**Cost:** $${totalCost.toFixed(2)} across ${completedCount} stages`)
    }

    // Stage progression
    const progression = Object.entries(state.stages)
      .map(([name, s]) => {
        if (s.state === 'completed') return `${name} ✅`
        if (s.state === 'failed' || s.state === 'timeout') return `${name} ❌`
        if (s.state === 'skipped') return `${name} ⏭`
        return null
      })
      .filter(Boolean)
    if (progression.length > 0) {
      lines.push(`**Completed:** ${progression.join(' → ')}`)
    }
  } else {
    lines.push(`\n**Error:** ${errorMsg}`)
  }

  if (input.runUrl) {
    lines.push(`\nRun: ${input.runUrl}`)
  }

  return lines.join('\n')
}

// ============================================================================
// OpenCode Server Lifecycle
// ============================================================================

/** Module-level reference to the OpenCode server for cleanup in signal handlers */
let openCodeServer: OpenCodeServer | null = null

/**
 * Gracefully shut down the OpenCode server, checkpoint the DB, and clear the reference.
 * Safe to call multiple times (idempotent).
 */
async function shutdownOpenCodeServer(taskDir?: string): Promise<void> {
  if (!openCodeServer) return
  const server = openCodeServer
  openCodeServer = null

  await stopServer(server)

  // Checkpoint WAL into main DB so it's self-contained for git commits
  if (taskDir) {
    checkpointDb(taskDir)
  }
}

// ============================================================================

/**
 * Main entry point
 */
export async function main(cliArgs?: string[]): Promise<void> {
  const args = cliArgs ?? process.argv.slice(2)

  // Handle --help early
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Cody Pipeline CLI

Usage: pnpm tsx scripts/cody/entry.ts [options]

Options:
  --task-id <id>         Task ID (format: YYMMDD-description)
  --mode <mode>          Pipeline mode: full, spec, impl, rerun, clarify, status
  --file <path>          Path to task file (auto-generates task-id from filename)
  --dry-run              Dry run mode
  --issue-number <n>     GitHub issue number
  --trigger-type         Trigger type: dispatch, comment
  --run-id <id>          CI run ID
  --run-url <url>        CI run URL
  --comment-body <text>  Comment body (for comment triggers)
  --from <stage>         Stage to restart from (for rerun mode)
  --feedback <text>      Feedback for rerun mode
  --auto                 Auto mode (non-interactive)
  --gate                 Risk-gated mode (require approval)
  --hard-stop            Hard stop on failure
  --local                Run in local mode (skip GitHub API)
  --clarify              Run clarify stage
  --complexity <1-100>   Override complexity score (for testing)
  --is-pull-request      Comment was on a PR (not issue)
  --fresh                Force create new PR (new branch)

Examples:
  pnpm tsx scripts/cody/entry.ts --task-id 260225-my-task --mode full
  pnpm tsx scripts/cody/entry.ts --file docs/feature.md
  pnpm tsx scripts/cody/entry.ts --mode rerun --from verify --feedback "Tests failed"
`)
    return
  }

  // Parse CLI args
  const input = parseCliArgs(args)

  // Create a child logger with task context

  // R9: Shutdown guard to prevent double-execution on SIGTERM/SIGINT
  let shuttingDown = false
  // G2: Signal handlers with null guard
  const cleanupOnSignal = async (signal: string) => {
    // Prevent double execution (immediate exit on re-entry during async cleanup)
    if (shuttingDown) {
      process.exit(128 + (signal === 'SIGTERM' ? 15 : 2))
      return // unreachable but satisfies TS
    }
    shuttingDown = true
    logger.error(`\n⚠ Received ${signal} — CI runner shutting down`)
    try {
      // FIX #3: Use module-level imports instead of dynamic import in signal context
      const state = loadStateForSignal(input.taskId)
      if (state) {
        // Mark all running stages as failed
        let updatedState = state
        for (const [name, stage] of Object.entries(state.stages)) {
          if (stage.state === 'running') {
            updatedState = updateStageForSignal(updatedState, name, {
              state: 'failed',
              error: `Process interrupted by ${signal}`,
            })
            logger.error(`  Marked stage "${name}" as failed`)
          }
        }
        // Mark pipeline as failed
        const failedState = completeStateForSignal(updatedState, 'failed')
        writeStateForSignal(input.taskId, failedState)
        logger.error(`  Updated status.json to "failed" for task ${input.taskId}`)

        // In CI mode: attempt to commit and push the updated status
        if (process.env.GITHUB_ACTIONS === 'true' && !input.local) {
          logger.error(`  Attempting to commit status.json in CI...`)
          try {
            const { execFileSync } = await import('child_process')
            const SIGNAL_TIMEOUT = ms('10s') // 10s max per git op during shutdown
            // Get the directory where status.json is
            const statusPath = `./.tasks/${input.taskId}/status.json`
            execFileSync('git', ['add', statusPath], {
              stdio: 'inherit',
              timeout: SIGNAL_TIMEOUT,
            })
            execFileSync(
              'git',
              [
                'commit',
                '--no-gpg-sign',
                '-m',
                `ci(cody): save interrupted state for ${input.taskId}`,
              ],
              { stdio: 'inherit', timeout: SIGNAL_TIMEOUT },
            )
            execFileSync('git', ['push'], {
              stdio: 'inherit',
              timeout: SIGNAL_TIMEOUT,
            })
            logger.error(`  ✅ Committed and pushed status.json`)
          } catch (commitErr) {
            logger.error({ err: commitErr }, `  ⚠️ Failed to commit/push status.json`)
          }
        }
      }
    } catch (err) {
      logger.error({ err }, `  Failed to update status`)
    }
    // Kill OpenCode server before exiting (sync-safe: just send SIGTERM).
    // We cannot await stopServer() or checkpointDb() here — the signal context
    // limits async work. The WAL checkpoint is skipped on forced shutdown;
    // SQLite will recover the WAL automatically on the next open.
    if (openCodeServer?.process && !openCodeServer.process.killed) {
      openCodeServer.process.kill('SIGTERM')
      openCodeServer = null
    }

    process.exit(128 + (signal === 'SIGTERM' ? 15 : 2))
  }

  process.on('SIGTERM', () => cleanupOnSignal('SIGTERM'))
  process.on('SIGINT', () => cleanupOnSignal('SIGINT'))

  logger.info(`Task: ${input.taskId}`)
  logger.info(`Mode: ${input.mode}`)
  logger.info(`Dry run: ${input.dryRun}`)
  logger.info(`Local: ${input.local}`)
  if (input.issueNumber) logger.info(`Issue: #${input.issueNumber}`)
  logger.info('')

  // Run preflight checks in local mode
  if (input.local) {
    preflight()
  }

  // Validate GitHub App authentication (skip in local mode)
  if (!input.local) {
    validateAuth()
  }

  // Create runner backend
  const backend = createRunner(input.local)

  // Ensure task directory
  const taskDir = ensureTaskDir(input.taskId)

  // G3: Ensure task marker comment runs for ALL modes before the mode switch
  if (input.issueNumber) {
    ensureTaskMarkerComment(input.issueNumber, input.taskId, input.mode, input.runUrl)
  }

  // Pre-pipeline setup per mode
  const ctx: PipelineContext = {
    taskId: input.taskId,
    taskDir,
    input,
    taskDef: null,
    profile: 'standard',
    backend,
    actor: input.actor,
  }

  // Start OpenCode server for persistent sessions across stages
  // Graceful degradation: if startup fails, pipeline runs without server (cold-boot each stage)
  if (input.mode !== 'status') {
    const server = await startServer(taskDir)
    if (server) {
      openCodeServer = server
      ctx.serverUrl = server.url
      logger.info(`  OpenCode server available at ${server.url}`)

      // On rerun: recover lastSessionId from previous pipeline state
      if (input.mode === 'rerun') {
        const { loadState } = await import('./engine/status')
        const existingState = loadState(input.taskId)
        if (existingState) {
          const pipelineOrder = flattenPipelineOrder(
            resolvePipelineForMode('full', ctx.profile, false, ctx).order,
          )
          const lastSid = findLastSessionId(existingState.stages, pipelineOrder)
          if (lastSid) {
            ctx.lastSessionId = lastSid
            logger.info(`  Recovered session ${lastSid} from previous run`)
          }
        }
      }
    }
  }

  try {
    switch (input.mode) {
      case 'spec':
        await runSpecMode(ctx)
        break
      case 'impl':
        await runImplMode(ctx)
        break
      case 'full':
        await runFullMode(ctx)
        break
      case 'rerun':
        await runRerunMode(ctx)
        break
      case 'fix':
        await runFixMode(ctx)
        break
      case 'status':
        await runStatusMode(ctx)
        break
      default:
        throw new Error(`Unknown mode: ${input.mode}`)
    }
  } catch (error) {
    if (error instanceof PipelinePausedError) {
      // Pipeline paused — still need to shut down server and checkpoint DB
      await shutdownOpenCodeServer(taskDir)
      return
    }

    // G6: process.exit(1) on failure
    // Only update status if state exists and isn't already marked as failed
    // (runPipeline already marks and writes state before throwing)
    const { writeState, loadState: loadSt, completeState } = await import('./engine/status')
    const existingState = loadSt(input.taskId)
    if (existingState && existingState.state !== 'failed') {
      const failedState = completeState(existingState, 'failed')
      writeState(input.taskId, failedState)
    }

    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, `\n❌ Cody failed: ${errorMsg}`)

    // Shutdown OpenCode server before committing (ensures DB is checkpointed)
    await shutdownOpenCodeServer(taskDir)

    // Commit task files on failure — includes debug artifacts (*-events.jsonl, *-stderr.log)
    // for post-mortem diagnosis. On success these are excluded to keep PRs clean.
    try {
      commitPipelineFiles({
        taskDir,
        taskId: input.taskId,
        message: `ci(cody): save failed pipeline state for ${input.taskId}`,
        ensureBranch: true,
        stagingStrategy: 'task-only',
        push: !input.local,
        isCI: !input.local,
        dryRun: input.dryRun,
        pipelineFailed: true,
      })
    } catch (commitErr) {
      logger.warn({ err: commitErr }, 'Failed to commit task files on pipeline failure')
    }

    // Skip GitHub API calls in local mode — each call wrapped in try/catch
    // so process.exit(1) is ALWAYS reached even if GitHub API is down
    if (input.issueNumber && !input.local) {
      try {
        const { setLifecycleLabel } = await import('./github-api')
        setLifecycleLabel(input.issueNumber, 'cody:failed')
      } catch (labelErr) {
        logger.warn({ err: labelErr }, 'Failed to set failure lifecycle label')
      }
      try {
        const failureComment = formatFailureComment(input, existingState, error)
        postComment(input.issueNumber, failureComment)
      } catch (commentErr) {
        logger.warn({ err: commentErr }, 'Failed to post failure comment')
      }
    }
    process.exit(1)
  }

  // Success path: shutdown OpenCode server and checkpoint DB
  await shutdownOpenCodeServer(taskDir)

  // Explicitly exit on success.  Without this the process may hang if
  // the OpenCode server left orphan listeners, timers, or file handles
  // that keep the Node event loop alive.
  process.exit(0)
}

// Run main — skip auto-invocation when imported as a module (e.g., canary tests)
const isDirectExecution =
  process.argv[1]?.endsWith('entry.ts') || process.argv[1]?.endsWith('entry')
if (isDirectExecution) {
  main().catch((err) => {
    const fatalErr = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Fatal error: ${fatalErr}`)
    process.exit(1)
  })
}
