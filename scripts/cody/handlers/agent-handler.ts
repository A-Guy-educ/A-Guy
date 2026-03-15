/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern agent-handler
 * @ai-summary Agent stage handler that runs LLM agents
 */

import { logger } from '../logger'
import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { runAgentWithFileWatch } from '../agent-runner'
import { stageOutputFile } from '../pipeline-utils'
import { appendSession } from '../chat-history'
import type { StageHandler } from './handler'

/**
 * Agent handler - runs LLM agents via opencode
 */
export class AgentHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    // Use stageOutputFile to get the correct output file (respects STAGE_OUTPUT_MAP)
    const outputFile = stageOutputFile(ctx.taskDir, def.name)

    // Run agent — use agentName override if set, otherwise stage name
    const agentName = def.agentName ?? def.name
    if (def.agentName && def.agentName !== def.name) {
      logger.info(`  ⚙️ Stage "${def.name}" using agent: ${def.agentName}`)
    }
    const result = await runAgentWithFileWatch(ctx.input, agentName, outputFile, def.timeout, {
      backend: ctx.backend,
      validateOutput: def.validator,
      maxRetries: def.maxRetries,
      serverUrl: ctx.serverUrl,
      sessionId: ctx.lastSessionId,
      // XDG_DATA_HOME must match the server's data dir for instance lookup
      dataDir: ctx.serverUrl ? path.join(ctx.taskDir, 'opencode-data') : undefined,
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
            tokenUsage: result.tokenUsage,
            cost: result.cost,
            sessionId: result.sessionId,
          }
        }
      }

      return {
        outcome: 'failed',
        reason: `Agent failed`,
        retries: result.retries,
      }
    }

    // Success - try to save chat history
    if (result.sessionId) {
      try {
        await appendSession(ctx.taskDir, def.name, result.sessionId, ctx.serverUrl)
      } catch (err) {
        // Non-fatal — don't fail the stage if chat export fails
        logger.warn({ err, stage: def.name }, 'Failed to save chat history')
      }

      // Propagate sessionId for downstream stage forking
      ctx.lastSessionId = result.sessionId
    }

    return {
      outcome: 'completed',
      retries: result.retries,
      outputFile: `${def.name}.md`,
      tokenUsage: result.tokenUsage,
      cost: result.cost,
      sessionId: result.sessionId,
    }
  }
}
