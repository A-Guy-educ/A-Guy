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
    // Resolve controlMode dynamically (G42)
    const controlMode = resolveControlMode(ctx.taskDef!, ctx.input.controlMode)

    // Determine gate name from stage name (architect or taskify)
    const gate = def.name === 'architect' ? 'architect' : 'taskify'

    // Call gate approval handler
    const gateResult = handleGateApproval(ctx.input, ctx.taskDir, gate, ctx.taskDef!)

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
