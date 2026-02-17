/**
 * @fileType utility
 * @domain ci | pipeline | github
 * @pattern orchestrated-pipeline | github-api | status-tracking
 * @ai-summary CI-specific utilities for the orchestrated pipeline: comment parsing, GitHub API helpers, status management
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorInput {
  mode: 'spec' | 'impl' | 'rerun' | 'full' | 'status'
  taskId: string
  dryRun: boolean
  fromStage?: string
  feedback?: string
  issueNumber?: number
  triggerType?: 'dispatch' | 'comment'
  runId?: string
  runUrl?: string
}

export interface PipelineStatus {
  taskId: string
  mode: string
  pipeline: string
  startedAt: string
  updatedAt: string
  state: 'running' | 'completed' | 'failed' | 'timeout'
  currentStage: string | null
  stages: Record<string, StageStatus>
  triggeredBy: string
  issueNumber?: number
  runId?: string
  runUrl?: string
}

export interface StageStatus {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped'
  startedAt?: string
  completedAt?: string
  elapsed?: number
  retries: number
  outputFile?: string
  error?: string
}

// ============================================================================
// Validation
// ============================================================================

const VALID_MODES = ['spec', 'impl', 'rerun', 'full', 'status'] as const
const VALID_STAGES = [
  'taskify',
  'spec',
  'clarify',
  'architect',
  'build',
  'test',
  'verify',
  'auditor',
  'pr',
]

export function isValidMode(mode: string): mode is (typeof VALID_MODES)[number] {
  return VALID_MODES.includes(mode as (typeof VALID_MODES)[number])
}

export function isValidStage(stage: string): stage is (typeof VALID_STAGES)[number] {
  return VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])
}

export function validateTaskId(taskId: string): boolean {
  // Format: YYMMDD-description (e.g., 260217-user-metrics)
  return /^[0-9]{6}-[a-zA-Z0-9-]+$/.test(taskId)
}

// ============================================================================
// Status Management
// ============================================================================

export function getTaskDir(taskId: string): string {
  return path.join(process.cwd(), '.tasks', taskId)
}

export function ensureTaskDir(taskId: string): string {
  const dir = getTaskDir(taskId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function readStatus(taskId: string): PipelineStatus | null {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  if (!fs.existsSync(statusFile)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(statusFile, 'utf-8'))
  } catch {
    return null
  }
}

export function writeStatus(taskId: string, status: PipelineStatus): void {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2))
}

export function initStatus(input: OrchestratorInput): PipelineStatus {
  const now = new Date().toISOString()
  const status: PipelineStatus = {
    taskId: input.taskId,
    mode: input.mode,
    pipeline: 'spec_execute_verify', // will be updated after taskify
    startedAt: now,
    updatedAt: now,
    state: 'running',
    currentStage: null,
    stages: {},
    triggeredBy: input.triggerType || 'dispatch',
    issueNumber: input.issueNumber,
    runId: input.runId,
    runUrl: input.runUrl,
  }
  writeStatus(input.taskId, status)
  return status
}

export function updateStageStatus(
  taskId: string,
  stage: string,
  state: StageStatus['state'],
  extras?: Partial<StageStatus>,
): void {
  const status = readStatus(taskId)
  if (!status) {
    console.warn(`No status file found for task: ${taskId}`)
    return
  }

  const now = new Date().toISOString()

  if (!status.stages[stage]) {
    status.stages[stage] = {
      state,
      retries: 0,
      ...extras,
    }
  }

  const stageStatus = status.stages[stage]

  if (state === 'running') {
    stageStatus.state = 'running'
    stageStatus.startedAt = now
  } else if (state === 'completed' || state === 'failed' || state === 'timeout') {
    stageStatus.state = state
    stageStatus.completedAt = now
    if (stageStatus.startedAt) {
      stageStatus.elapsed = new Date(now).getTime() - new Date(stageStatus.startedAt).getTime()
    }
    if (extras?.error) {
      stageStatus.error = extras.error
    }
  }

  status.currentStage = state === 'running' ? stage : status.currentStage
  status.updatedAt = now
  writeStatus(taskId, status)
}

export function completeStatus(taskId: string, state: PipelineStatus['state']): void {
  const status = readStatus(taskId)
  if (!status) return

  status.state = state
  status.updatedAt = new Date().toISOString()
  writeStatus(taskId, status)
}

// ============================================================================
// GitHub API Helpers
// ============================================================================

export function postComment(issueNumber: number, body: string): void {
  if (!issueNumber) return

  try {
    execSync(`gh issue comment ${issueNumber} --body "${escapeShell(body)}"`, {
      stdio: 'inherit',
    })
  } catch (error) {
    console.error(`Failed to post comment to issue ${issueNumber}:`, error)
  }
}

export function editComment(commentId: string, body: string): void {
  try {
    execSync(`gh comment edit ${commentId} --body "${escapeShell(body)}"`, {
      stdio: 'inherit',
    })
  } catch (error) {
    console.error(`Failed to edit comment ${commentId}:`, error)
  }
}

export function getIssueComments(issueNumber: number): string[] {
  try {
    const output = execSync(`gh issue comments ${issueNumber} --json body --limit 100`, {
      encoding: 'utf-8',
    })
    const comments = JSON.parse(output)
    return comments.map((c: { body: string }) => c.body)
  } catch {
    return []
  }
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

export function parseCliArgs(argv: string[]): OrchestratorInput {
  // Normalize --key=value into --key value to support both syntaxes
  const normalized: string[] = []
  for (const arg of argv) {
    // Match --flag=value pattern (but not --flag= which is empty value)
    if (arg.match(/^--[a-z][a-z0-9-]*=.+/i)) {
      const eqIdx = arg.indexOf('=')
      normalized.push(arg.slice(0, eqIdx), arg.slice(eqIdx + 1))
    } else {
      normalized.push(arg)
    }
  }

  const input: OrchestratorInput = {
    mode: 'full',
    taskId: '',
    dryRun: false,
  }

  for (let i = 0; i < normalized.length; i++) {
    const arg = normalized[i]

    if (arg === '--task-id' && normalized[i + 1]) {
      input.taskId = normalized[i + 1]
      i++
    } else if (arg === '--mode' && normalized[i + 1]) {
      const mode = argv[i + 1]
      if (!isValidMode(mode)) {
        throw new Error(`Invalid mode: ${mode}. Valid: ${VALID_MODES.join(', ')}`)
      }
      input.mode = mode
      i++
    } else if (arg === '--dry-run') {
      input.dryRun = true
    } else if (arg === '--feedback' && normalized[i + 1]) {
      input.feedback = normalized[i + 1]
      i++
    } else if (arg === '--from' && normalized[i + 1]) {
      const stage = normalized[i + 1]
      if (!isValidStage(stage)) {
        throw new Error(`Invalid stage: ${stage}. Valid: ${VALID_STAGES.join(', ')}`)
      }
      input.fromStage = stage
      i++
    } else if (arg === '--issue-number' && normalized[i + 1]) {
      input.issueNumber = parseInt(normalized[i + 1], 10)
      i++
    } else if (arg === '--trigger-type' && normalized[i + 1]) {
      input.triggerType = normalized[i + 1] as 'dispatch' | 'comment'
      i++
    } else if (arg === '--run-id' && normalized[i + 1]) {
      input.runId = normalized[i + 1]
      i++
    } else if (arg === '--run-url' && normalized[i + 1]) {
      input.runUrl = normalized[i + 1]
      i++
    }
  }

  if (!input.taskId) {
    throw new Error('--task-id is required')
  }

  if (!validateTaskId(input.taskId)) {
    throw new Error(`Invalid task-id format: ${input.taskId}. Expected: YYMMDD-description`)
  }

  return input
}

// ============================================================================
// Auth Validation
// ============================================================================

export function validateAuth(): void {
  const token = process.env.OPENCODE_GITHUB_TOKEN
  if (!token) {
    console.error('❌ OPENCODE_GITHUB_TOKEN is not set')
    console.error('This pipeline requires GitHub App authentication.')
    console.error('Ensure the workflow obtains a token via the OpenCode GitHub action.')
    process.exit(1)
  }
  console.log('✓ GitHub App token validated')
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function escapeShell(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

export function formatStatusComment(
  input: OrchestratorInput,
  status: PipelineStatus,
  currentStage?: string,
  _currentState?: string, // Reserved for future use
): string {
  const lines: string[] = []

  if (status.state === 'running') {
    lines.push(`🔄 Pipeline running for \`${input.taskId}\` (mode: ${input.mode})`)
    if (input.runUrl) {
      lines.push(`Run: ${input.runUrl}`)
    }
    lines.push('')

    if (currentStage) {
      const stageList = Object.entries(status.stages)
      for (const [stage, stageStatus] of stageList) {
        const icon =
          stageStatus.state === 'completed'
            ? '✅'
            : stageStatus.state === 'failed'
              ? '❌'
              : stageStatus.state === 'running'
                ? '🔄'
                : '⏳'
        const elapsed = stageStatus.elapsed ? ` (${formatDuration(stageStatus.elapsed)})` : ''
        lines.push(`  ${icon} ${stage}${elapsed}`)
      }
    }
  } else if (status.state === 'completed') {
    lines.push(`✅ Pipeline completed for \`${input.taskId}\`!`)
    lines.push(`Mode: ${input.mode}`)
  } else if (status.state === 'failed') {
    lines.push(`❌ Pipeline failed for \`${input.taskId}\``)
  } else if (status.state === 'timeout') {
    lines.push(`⏰ Pipeline timed out for \`${input.taskId}\``)
  }

  return lines.join('\n')
}
