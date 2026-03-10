/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern gate-handler
 * @ai-summary Gate handler for approval workflow
 */

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { handleGateApproval } from '../clarify-workflow'
import { resolveControlMode } from '../pipeline-utils'
import type { StageHandler } from './handler'

/**
 * Gate handler - resolves controlMode dynamically and handles approval
 */
export class GateHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    // Guard: taskDef must be loaded before gate can run
    if (!ctx.taskDef) {
      return {
        outcome: 'failed',
        reason: 'task.json not loaded - gate stage requires task definition',
        retries: 0,
      }
    }

    // Resolve controlMode dynamically (G42)
    const controlMode = resolveControlMode(ctx.taskDef, ctx.input.controlMode)

    // Determine gate name from stage name (gsd-plan uses architect gate, taskify uses taskify gate)
    const gate = def.name === 'gsd-plan' ? 'architect' : 'taskify'

    // Call gate approval handler
    const gateResult = handleGateApproval(ctx.input, ctx.taskDir, gate, ctx.taskDef)

    if (gateResult === 'waiting') {
      return {
        outcome: 'paused',
        reason: `${controlMode} gate: awaiting approval`,
        retries: 0,
      }
    }

    if (gateResult === 'rejected') {
      return {
        outcome: 'failed',
        reason: `Task rejected at ${controlMode} gate`,
        retries: 0,
      }
    }

    // Approved
    return {
      outcome: 'completed',
      retries: 0,
    }
  }
}
