/**
 * @fileType interface
 * @domain cody | handlers
 * @pattern handler-registry
 * @ai-summary Handler interface and registry for pipeline stages
 */

import type { PipelineContext, StageDefinition, StageResult, StageType } from '../engine/types'
import type { StageName } from '../stages/registry'
import { AgentHandler } from './agent-handler'
import { ScriptedVerifyHandler } from './scripted-handler'
import { GitCommitHandler, GitPrHandler } from './git-handler'
import { GateHandler } from './gate-handler'

/**
 * Interface for all stage handlers
 */
export interface StageHandler {
  execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult>
}

// ============================================================================
// Handler Registry
// ============================================================================

/**
 * Get handler for a stage based on its name and type.
 * Uses name-based lookup first (R3), then falls back to type-based default.
 */
export function getHandler(stageName: StageName, stageType: StageType): StageHandler {
  // Named handlers first - for stages that need special handling
  switch (stageName) {
    case 'commit':
      return new GitCommitHandler()
    case 'pr':
      return new GitPrHandler()
    case 'verify':
      return new ScriptedVerifyHandler()
  }

  // Type-based default handlers
  switch (stageType) {
    case 'agent':
      return new AgentHandler()
    case 'scripted':
      return new ScriptedVerifyHandler()
    case 'gate':
      return new GateHandler()
    case 'git':
      // Default git handler - shouldn't reach here normally
      return new GitCommitHandler()
    default:
      // R12: Exhaustiveness check - fail at compile time if new StageType is added
      const _exhaustive: never = stageType
      throw new Error(`Unknown stage type: ${stageType}`)
  }
}
