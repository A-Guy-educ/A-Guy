/**
 * @fileType types
 * @domain inspector
 * @pattern core-types
 * @ai-summary Domain-agnostic types for the Inspector framework — no Cody or pipeline knowledge
 */

import type { Logger } from 'pino'

// ============================================================================
// Core Types
// ============================================================================

export type Urgency = 'critical' | 'warning' | 'info' | 'silent'

export interface InspectorPlugin {
  name: string
  description: string
  domain: string
  schedule?: PluginSchedule
  run(ctx: InspectorContext): Promise<ActionRequest[]>
}

export interface PluginSchedule {
  /** Run every N cycles (default: 1 = every cycle) */
  every?: number
  /** Only run within a time window (UTC) */
  onlyBetween?: {
    start: string // HH:mm UTC
    end: string // HH:mm UTC
  }
}

export interface ActionRequest {
  plugin: string
  type: string
  target?: string
  urgency: Urgency
  title: string
  detail: string
  /** Key for deduplication. If set, prevents duplicate actions within dedupWindowMinutes */
  dedupKey?: string
  /** Window for deduplication in minutes. Default: 60 */
  dedupWindowMinutes?: number
  /** Execute the action */
  execute: (ctx: InspectorContext) => Promise<ActionResult>
}

export interface ActionResult {
  success: boolean
  message?: string
}

export interface InspectorContext {
  repo: string
  dryRun: boolean
  state: StateStore
  github: GitHubClient
  log: Logger
  runTimestamp: string
  cycleNumber: number
}

export interface StateStore {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  save(): void
}

export interface GitHubClient {
  postComment(issueNumber: number, body: string): void
  getIssue(issueNumber: number): { body: string | null; title: string | null }
  getOpenIssues(labels?: string[]): IssueInfo[]
  triggerWorkflow(workflow: string, inputs: Record<string, string>): void
  addLabel(issueNumber: number, label: string): void
  removeLabel(issueNumber: number, label: string): void
  setLifecycleLabel(issueNumber: number, label: string): void
  closeIssue(issueNumber: number, reason?: string): void
  getIssueComments(issueNumber: number): IssueComment[]
}

export interface IssueInfo {
  number: number
  title: string
  labels: string[]
  updatedAt: string
}

export interface IssueComment {
  id: number
  body: string
  author: string
  createdAt: string
}

// ============================================================================
// Cody-Specific Types (used by health-check and audit plugins)
// ============================================================================

export interface TaskSnapshot {
  taskId: string
  issueNumber: number
  issueTitle: string
  labels: string[]
  status: unknown | null // PipelineStateV2 from cody/engine/types
  issueUpdatedAt: string
  statusUpdatedAt: string | null
}

export type TaskHealth =
  | 'healthy'
  | 'completed'
  | 'stalled'
  | 'failed'
  | 'gated'
  | 'orphaned'
  | 'unknown'

export interface EvaluatedTask extends TaskSnapshot {
  health: TaskHealth
  healthDetail: string
  stalledMinutes?: number
  gatedMinutes?: number
  failedStage?: string
  failedError?: string
}

export interface InspectorConfig {
  repo: string
  dryRun: boolean
  stateFile: string
  plugins: InspectorPlugin[]
}

export interface InspectorResult {
  cycleNumber: number
  pluginsRun: number
  actionsProduced: number
  actionsExecuted: number
  actionsDeduplicated: number
  errors: string[]
}

// ============================================================================
// Type Guards
// ============================================================================

export function isValidUrgency(value: unknown): value is Urgency {
  return ['critical', 'warning', 'info', 'silent'].includes(value as string)
}

export function isActionRequest(obj: unknown): obj is ActionRequest {
  if (!obj || typeof obj !== 'object') return false
  const req = obj as Record<string, unknown>
  return (
    typeof req.plugin === 'string' &&
    typeof req.type === 'string' &&
    typeof req.title === 'string' &&
    typeof req.execute === 'function'
  )
}

export function isInspectorPlugin(obj: unknown): obj is InspectorPlugin {
  if (!obj || typeof obj !== 'object') return false
  const plugin = obj as Record<string, unknown>
  return (
    typeof plugin.name === 'string' &&
    typeof plugin.description === 'string' &&
    typeof plugin.domain === 'string' &&
    typeof plugin.run === 'function'
  )
}
