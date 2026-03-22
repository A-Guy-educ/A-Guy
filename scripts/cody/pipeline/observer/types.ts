/**
 * @fileType types
 * @domain cody | pipeline | observer
 * @pattern observer
 * @ai-summary Type definitions for Pipeline Observer
 */

import type { StageName } from '../../stages/registry'

// ============================================================================
// Core Types
// ============================================================================

export interface StageFailure {
  stageName: StageName
  error: Error
  attempt: number
  maxAttempts: number
  taskDir: string
}

export type ObserverAction = 'retry' | 'escalate' | 'halt'

export interface ObserverResult {
  action: ObserverAction
  reason: string
  fix?: ObserverFix
  observerAttempt: number
}

export interface ObserverFix {
  description: string
  filesModified: string[]
}

export interface ObserverDecision {
  action: ObserverAction
  reason: string
  fix?: ObserverFix
}

// ============================================================================
// Context passed to agent
// ============================================================================

export interface ObserverContext {
  stageName: StageName
  error: {
    message: string
    stack?: string
  }
  attempt: number
  maxAttempts: number
  taskDir: string
  observerAttempt: number
}

// ============================================================================
// Audit Trail
// ============================================================================

export interface ObserverHistoryEntry {
  stage: string
  observerAttempt: number
  error: string
  action: ObserverAction
  reason: string
  wasAgent: boolean
  agentName: string
  timestamp: string
  fixApplied?: ObserverFix
}
