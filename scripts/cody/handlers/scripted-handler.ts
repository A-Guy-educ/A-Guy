/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern scripted-handler
 * @ai-summary Scripted verify handler with autofix loop
 */

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { runVerifyStage } from '../scripted-stages'
import { runAgentWithFileWatch } from '../agent-runner'
import { commitPipelineFiles } from '../git-utils'
import type { StageHandler } from './handler'
import { STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from '../agent-runner'

const MAX_AUTOFIX_ATTEMPTS = 2

/**
 * Scripted verify handler with internal autofix loop
 */
export class ScriptedVerifyHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const outputFile = `${ctx.taskDir}/${def.name}.md`

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
      console.log(`\n🔧 Auto-fix attempt ${attempt}/${MAX_AUTOFIX_ATTEMPTS}...`)

      // Remove previous autofix output if any
      const autofixOutput = `${ctx.taskDir}/autofix.md`
      const { existsSync, unlinkSync } = await import('fs')
      if (existsSync(autofixOutput)) {
        unlinkSync(autofixOutput)
      }

      // Run autofix agent
      const autofixTimeout = STAGE_TIMEOUTS.autofix ?? DEFAULT_TIMEOUT
      const autofixResult = await runAgentWithFileWatch(
        ctx.input,
        'autofix',
        autofixOutput,
        autofixTimeout,
        { backend: ctx.backend },
      )

      if (!autofixResult.succeeded) {
        console.error(`  ❌ Autofix agent failed (attempt ${attempt})`)
        continue
      }

      // Re-run verify after autofix
      console.log('  Re-running verification...')
      if (existsSync(outputFile)) {
        unlinkSync(outputFile)
      }

      const reVerify = runVerifyStage(outputFile)
      if (reVerify.passed) {
        console.log(`  ✅ Verification passed after autofix attempt ${attempt}`)
        fixed = true
        break
      } else {
        console.error(`  ❌ Verification still failing after autofix attempt ${attempt}`)
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
      console.error(`  ❌ Failed to commit/push autofix changes: ${autofixCommitResult.message}`)
      return {
        outcome: 'failed',
        reason: 'Autofix changes could not be pushed',
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
