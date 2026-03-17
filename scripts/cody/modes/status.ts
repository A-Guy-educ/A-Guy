/**
 * @fileType handler
 * @domain cody | modes
 * @ai-summary Status mode handler — shows pipeline status for a task
 */

import type { PipelineContext } from '../engine/types'
import { stateToV1 } from '../engine/status'
import { formatStatusComment } from '../status-format'
import { postComment } from '../github-api'
import { logger } from '../logger'

export async function runStatusMode(ctx: PipelineContext): Promise<void> {
  const { input } = ctx
  const { loadState } = await import('../engine/status')

  const state = loadState(input.taskId)

  if (!state) {
    logger.info(`No status found for task: ${input.taskId}`)
    logger.info(`The Cody may not have run yet, or status.json was deleted.`)
    return
  }

  logger.info(`Status for ${input.taskId}:`)
  logger.info(state)

  if (input.issueNumber) {
    const v1Status = stateToV1(state)
    postComment(input.issueNumber, formatStatusComment(input, v1Status))
  }
}
