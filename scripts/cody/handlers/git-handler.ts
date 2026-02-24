/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern git-handler
 * @ai-summary Git handlers for commit and PR stages
 */

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { runCommitStage, runPrStage } from '../scripted-stages'
import type { StageHandler } from './handler'

/**
 * Git commit handler
 */
export class GitCommitHandler implements StageHandler {
  async execute(_ctx: PipelineContext, _def: StageDefinition): Promise<StageResult> {
    const outputFile = `${_ctx.taskDir}/commit.md`

    const result = runCommitStage(_ctx.taskDir, outputFile)

    if (!result.success && !result.message.includes('No changes')) {
      return {
        outcome: 'failed',
        reason: result.message,
        retries: 0,
      }
    }

    return {
      outcome: 'completed',
      retries: 0,
    }
  }
}

/**
 * Git PR handler
 */
export class GitPrHandler implements StageHandler {
  async execute(_ctx: PipelineContext, _def: StageDefinition): Promise<StageResult> {
    const outputFile = `${_ctx.taskDir}/pr.md`

    const result = runPrStage(_ctx.taskDir, outputFile)

    if (!result.created && !result.url) {
      return {
        outcome: 'failed',
        reason: result.report || 'PR creation failed',
        retries: 0,
      }
    }

    return {
      outcome: 'completed',
      retries: 0,
    }
  }
}
