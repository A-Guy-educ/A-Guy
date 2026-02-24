/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern agent-handler
 * @ai-summary Agent stage handler that runs LLM agents
 */

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
    })

    // Map result to StageResult
    if (result.timedOut) {
      return {
        outcome: 'timed_out',
        retries: result.retries,
      }
    }

    if (!result.succeeded) {
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
