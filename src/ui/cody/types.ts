/**
 * @fileType types
 * @domain cody
 * @pattern types
 * @ai-summary Core TypeScript types for Cody dashboard
 */

// ============ Pipeline Types ============

export type StageState =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'skipped'
  | 'gate-waiting'

export interface StageStatus {
  state: StageState
  startedAt?: string
  completedAt?: string
  elapsed?: number
  retries: number
  outputFile?: string
  error?: string
}

export interface CodyPipelineStatus {
  taskId: string
  mode: string
  pipeline: string
  startedAt: string
  updatedAt: string
  completedAt?: string
  totalElapsed?: number
  state: 'running' | 'completed' | 'failed' | 'timeout'
  currentStage: string | null
  stages: Record<string, StageStatus>
  triggeredBy: string
  issueNumber?: number
  runId?: string
  runUrl?: string
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
  gatePoint?: string
}

// ============ Task Definition ============

export type TaskType =
  | 'spec_only'
  | 'implement_feature'
  | 'fix_bug'
  | 'refactor'
  | 'docs'
  | 'ops'
  | 'research'

export type RiskLevel = 'low' | 'medium' | 'high'

export type PrimaryDomain = 'backend' | 'frontend' | 'infra' | 'data' | 'llm' | 'devops' | 'product'

export interface MissingInput {
  field: string
  question: string
}

export interface TaskDefinition {
  task_type: TaskType
  pipeline: 'spec_only' | 'spec_execute_verify'
  risk_level: RiskLevel
  confidence: number
  primary_domain: PrimaryDomain
  scope: string[]
  missing_inputs: MissingInput[]
  assumptions: string[]
}

// ============ Comment Types ============

export type CommentType =
  | 'task-marker'
  | 'running-status'
  | 'success'
  | 'failure'
  | 'cody-failed'
  | 'timeout'
  | 'gate-request'
  | 'gate-approval'
  | 'gate-rejection'
  | 'clarify-stop'
  | 'supervisor-retry'
  | 'supervisor-exhausted'
  | 'supervisor-error'
  | 'vercel-preview'
  | 'unknown'

export interface StageProgress {
  stage: string
  state: StageState
  icon: string
}

export interface ParsedComment {
  type: CommentType
  taskId?: string
  createdAt: string
  body: string
  // type-specific fields
  error?: string
  retryNumber?: number
  maxRetries?: number
  stages?: StageProgress[]
  mode?: string
}

// ============ Kanban Types ============

export type ColumnId = 'open' | 'building' | 'review' | 'failed' | 'gate-waiting' | 'retrying'

export interface Board {
  id: string
  name: string
  type: 'label' | 'milestone' | 'all'
}

// ============ Task Data ============

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: Array<{ name: string; color: string }>
  milestone: { title: string } | null
  assignees: Array<{ login: string; avatar_url: string }>
  created_at: string
  updated_at: string
  closed_at: string | null
  html_url: string
  // Cody-specific fields
  isCodyAssigned?: boolean
}

export interface GitHubComment {
  id: number
  body: string
  created_at: string
  user: { login: string; type: string; avatar_url?: string }
}

export interface WorkflowRun {
  id: number
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: string | null
  created_at: string
  updated_at: string
  html_url: string
}

export interface GitHubPR {
  id: number
  number: number
  title: string
  state: string
  head: { ref: string; sha: string }
  merged_at: string | null
  html_url: string
}

export interface CodyTask {
  id: string // taskId
  issueNumber: number
  title: string
  body: string
  state: 'open' | 'closed'
  labels: string[]
  column: ColumnId
  createdAt: string
  updatedAt: string
  pipeline?: CodyPipelineStatus
  workflowRun?: WorkflowRun
  associatedPR?: GitHubPR | null
  taskDefinition?: TaskDefinition
  // Additional fields for UI
  assignees?: Array<{ login: string; avatar_url: string }>
  isCodyAssigned?: boolean
}

// ============ API Response Types ============

export interface TasksResponse {
  tasks: CodyTask[]
  columns: ColumnId[]
}

export interface BoardsResponse {
  boards: Board[]
}

export interface PipelineResponse {
  status: CodyPipelineStatus | null
  source: 'branch' | 'artifact' | 'comments' | null
}

export interface ActionResponse {
  success: boolean
  message: string
  data?: unknown
}

// ============ GitHub Action Types ============

export type GitHubAction =
  | 'approve'
  | 'reject'
  | 'rerun'
  | 'abort'
  | 'assign'
  | 'unassign'
  | 'close'
  | 'reopen'
  | 'add-label'
  | 'remove-label'
  | 'comment'

// ============ Collaborator Type ============

export interface GitHubCollaborator {
  login: string
  avatar_url: string
}

export interface CollaboratorsResponse {
  collaborators: GitHubCollaborator[]
}
