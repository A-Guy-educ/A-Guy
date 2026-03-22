/**
 * @fileType utility
 * @domain cody | observability | structured-logging
 * @pattern structured-logging | pipeline-events
 * @ai-summary Structured event logging for Cody pipeline observability
 */

import { logger } from './logger'
import type { StageName } from './stages/registry'

/**
 * All pipeline event types for structured logging.
 * Use these as the `event` field in log calls for consistent event classification.
 */
export const PIPELINE_EVENTS = {
  // Pipeline lifecycle
  PIPELINE_START: 'pipeline:start',
  PIPELINE_COMPLETE: 'pipeline:complete',
  PIPELINE_FAIL: 'pipeline:fail',
  PIPELINE_TIMEOUT: 'pipeline:timeout',
  PIPELINE_PAUSE: 'pipeline:pause',

  // Stage lifecycle
  STAGE_START: 'stage:start',
  STAGE_COMPLETE: 'stage:complete',
  STAGE_SKIP: 'stage:skip',
  STAGE_FAIL: 'stage:fail',
  STAGE_RETRY: 'stage:retry',
  STAGE_TIMEOUT: 'stage:timeout',

  // Gate events
  GATE_WAIT: 'gate:wait',
  GATE_APPROVE: 'gate:approve',
  GATE_REJECT: 'gate:reject',

  // Post-action events
  POST_ACTION_START: 'post-action:start',
  POST_ACTION_COMPLETE: 'post-action:complete',
  POST_ACTION_FAIL: 'post-action:fail',

  // Recovery events
  RECOVERY_TRIGGERED: 'recovery:triggered',
  RECOVERY_COMPLETE: 'recovery:complete',
} as const

export type PipelineEventType = (typeof PIPELINE_EVENTS)[keyof typeof PIPELINE_EVENTS]

/**
 * Structured log a stage start event.
 */
export function logStageStart(stageName: StageName, taskId: string, attempt?: number): void {
  logger.info(
    { event: PIPELINE_EVENTS.STAGE_START, stage: stageName, taskId, attempt },
    `▶ Starting stage: ${stageName}`,
  )
}

/**
 * Structured log a stage completion event.
 */
export function logStageComplete(
  stageName: StageName,
  taskId: string,
  outcome: string,
  duration?: number,
): void {
  logger.info(
    { event: PIPELINE_EVENTS.STAGE_COMPLETE, stage: stageName, taskId, outcome, duration },
    `✅ Completed stage: ${stageName} (${outcome})`,
  )
}

/**
 * Structured log a stage skip event.
 */
export function logStageSkip(stageName: StageName | string, taskId: string, reason?: string): void {
  logger.info(
    { event: PIPELINE_EVENTS.STAGE_SKIP, stage: stageName, taskId, reason },
    `⏭ Skipped stage: ${stageName}${reason ? ` (${reason})` : ''}`,
  )
}

/**
 * Structured log a stage failure event.
 */
export function logStageFail(
  stageName: StageName | string,
  taskId: string,
  error?: string,
  retry?: boolean,
): void {
  logger.error(
    { event: PIPELINE_EVENTS.STAGE_FAIL, stage: stageName, taskId, error, retry },
    `❌ Failed stage: ${stageName}${error ? ` - ${error}` : ''}${retry ? ' (will retry)' : ''}`,
  )
}

/**
 * Structured log a stage retry event.
 */
export function logStageRetry(
  stageName: StageName | string,
  taskId: string,
  attempt: number,
  maxRetries: number,
): void {
  logger.warn(
    { event: PIPELINE_EVENTS.STAGE_RETRY, stage: stageName, taskId, attempt, maxRetries },
    `🔄 Retrying stage: ${stageName} (attempt ${attempt}/${maxRetries})`,
  )
}

/**
 * Structured log a pipeline start event.
 */
export function logPipelineStart(taskId: string, mode: string, profile: string): void {
  logger.info(
    { event: PIPELINE_EVENTS.PIPELINE_START, taskId, mode, profile },
    `🚀 Pipeline started: ${taskId} (${mode}, ${profile})`,
  )
}

/**
 * Structured log a pipeline completion event.
 */
export function logPipelineComplete(taskId: string, duration?: number, totalCost?: number): void {
  logger.info(
    { event: PIPELINE_EVENTS.PIPELINE_COMPLETE, taskId, duration, totalCost },
    `✅ Pipeline completed: ${taskId}${duration ? ` (${duration}ms)` : ''}`,
  )
}

/**
 * Structured log a gate wait event.
 */
export function logGateWait(gateName: string, taskId: string): void {
  logger.info(
    { event: PIPELINE_EVENTS.GATE_WAIT, gate: gateName, taskId },
    `⏸ Waiting for gate: ${gateName}`,
  )
}

/**
 * Structured log a recovery action.
 */
export function logRecovery(stageName: StageName | string, taskId: string, reason: string): void {
  logger.info(
    { event: PIPELINE_EVENTS.RECOVERY_TRIGGERED, stage: stageName, taskId, reason },
    `🔧 Recovery triggered: ${stageName} - ${reason}`,
  )
}

/**
 * Structured log a post-action event.
 */
export function logPostAction(
  actionType: string,
  taskId: string,
  status: 'start' | 'complete' | 'fail',
  error?: string,
): void {
  const event =
    status === 'start'
      ? PIPELINE_EVENTS.POST_ACTION_START
      : status === 'complete'
        ? PIPELINE_EVENTS.POST_ACTION_COMPLETE
        : PIPELINE_EVENTS.POST_ACTION_FAIL

  const logFn = status === 'fail' ? logger.error : status === 'start' ? logger.info : logger.info

  logFn(
    { event, actionType, taskId, error },
    `${status === 'start' ? '▶' : status === 'complete' ? '✅' : '❌'} Post-action [${actionType}]: ${status}${error ? ` - ${error}` : ''}`,
  )
}
