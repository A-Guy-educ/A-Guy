/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Gate check lifecycle event — pauses pipeline for human approval,
 *   posts gate comment on GitHub, writes paused state, throws PipelinePausedError
 */

import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../logger'
import type { PipelineContext, PostAction, PipelineStateV2 } from '../../engine/types'
import { PipelinePausedError } from '../../engine/types'
import { readTask } from '../../pipeline-utils'
import { commitPipelineFiles } from '../../git-utils'
import { handleGateApproval } from '../../clarify-workflow'
import {
  extractGateCommentBody,
  postComment,
  addIssueLabel,
  removeIssueLabel,
  GATE_LABELS,
} from '../../github-api'
import { updateStage, completeState, writeState, appendActorEvent } from '../../engine/status'

export async function executeCheckGate(
  ctx: PipelineContext,
  action: PostAction & { type: 'check-gate' },
  state: PipelineStateV2 | null,
): Promise<void> {
  // BUG-F fix: taskDef might be null if resolve-profile hasn't run yet
  const taskDef = ctx.taskDef ?? readTask(ctx.taskDir)
  if (!taskDef) {
    throw new Error(`Cannot check gate "${action.gate}": task.json not found or invalid`)
  }
  // Skip gate when controlMode is 'auto' (low risk tasks don't need approval)
  const { resolveControlMode } = await import('../../pipeline-utils')
  const controlMode = resolveControlMode(taskDef, ctx.input.controlMode)
  if (controlMode === 'auto') {
    logger.info(`  ✓ gate ${action.gate} skipped (controlMode: auto)`)
    return
  }
  const gateResult = handleGateApproval(ctx.input, ctx.taskDir, action.gate, taskDef)

  // Determine gate label based on risk level
  const gateLabel = taskDef.risk_level === 'high' ? GATE_LABELS.HARD_STOP : GATE_LABELS.RISK_GATED

  if (gateResult === 'waiting') {
    // Add gate label for dashboard visibility
    if (ctx.input.issueNumber) {
      addIssueLabel(ctx.input.issueNumber, gateLabel)
    }
    // Read gate file and extract comment body
    const gateFilePath = path.join(ctx.taskDir, `gate-${action.gate}.md`)
    if (fs.existsSync(gateFilePath)) {
      const gateContent = fs.readFileSync(gateFilePath, 'utf-8')
      const commentBody = extractGateCommentBody(gateContent)
      if (ctx.input.issueNumber && commentBody) {
        postComment(ctx.input.issueNumber, commentBody)
      }
    }
    // Pre-write paused state to status.json BEFORE commit+push,
    // so the persisted status.json on the branch reflects 'paused' (not 'running').
    // The state machine will also set paused after PipelinePausedError, but that
    // only writes locally — the commit here is what the next CI run reads.
    const currentState = state
    if (currentState) {
      let pausedState = updateStage(currentState, action.gate, { state: 'paused' })
      pausedState = completeState(pausedState, 'paused')
      writeState(ctx.taskId, pausedState)
    }

    // Commit and pause
    commitPipelineFiles({
      taskDir: ctx.taskDir,
      taskId: ctx.taskId,
      message: `ci(cody): pause at ${action.gate} gate for ${ctx.taskId}`,
      ensureBranch: true,
      stagingStrategy: 'task-only',
      push: true,
      isCI: !ctx.input.local,
      dryRun: ctx.input.dryRun,
    })
    throw new PipelinePausedError(`${action.gate} gate: awaiting approval for ${ctx.taskId}`)
  }
  if (gateResult === 'rejected') {
    // Remove gate label when rejected
    if (ctx.input.issueNumber) {
      removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.HARD_STOP)
      removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.RISK_GATED)
    }
    // Record gate rejection actor event
    if (ctx.actor && state) {
      appendActorEvent(ctx.taskId, state, {
        action: 'gate-rejected',
        actor: ctx.actor,
        timestamp: new Date().toISOString(),
        stage: action.gate,
      })
    }
    throw new Error(`Task rejected at ${action.gate} gate`)
  }
  // Approved - remove gate label so dashboard shows it's no longer waiting
  if (ctx.input.issueNumber) {
    removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.HARD_STOP)
    removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.RISK_GATED)
  }
  // Record gate approval actor event
  if (ctx.actor && state) {
    appendActorEvent(ctx.taskId, state, {
      action: 'gate-approved',
      actor: ctx.actor,
      timestamp: new Date().toISOString(),
      stage: action.gate,
    })
  }
}
