/**
 * @fileType integration
 * @domain cody | pipeline | orchestrator
 * @pattern orchestrator-integration
 * @ai-summary Integrates PipelineOrchestrator with the state machine for real-time decision making
 */

import type { PipelineContext, PipelineStateV2, StageResult } from '../engine/types'
import type { StageName } from '../stages/registry'
import {
  PipelineOrchestrator,
  type Decision,
  type ErrorClassification,
  type EscalationNotification,
  type OrchestratorContext,
  type OrchestratorHooks,
  OrchestratedError,
} from './orchestrator'
import { logger } from '../logger'
import { updateStage, completeState } from '../engine/status'

// ============================================================================
// Orchestrator Integration
// ============================================================================

/**
 * Create orchestrator context from current pipeline state
 */
export function createOrchestratorContext(
  ctx: PipelineContext,
  stageName: StageName,
  stageState: PipelineStateV2['stages'][string] | undefined,
  error: Error | StageResult,
): OrchestratorContext {
  const previousErrors: Error[] = [] // Could track from stageState.feedbackErrors if available

  return {
    taskId: ctx.taskId,
    taskDir: ctx.taskDir,
    stageName,
    attempt: (stageState?.retries ?? 0) + 1,
    maxAttempts: 3, // Default, could be from stage definition
    error,
    previousErrors,
    startTime: stageState?.startedAt ? new Date(stageState.startedAt).getTime() : Date.now(),
  }
}

/**
 * Process a stage failure through the orchestrator and get the resulting decision
 */
export async function processStageFailure(
  ctx: PipelineContext,
  stageName: StageName,
  stageState: PipelineStateV2['stages'][string] | undefined,
  error: Error | StageResult,
  hooks: OrchestratorHooks,
): Promise<{
  decision: Decision
  classification: ErrorClassification
  orchestratedError?: OrchestratedError
}> {
  // Create context for the orchestrator
  const orchestratorContext = createOrchestratorContext(ctx, stageName, stageState, error)

  // Classify the error
  const classification = hooks.orchestrator.classifyError(
    error instanceof Error ? error : new Error(error.reason || 'Unknown error'),
    orchestratorContext,
  )

  // Get initial decision from orchestrator
  let decision = hooks.orchestrator.decide(orchestratorContext, classification)

  // Allow hook to modify the decision
  if (hooks.onDecision) {
    const modifiedDecision = await hooks.onDecision(decision, orchestratorContext, classification)
    if (modifiedDecision !== null) {
      decision = modifiedDecision
    }
  }

  // If escalation, send notification
  if (decision.action === 'escalate' && hooks.onEscalation) {
    const notification: EscalationNotification = {
      stageName,
      title: `Pipeline Escalation: ${stageName} failed after ${orchestratorContext.attempt} attempts`,
      message: decision.reason,
      error: error instanceof Error ? error.message : error.reason,
      context: {
        taskId: ctx.taskId,
        taskDir: ctx.taskDir,
        attempt: orchestratorContext.attempt,
        maxAttempts: orchestratorContext.maxAttempts,
      },
      timestamp: new Date().toISOString(),
    }
    await hooks.onEscalation(notification)
  }

  // Wrap error with orchestration info for better debugging
  const orchestratedError = new OrchestratedError(
    `Stage ${stageName} failed: ${decision.action} - ${decision.reason}`,
    error instanceof Error ? error : new Error(error.reason || 'Unknown'),
    decision,
    classification,
  )

  return { decision, classification, orchestratedError }
}

/**
 * Apply orchestrator decision to pipeline state
 */
export function applyDecision(
  state: PipelineStateV2,
  stageName: StageName,
  decision: Decision,
  _classification: ErrorClassification,
): { state: PipelineStateV2; decision: Decision; shouldBreak: boolean } {
  switch (decision.action) {
    case 'retry':
      // Reset stage to pending for retry
      return {
        state: updateStage(state, stageName, {
          state: 'pending',
          retries: (state.stages[stageName]?.retries ?? 0) + 1,
          error: decision.reason,
        }),
        decision,
        shouldBreak: false,
      }

    case 'skip':
      return {
        state: updateStage(state, stageName, {
          state: 'skipped',
          skipped: decision.reason,
        }),
        decision,
        shouldBreak: false,
      }

    case 'halt':
    case 'escalate':
      // Mark stage as failed and pipeline as failed
      return {
        state: completeState(
          updateStage(state, stageName, {
            state: 'failed',
            error: decision.reason,
          }),
          'failed',
        ),
        decision,
        shouldBreak: true,
      }

    case 'continue':
    default:
      return {
        state: updateStage(state, stageName, {
          state: 'failed',
          error: decision.reason,
        }),
        decision,
        shouldBreak: true,
      }
  }
}

// ============================================================================
// State Machine Integration Helper
// ============================================================================

/**
 * Helper to create orchestrator hooks with Slack notification support
 */
export function createSlackEscalationHooks(
  orchestrator: PipelineOrchestrator,
  _slackWebhookUrl: string,
): OrchestratorHooks {
  return {
    orchestrator,
    onEscalation: async (notification: EscalationNotification) => {
      // In production, this would POST to Slack webhook
      logger.info(`[Slack] Would escalate: ${notification.title}`)
      logger.info(`[Slack] Message: ${notification.message}`)
      logger.info(
        `[Slack] Context: taskId=${notification.context.taskId}, stage=${notification.stageName}`,
      )
    },
  }
}

/**
 * Helper to create orchestrator hooks with GitHub issue comment support
 */
export function createGitHubEscalationHooks(
  orchestrator: PipelineOrchestrator,
  _githubToken: string,
): OrchestratorHooks {
  return {
    orchestrator,
    onEscalation: async (notification: EscalationNotification) => {
      // In production, this would POST to GitHub API to add issue comment
      logger.info(`[GitHub] Would escalate on issue #${notification.context.taskId}`)
      logger.info(`[GitHub] Comment: ${notification.title}\n\n${notification.message}`)
    },
  }
}

/**
 * Create a decision modifier that allows manual override
 * Useful for CLI tools or dashboards where humans approve decisions
 */
export function createHumanInTheLoopDecisionModifier(): (
  decision: Decision,
  context: OrchestratorContext,
  classification: ErrorClassification,
) => Promise<Decision | null> {
  return async (
    decision: Decision,
    _context: OrchestratorContext,
    _classification: ErrorClassification,
  ): Promise<Decision | null> => {
    // In production, this could prompt the user or check an approval queue
    // For now, just return the orchestrator's decision
    return decision
  }
}
