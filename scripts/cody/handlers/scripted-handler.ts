/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern scripted-handler
 * @ai-summary Scripted verify handler with auto-fix for lint/format
 */

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { logger } from '../logger'
import { runVerifyStage } from '../scripted-stages'
import { commitPipelineFiles } from '../git-utils'
import type { StageHandler } from './handler'
import { DEFAULT_TIMEOUT } from '../agent-runner'
import { existsSync, unlinkSync } from 'fs'
import { execFileSync } from 'child_process'

const MAX_AUTOFIX_ATTEMPTS = 2

/**
 * Scripted verify handler with scripted auto-fix loop.
 *
 * When verify fails on lint/format, runs `pnpm lint:fix` + `pnpm format:fix`
 * directly instead of invoking an LLM agent. The build agent already handled
 * all substantive failures (tsc, tests) in its own feedback loop.
 */
export class ScriptedVerifyHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const outputFile = `${ctx.taskDir}/${def.name}.md`

    const startTime = Date.now()
    const totalTimeout = def.timeout ?? DEFAULT_TIMEOUT

    // Run initial verify
    const verifyResult = runVerifyStage(outputFile, undefined, def.timeout, ctx.taskDir)

    if (verifyResult.passed) {
      return {
        outcome: 'completed',
        retries: 0,
        outputFile: `${def.name}.md`,
      }
    }

    // Failed — try scripted auto-fix loop (lint:fix + format:fix)
    let fixed = false

    for (let attempt = 1; attempt <= MAX_AUTOFIX_ATTEMPTS; attempt++) {
      const elapsed = Date.now() - startTime
      const remaining = totalTimeout - elapsed

      if (remaining <= 0) {
        logger.info(
          `  \u23f1\ufe0f Aggregate timeout exceeded (${totalTimeout / 1000 / 60} minutes) — stopping auto-fix loop`,
        )
        return {
          outcome: 'timed_out',
          reason: `Aggregate timeout exceeded during auto-fix loop after ${attempt - 1} attempts`,
          retries: 0,
        }
      }

      logger.info(
        `\n\ud83d\udd27 Scripted auto-fix attempt ${attempt}/${MAX_AUTOFIX_ATTEMPTS} (${(remaining / 1000 / 60).toFixed(1)}m remaining)...`,
      )

      // Run lint:fix and format:fix directly — no LLM needed for mechanical fixes
      try {
        logger.info('   Running pnpm lint:fix...')
        execFileSync('pnpm', ['lint:fix'], {
          stdio: 'pipe',
          timeout: 2 * 60 * 1000,
          maxBuffer: 10 * 1024 * 1024,
        })
        logger.info('   \u2713 lint:fix completed')
      } catch {
        logger.info('   \u2717 lint:fix had errors (some may need manual fix)')
      }

      try {
        logger.info('   Running pnpm format:fix...')
        execFileSync('pnpm', ['format:fix'], {
          stdio: 'pipe',
          timeout: 2 * 60 * 1000,
          maxBuffer: 10 * 1024 * 1024,
        })
        logger.info('   \u2713 format:fix completed')
      } catch {
        logger.info('   \u2717 format:fix had errors (some may need manual fix)')
      }

      // Re-run verify after fixes
      logger.info('  Re-running verification...')
      if (existsSync(outputFile)) {
        unlinkSync(outputFile)
      }

      const elapsedAfter = Date.now() - startTime
      const remainingAfter = totalTimeout - elapsedAfter

      if (remainingAfter <= 0) {
        logger.info(`  \u23f1\ufe0f Aggregate timeout exceeded — stopping before verify re-run`)
        return {
          outcome: 'timed_out',
          reason: `Aggregate timeout exceeded during auto-fix loop`,
          retries: 0,
        }
      }

      const reVerify = runVerifyStage(outputFile, undefined, remainingAfter, ctx.taskDir)
      if (reVerify.passed) {
        logger.info(`  \u2705 Verification passed after auto-fix attempt ${attempt}`)
        fixed = true
        break
      } else {
        logger.error(`  \u274c Verification still failing after auto-fix attempt ${attempt}`)
      }
    }

    if (!fixed) {
      return {
        outcome: 'failed',
        reason: 'Verification failed after auto-fix attempts',
        retries: 0,
      }
    }

    // Commit auto-fix changes
    const commitResult = commitPipelineFiles({
      taskDir: ctx.taskDir,
      taskId: ctx.taskId,
      message: `fix: Auto-fix lint/format for ${ctx.taskId}\n\nApply automated lint and format fixes`,
      stagingStrategy: 'tracked+task',
      push: true,
      dryRun: ctx.input.dryRun,
    })

    if (!commitResult.success && !commitResult.message.includes('No changes')) {
      logger.error(`  \u274c Failed to commit/push auto-fix changes: ${commitResult.message}`)
      return {
        outcome: 'failed',
        reason: 'Auto-fix changes could not be pushed',
        retries: 0,
      }
    }

    return {
      outcome: 'completed',
      retries: 0,
      outputFile: `${def.name}.md`,
    }
  }
}
