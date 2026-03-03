/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern agent-handler
 * @ai-summary Agent stage handler that runs LLM agents
 */

import { logger } from '../logger'
import * as fs from 'fs'

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { runAgentWithFileWatch } from '../agent-runner'
import { stageOutputFile } from '../pipeline-utils'
import type { StageHandler } from './handler'

/**
 * Agent handler - runs LLM agents via opencode
 */
export class AgentHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    // Use stageOutputFile to get the correct output file (respects STAGE_OUTPUT_MAP)
    const outputFile = stageOutputFile(ctx.taskDir, def.name)

    // Run agent
    const result = await runAgentWithFileWatch(ctx.input, def.name, outputFile, def.timeout, {
      backend: ctx.backend,
      validateOutput: def.validator,
      maxRetries: def.maxRetries,
    })

    // Map result to StageResult
    if (result.timedOut) {
      return {
        outcome: 'timed_out',
        retries: result.retries,
      }
    }

    if (!result.succeeded) {
      // Try fallback: if agent exited 0 but didn't write output file, create one
      if (def.fallbackOnMissingOutput && !fs.existsSync(outputFile)) {
        const fallbackContent = def.fallbackOnMissingOutput(ctx)
        if (fallbackContent) {
          fs.writeFileSync(outputFile, fallbackContent)
          logger.info(`  ℹ️ Created fallback output: ${def.name}.md`)
          return {
            outcome: 'completed',
            retries: result.retries,
            outputFile: `${def.name}.md`,
          }
        }
      }

      return {
        outcome: 'failed',
        reason: `Agent failed`,
        retries: result.retries,
      }
    }

    return {
      outcome: 'completed',
      retries: result.retries,
      outputFile: `${def.name}.md`,
    }
  }
}
