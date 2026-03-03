/**
 * @fileType utility
 * @domain watchdog
 * @pattern types
 * @ai-summary Type definitions for the watchdog monitoring system
 */

import type { PipelineStateV2 } from '../cody/engine/types'

// ============================================================================
// Core Types
// ============================================================================

export type Urgency = 'critical' | 'warning' | 'info' | 'silent'

export interface CheckResult {
  check: string
  urgency: Urgency
  title: string
  detail: string
  taskId?: string
  issueNumber?: number
  autoAction?: AutoAction
}

export interface AutoAction {
  type: 'trigger-rerun'
  taskId: string
  fromStage: string
  feedback: string
}

// ============================================================================
// Task Discovery Types
// ============================================================================

export interface ActiveTask {
  issueNumber: number
  taskId: string
  status: PipelineStateV2
  labels: string[]
  updatedAt: string
}

// ============================================================================
// Check Configuration
// ============================================================================

export interface CheckConfig {
  /** Check name identifier */
  name: string
  /** Human-readable description */
  description: string
  /** Minimum time (ms) between check runs to avoid duplicate alerts */
  dedupWindowMs: number
  /** Whether this check can trigger auto-actions */
  supportsAutoAction: boolean
}

export type CheckFunction = (context: WatchdogContext) => Promise<CheckResult[]>

export interface Check {
  config: CheckConfig
  run: CheckFunction
}

// ============================================================================
// Watchdog Context
// ============================================================================

export interface WatchdogContext {
  repo: string
  ghToken: string
  slackWebhookUrl?: string
  watchdogIssue: string
  requestedChecks: string[]
}

// ============================================================================
// Delivery Types
// ============================================================================

export interface DeliveryResult {
  delivered: boolean
  targets: string[]
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

export const DEDUP_MARKER_PREFIX = '<!-- watchdog:'

export const DEDUP_MARKERS = {
  gateReminder: (taskId: string) => `${DEDUP_MARKER_PREFIX}gate-reminder:${taskId}:`,
  autoRerun: (taskId: string) => `${DEDUP_MARKER_PREFIX}auto-rerun:${taskId}:`,
  stuckPipeline: (taskId: string) => `${DEDUP_MARKER_PREFIX}stuck:${taskId}:`,
}

// Thresholds (in minutes)
export const THRESHOLDS = {
  STUCK_WARNING: 20,
  STUCK_CRITICAL: 45,
  GATE_SILENT: 30,
  GATE_WARNING: 60,
  GATE_CRITICAL: 120,
}
