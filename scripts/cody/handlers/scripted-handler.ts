/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern scripted-handler
 * @ai-summary Scripted verify handler with autofix loop
 */

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { logger } from '../logger'
import { runVerifyStage } from '../scripted-stages'
import { runAgentWithFileWatch } from '../agent-runner'
import { commitPipelineFiles } from '../git-utils'
import type { StageHandler } from './handler'
import { DEFAULT_TIMEOUT } from '../agent-runner'
import { existsSync, unlinkSync } from 'fs'

const MAX_AUTOFIX_ATTEMPTS = 2

/**
 * Scripted verify handler with internal autofix loop
 *
 * H2 FIX: Track aggregate timeout across autofix iterations to prevent
 * pipeline from hanging indefinitely when autofix loops take too long
 */
export class ScriptedVerifyHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const outputFile = `${ctx.taskDir}/${def.name}.md`

    // H2 FIX: Track start time for aggregate timeout
    const startTime = Date.now()
    const totalTimeout = def.timeout ?? DEFAULT_TIMEOUT

    // Accumulate token/cost across autofix iterations
    const accTokens = { input: 0, output: 0, cacheRead: 0 }
    let accCost = 0

    // Run initial verify
    const verifyResult = runVerifyStage(outputFile, undefined, def.timeout)

    if (verifyResult.passed) {
      return {
        outcome: 'completed',
        retries: 0,
        outputFile: `${def.name}.md`,
      }
    }

    // Failed - try autofix loop
    let fixed = false

    for (let attempt = 1; attempt <= MAX_AUTOFIX_ATTEMPTS; attempt++) {
      // H2 FIX: Check aggregate timeout before each attempt
      const elapsed = Date.now() - startTime
      const remaining = totalTimeout - elapsed

      if (remaining <= 0) {
        logger.info(
          `  ⏱️ Aggregate timeout exceeded (${totalTimeout / 1000 / 60} minutes) — stopping autofix loop`,
        )
        return {
          outcome: 'timed_out',
          reason: `Aggregate timeout exceeded during autofix loop after ${attempt - 1} attempts`,
          retries: 0,
        }
      }

      logger.info(
        `\n🔧 Auto-fix attempt ${attempt}/${MAX_AUTOFIX_ATTEMPTS} (${(remaining / 1000 / 60).toFixed(1)}m remaining)...`,
      )

      // Remove previous autofix output if any
      const autofixOutput = `${ctx.taskDir}/autofix.md`
      if (existsSync(autofixOutput)) {
        unlinkSync(autofixOutput)
      }

      // Run autofix agent with remaining time
      const autofixResult = await runAgentWithFileWatch(
        ctx.input,
        'autofix',
        autofixOutput,
        remaining, // H2 FIX: Pass remaining time instead of full timeout
        { backend: ctx.backend },
      )

      // Accumulate token/cost from autofix agent
      if (autofixResult.tokenUsage) {
        accTokens.input += autofixResult.tokenUsage.input
        accTokens.output += autofixResult.tokenUsage.output
        accTokens.cacheRead += autofixResult.tokenUsage.cacheRead
      }
      if (autofixResult.cost) {
        accCost += autofixResult.cost
      }

      if (!autofixResult.succeeded) {
        logger.error(`  ❌ Autofix agent failed (attempt ${attempt})`)
        // Check if it was a timeout
        if (autofixResult.timedOut) {
          logger.info(`  ⏱️ Autofix timed out, stopping loop`)
          return {
            outcome: 'timed_out',
            reason: `Autofix agent timed out on attempt ${attempt}`,
            retries: 0,
          }
        }
        continue
      }

      // H2 FIX: Check timeout before re-running verify
      const elapsedAfter = Date.now() - startTime
      const remainingAfter = totalTimeout - elapsedAfter

      if (remainingAfter <= 0) {
        logger.info(`  ⏱️ Aggregate timeout exceeded — stopping before verify re-run`)
        return {
          outcome: 'timed_out',
          reason: `Aggregate timeout exceeded during autofix loop`,
          retries: 0,
        }
      }

      // Re-run verify after autofix
      logger.info('  Re-running verification...')
      if (existsSync(outputFile)) {
        unlinkSync(outputFile)
      }

      const reVerify = runVerifyStage(outputFile, undefined, remainingAfter) // H2 FIX: Pass remaining time
      if (reVerify.passed) {
        logger.info(`  ✅ Verification passed after autofix attempt ${attempt}`)
        fixed = true
        break
      } else {
        logger.error(`  ❌ Verification still failing after autofix attempt ${attempt}`)
      }
    }

    if (!fixed) {
      return {
        outcome: 'failed',
        reason: 'Verification failed after auto-fix attempts',
        retries: 0,
      }
    }

    // Commit autofix changes (G(mod-20))
    const autofixCommitResult = commitPipelineFiles({
      taskDir: ctx.taskDir,
      taskId: ctx.taskId,
      message: `fix: Autofix corrections for ${ctx.taskId}\n\nApply automated lint, type, and format fixes`,
      stagingStrategy: 'tracked+task',
      push: true,
      dryRun: ctx.input.dryRun,
    })

    if (!autofixCommitResult.success && !autofixCommitResult.message.includes('No changes')) {
      logger.error(`  ❌ Failed to commit/push autofix changes: ${autofixCommitResult.message}`)
      return {
        outcome: 'failed',
        reason: 'Autofix changes could not be pushed',
        retries: 0,
      }
    }

    const tokenUsage = accTokens.input > 0 || accTokens.output > 0 ? accTokens : undefined
    const cost = accCost > 0 ? accCost : undefined

    return {
      outcome: 'completed',
      retries: 0,
      outputFile: `${def.name}.md`,
      tokenUsage,
      cost,
    }
  }
}
