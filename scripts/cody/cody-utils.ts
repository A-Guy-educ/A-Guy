/**
 * @fileType utility
 * @domain ci | cody | github
 * @pattern cody-pipeline | github-api | status-tracking
 * @ai-summary CI-specific utilities for the Cody pipeline: comment parsing, GitHub API helpers, status management
 */

import * as fs from 'fs'
import * as path from 'path'

import { ALL_STAGES } from './stage-prompts'
import { discoverTaskIdFromIssue } from './github-api'

// ============================================================================
// Types
// ============================================================================

export interface CodyInput {
  mode: 'spec' | 'impl' | 'rerun' | 'full' | 'status'
  taskId: string
  dryRun: boolean
  fromStage?: string
  feedback?: string
  issueNumber?: number
  triggerType?: 'dispatch' | 'comment'
  runId?: string
  runUrl?: string
  // For comment triggers: raw body to parse
  commentBody?: string
  // Local mode: use pnpm ocode run instead of opencode github run
  local?: boolean
  // Path to task description file (for auto-generating task-id and task.md)
  file?: string
  // Opt-in to run clarify stage (default: skip, auto-create clarified.md)
  clarify?: boolean
  // Control mode override: auto, risk-gated, hard-stop
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
}

export interface CodyPipelineStatus {
  taskId: string
  mode: string
  pipeline: string
  startedAt: string
  updatedAt: string
  completedAt?: string
  totalElapsed?: number
  state: 'running' | 'completed' | 'failed' | 'timeout' | 'paused'
  currentStage: string | null
  stages: Record<string, StageStatus>
  triggeredBy: string
  issueNumber?: number
  runId?: string
  runUrl?: string
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
  gatePoint?: string
  botCommentId?: number
}

export interface StageStatus {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped' | 'gate-waiting'
  startedAt?: string
  completedAt?: string
  elapsed?: number
  retries: number
  outputFile?: string
  skipped?: string // Reason for skip (e.g., 'input_quality')
  error?: string
  // Token usage for cost tracking (schema only - not populated)
  tokenUsage?: {
    input: number
    output: number
  }
}

// ============================================================================
// Validation
// ============================================================================

const VALID_MODES = ['spec', 'impl', 'rerun', 'full', 'status'] as const

// VALID_STAGES derived from stage-prompts to avoid duplication
const VALID_STAGES = [...ALL_STAGES]

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

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 * This function is kept for backward compatibility with existing tests.
 */
export function readStatus(taskId: string): CodyPipelineStatus | null {
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

/**
 * Get the last failed stage from status.json for smart rerun default.
 * Returns the stage name that most recently failed, or null if none.
 * Updated to use v2 schema (G(utils-1/2)).
 */
export function getLastFailedStage(taskId: string): string | null {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  if (!fs.existsSync(statusFile)) {
    return null
  }

  try {
    const content = fs.readFileSync(statusFile, 'utf-8')
    const status = JSON.parse(content) as {
      version?: number
      stages?: Record<string, { state: string }>
    }

    // Check if it's v2 format (has version: 2)
    if (status.version === 2 && status.stages) {
      const failedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'failed' || s.state === 'timeout')
        .map(([name]) => name)
      return failedStages.length > 0 ? failedStages[failedStages.length - 1] : null
    }

    // Fallback to v1 format
    if (status?.stages) {
      const failedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'failed' || s.state === 'timeout')
        .map(([name]) => name)
      return failedStages.length > 0 ? failedStages[failedStages.length - 1] : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get the last paused stage from status.json.
 * Used by rerun mode to detect gates that are waiting for approval.
 * Returns the stage name that has state 'paused', or null if none.
 */
export function getLastPausedStage(taskId: string): string | null {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  if (!fs.existsSync(statusFile)) {
    return null
  }

  try {
    const content = fs.readFileSync(statusFile, 'utf-8')
    const status = JSON.parse(content) as {
      version?: number
      stages?: Record<string, { state: string }>
    }

    // Check for paused stages in v2 format
    if (status.version === 2 && status.stages) {
      const pausedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'paused')
        .map(([name]) => name)
      // Return the last paused stage (most recent)
      return pausedStages.length > 0 ? pausedStages[pausedStages.length - 1] : null
    }

    // Fallback to v1 format
    if (status?.stages) {
      const pausedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'paused')
        .map(([name]) => name)
      return pausedStages.length > 0 ? pausedStages[pausedStages.length - 1] : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
export function writeStatus(taskId: string, status: CodyPipelineStatus): void {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  // Atomic write: write to temp file then rename to prevent corruption
  // if the process is killed mid-write (e.g., timeout SIGKILL).
  const tmpFile = statusFile + '.tmp'
  fs.writeFileSync(tmpFile, JSON.stringify(status, null, 2))
  fs.renameSync(tmpFile, statusFile)
}

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
export function initStatus(input: CodyInput): CodyPipelineStatus {
  const now = new Date().toISOString()
  const status: CodyPipelineStatus = {
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

/**
 * Update stage status with read-modify-write to status.json.
 *
 * Concurrency safety: parallel stages (e.g., auditor + pr) call this from
 * separate promise callbacks, but Node.js is single-threaded — only one
 * callback runs at a time, so read-modify-write is atomic on the event loop.
 * The atomic writeStatus (write-to-tmp + rename) guards against corruption
 * from process kills (SIGTERM/SIGKILL during write).
 */

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
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

  // Apply extras (retries, outputFile, error) — works for both new and existing stages
  if (extras) {
    if (extras.retries !== undefined) stageStatus.retries = extras.retries
    if (extras.outputFile !== undefined) stageStatus.outputFile = extras.outputFile
    if (extras.error !== undefined) stageStatus.error = extras.error
  }

  if (state === 'running') {
    stageStatus.state = 'running'
    stageStatus.startedAt = now
  } else if (state === 'completed' || state === 'failed' || state === 'timeout') {
    stageStatus.state = state
    stageStatus.completedAt = now
    if (stageStatus.startedAt) {
      stageStatus.elapsed = new Date(now).getTime() - new Date(stageStatus.startedAt).getTime()
    }
  }

  status.currentStage = state === 'running' ? stage : status.currentStage
  status.updatedAt = now
  writeStatus(taskId, status)
}

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
export function completeStatus(taskId: string, state: CodyPipelineStatus['state']): void {
  const status = readStatus(taskId)
  if (!status) return

  const now = new Date().toISOString()
  status.state = state
  status.updatedAt = now
  status.completedAt = now
  if (status.startedAt) {
    status.totalElapsed = new Date(now).getTime() - new Date(status.startedAt).getTime()
  }
  writeStatus(taskId, status)
}

// ============================================================================
// GitHub API Helpers (re-exported from github-api.ts)
// ============================================================================

// Re-export all GitHub API functions from github-api.ts
export {
  postComment,
  getIssueBody,
  getIssue,
  getIssueTitle,
  editComment,
  getLatestIssueComment,
  getLatestApprovalComment,
  TASK_ID_MARKER_REGEX,
  extractTaskIdFromMarker,
  discoverTaskIdFromIssue,
  extractGateCommentBody,
  ensureTaskMarkerComment,
} from './github-api'

// ============================================================================
// CLI Argument Parsing
// ============================================================================

export function parseCliArgs(argv: string[]): CodyInput {
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

  const input: CodyInput = {
    mode: 'full',
    taskId: '',
    dryRun: false,
  }

  // Track which fields were explicitly set via CLI args
  // Env vars should only be used as fallback when CLI arg wasn't provided
  const cliSet = new Set<string>()

  for (let i = 0; i < normalized.length; i++) {
    const arg = normalized[i]

    // Handle positional arguments (not starting with --)
    if (!arg.startsWith('--')) {
      // Check if it's a valid mode
      if (isValidMode(arg)) {
        input.mode = arg
        continue
      }
      // Otherwise treat as file path
      if (arg.includes('/') || arg.includes('.') || arg.includes('-')) {
        input.file = arg
        continue
      }
      // Unknown positional arg, skip
      continue
    }

    if (arg === '--task-id' && normalized[i + 1]) {
      input.taskId = normalized[i + 1]
      cliSet.add('taskId')
      i++
    } else if (arg === '--mode' && normalized[i + 1]) {
      const mode = normalized[i + 1]
      if (!isValidMode(mode)) {
        throw new Error(`Invalid mode: ${mode}. Valid: ${VALID_MODES.join(', ')}`)
      }
      input.mode = mode
      cliSet.add('mode')
      i++
    } else if (arg === '--dry-run') {
      input.dryRun = true
      cliSet.add('dryRun')
    } else if (arg === '--feedback' && normalized[i + 1]) {
      input.feedback = normalized[i + 1]
      cliSet.add('feedback')
      i++
    } else if (arg === '--from' && normalized[i + 1]) {
      const stage = normalized[i + 1]
      if (!isValidStage(stage)) {
        throw new Error(`Invalid stage: ${stage}. Valid: ${VALID_STAGES.join(', ')}`)
      }
      input.fromStage = stage
      cliSet.add('fromStage')
      i++
    } else if (arg === '--auto') {
      input.controlMode = 'auto'
      cliSet.add('controlMode')
    } else if (arg === '--gate') {
      input.controlMode = 'risk-gated'
      cliSet.add('controlMode')
    } else if (arg === '--hard-stop') {
      input.controlMode = 'hard-stop'
      cliSet.add('controlMode')
    } else if (arg === '--issue-number' && normalized[i + 1]) {
      input.issueNumber = parseInt(normalized[i + 1], 10)
      cliSet.add('issueNumber')
      i++
    } else if (arg === '--trigger-type' && normalized[i + 1]) {
      input.triggerType = normalized[i + 1] as 'dispatch' | 'comment'
      cliSet.add('triggerType')
      i++
    } else if (arg === '--run-id' && normalized[i + 1]) {
      input.runId = normalized[i + 1]
      cliSet.add('runId')
      i++
    } else if (arg === '--run-url' && normalized[i + 1]) {
      input.runUrl = normalized[i + 1]
      cliSet.add('runUrl')
      i++
    } else if (arg.startsWith('--comment-body-env=')) {
      // For comment triggers: read the raw comment body from env var
      // This avoids shell injection when passing comment content through CI
      const envVarName = arg.slice('--comment-body-env='.length)
      const commentBodyFromEnv = process.env[envVarName]
      if (commentBodyFromEnv) {
        const parsed = parseCommentBody(commentBodyFromEnv, undefined)
        if (!parsed.success) {
          throw new Error(parsed.error || 'Failed to parse comment body from env var')
        }
        if (parsed.input) {
          input.mode = parsed.input.mode
          cliSet.add('mode')
          if (parsed.input.taskId) {
            input.taskId = parsed.input.taskId
            cliSet.add('taskId')
          }
          input.dryRun = parsed.input.dryRun
          cliSet.add('dryRun')
          if (parsed.input.feedback) {
            input.feedback = parsed.input.feedback
            cliSet.add('feedback')
          }
          if (parsed.input.fromStage) {
            input.fromStage = parsed.input.fromStage
            cliSet.add('fromStage')
          }
          input.triggerType = 'comment'
          cliSet.add('triggerType')
          if (parsed.input.controlMode) {
            input.controlMode = parsed.input.controlMode
            cliSet.add('controlMode')
          }
          if (parsed.input.issueNumber) {
            input.issueNumber = parsed.input.issueNumber
            cliSet.add('issueNumber')
          }
        }
      }
    } else if (arg === '--comment-body' && normalized[i + 1]) {
      // For comment triggers: parse the raw comment body
      // Note: issueNumber may not be parsed yet, so we pass undefined and merge later
      const commentBody = normalized[i + 1]
      // Store raw comment body for answer extraction later
      input.commentBody = commentBody
      const parsed = parseCommentBody(commentBody, undefined)

      if (!parsed.success) {
        throw new Error(parsed.error || 'Failed to parse comment body')
      }

      // Merge parsed values into input (issueNumber will be merged after --issue-number is processed)
      if (parsed.input) {
        input.mode = parsed.input.mode
        cliSet.add('mode')
        if (parsed.input.taskId) {
          input.taskId = parsed.input.taskId
          cliSet.add('taskId')
        }
        input.dryRun = parsed.input.dryRun
        cliSet.add('dryRun')
        if (parsed.input.feedback) {
          input.feedback = parsed.input.feedback
          cliSet.add('feedback')
        }
        if (parsed.input.fromStage) {
          input.fromStage = parsed.input.fromStage
          cliSet.add('fromStage')
        }
        input.triggerType = 'comment'
        cliSet.add('triggerType')
        if (parsed.input.controlMode) {
          input.controlMode = parsed.input.controlMode
          cliSet.add('controlMode')
        }
        // Store issueNumber from comment to merge after --issue-number is processed
        if (parsed.input.issueNumber) {
          input.issueNumber = parsed.input.issueNumber
          cliSet.add('issueNumber')
        }
      }
      i++
    } else if (arg === '--file' && normalized[i + 1]) {
      input.file = normalized[i + 1]
      cliSet.add('file')
      // --file triggers taskId auto-generation, so don't let env var override
      cliSet.add('taskId')
      i++
    } else if (arg === '--local') {
      input.local = true
      cliSet.add('local')
    } else if (arg === '--clarify') {
      input.clarify = true
      cliSet.add('clarify')
    }
  }

  // Read from environment variables (for CI workflow)
  // CLI args take precedence over env vars - only use env var if field wasn't CLI-set
  if (!cliSet.has('taskId') && process.env.TASK_ID) {
    input.taskId = process.env.TASK_ID
  }
  if (!cliSet.has('mode') && process.env.MODE && isValidMode(process.env.MODE)) {
    input.mode = process.env.MODE
  }
  if (!cliSet.has('dryRun') && process.env.DRY_RUN === 'true') {
    input.dryRun = true
  }
  if (!cliSet.has('feedback') && process.env.FEEDBACK) {
    input.feedback = process.env.FEEDBACK
  }
  if (!cliSet.has('fromStage') && process.env.FROM_STAGE) {
    input.fromStage = process.env.FROM_STAGE
  }
  if (!cliSet.has('clarify') && process.env.CLARIFY === 'true') {
    input.clarify = true
  }
  if (!cliSet.has('issueNumber') && process.env.ISSUE_NUMBER) {
    input.issueNumber = parseInt(process.env.ISSUE_NUMBER, 10)
  }
  if (!cliSet.has('triggerType') && process.env.TRIGGER_TYPE) {
    input.triggerType = process.env.TRIGGER_TYPE as 'dispatch' | 'comment'
  }
  if (!cliSet.has('runId') && process.env.RUN_ID) {
    input.runId = process.env.RUN_ID
  }
  if (!cliSet.has('runUrl') && process.env.RUN_URL) {
    input.runUrl = process.env.RUN_URL
  }

  // Determine local mode: explicitly set or auto-detect from GITHUB_ACTIONS
  if (input.local === undefined) {
    input.local = !process.env.GITHUB_ACTIONS
  }

  // Auto-generate taskId if not provided
  if (!input.taskId) {
    // Try to discover task-id from previous bot comments on the issue
    if (input.issueNumber && input.triggerType === 'comment') {
      const discovered = discoverTaskIdFromIssue(input.issueNumber)
      if (discovered) {
        input.taskId = discovered
        console.log(`Discovered task ID from issue: ${input.taskId}`)
      }
    }

    // If still no task-id, generate one
    if (!input.taskId) {
      if (input.file) {
        // Generate from filename: --file path/to/feature.md -> 260218-feature
        const stem = path.basename(input.file, path.extname(input.file))
        const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        input.taskId = `${datePrefix}-${stem.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}`
      } else {
        // Fallback: auto-generate from date
        const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        const counter = Math.floor(Math.random() * 99) + 1
        input.taskId = `${datePrefix}-auto-${counter.toString().padStart(2, '0')}`
      }
      console.log(`Auto-generated task ID: ${input.taskId}`)
    }
  }

  if (!validateTaskId(input.taskId)) {
    throw new Error(`Invalid task-id format: ${input.taskId}. Expected: YYMMDD-description`)
  }

  return input
}

// ============================================================================
// Comment Body Parsing
// ============================================================================

interface ParseCommentResult {
  success: boolean
  input?: CodyInput
  error?: string
  errorComment?: string // Error message to post back to the issue
}

/**
 * Parse a GitHub issue comment body in the format:
 *   /cody <subcommand> <task-id> [options]
 *
 * Examples:
 *   /cody 260218-user-metrics           -> full mode, task 260218-user-metrics
 *   /cody spec 260218-user-metrics      -> spec mode
 *   /cody impl 260218-user-metrics      -> impl mode
 *   /cody rerun 260218-user-metrics --feedback "fix this"
 *   /cody                               -> full mode, auto-generate task-id
 */
export function parseCommentBody(body: string, issueNumber?: number): ParseCommentResult {
  // Decode JSON-encoded body from YAML (jq -Rs . wraps in quotes and escapes)
  let decoded = body
  if (decoded.startsWith('"') && decoded.endsWith('"')) {
    try {
      decoded = JSON.parse(decoded)
    } catch {
      // Use raw value if JSON.parse fails
    }
  }

  // Normalize literal \n sequences to real newlines
  // (double-escaping from the GitHub Actions → shell → pnpm → Node.js pipeline
  //  can leave literal backslash-n instead of actual newlines)
  decoded = decoded.replace(/\\n/g, '\n')

  // Only parse the first line — /cody commands live on line 1;
  // trailing lines are just whitespace or comment noise
  const firstLine = decoded.split('\n')[0]
  const cmd = firstLine.replace(/^\/cody\s*/, '').trim()

  // Extract subcommand (first word)
  const spaceIdx = cmd.indexOf(' ')
  const subCmd = spaceIdx === -1 ? cmd : cmd.slice(0, spaceIdx)
  const rest = spaceIdx === -1 ? '' : cmd.slice(spaceIdx + 1).trim()

  // Handle empty command: /cody with no subcommand defaults to full
  let mode: CodyInput['mode'] = 'full'
  let taskId = rest
  let implicitFeedback: string | undefined

  // Handle task-id as subcommand: /cody 260218-task defaults to full with that task
  const isTaskId = /^[0-9]{6}-[a-zA-Z0-9-]+$/.test(subCmd)
  if (isTaskId) {
    mode = 'full'
    taskId = `${subCmd}${rest ? ' ' + rest : ''}`.trim()
    // When task-id is the subcommand, we need to track what was "rest" for options parsing
    // The reconstructed taskId now contains both the ID and options, so use it as original
  } else if (subCmd) {
    // Handle approve/reject specially - these are for gate approval, not mode selection
    const lowerSubCmd = subCmd.toLowerCase()
    if (
      lowerSubCmd === 'approve' ||
      lowerSubCmd === 'reject' ||
      lowerSubCmd === 'yes' ||
      lowerSubCmd === 'no' ||
      lowerSubCmd === 'go' ||
      lowerSubCmd === 'proceed'
    ) {
      // Keep existing mode - gate approval logic will detect these keywords
      // Don't change mode, just pass through. The gate check will handle approval detection.
      // If no mode is set yet, default to full for resuming gated tasks
      if (!mode) mode = 'full'
    } else if (isValidMode(subCmd)) {
      // Validate subcommand
      mode = subCmd as CodyInput['mode']
    } else {
      // Unrecognized subcommand: treat as rerun with implicit feedback
      // e.g., "/cody fix tests" → rerun mode, feedback = "fix tests"
      mode = 'rerun'
      // Capture both the subcommand and rest as implicit feedback
      implicitFeedback = rest ? `${subCmd} ${rest}`.trim() : subCmd
    }
  }

  // Extract task-id — ONLY if it matches the task-id pattern (YYMMDD-description)
  // If it doesn't match, for rerun mode treat remaining text as implicit feedback
  // For other modes, leave task-id empty (will be auto-discovered from issue)
  const taskIdPattern = /^[0-9]{6}-[a-zA-Z0-9-]+$/

  if (taskId) {
    const firstWord = taskId.split(' ')[0]
    if (taskIdPattern.test(firstWord)) {
      // First word is a valid task-id
      taskId = firstWord
    } else {
      // First word is NOT a task-id
      if (mode === 'rerun') {
        // For rerun: treat all remaining text as implicit feedback
        implicitFeedback = taskId
      }
      taskId = '' // will be auto-discovered from issue
    }
  }

  // Don't auto-generate task-id here — let parseCliArgs handle discovery + fallback generation
  // This allows discoverTaskIdFromIssue to find the task-id from previous bot comments

  // Parse remaining options (--feedback, --from, --dry-run)
  // rest contains: for isTaskId case: "options", for explicit mode case: "task-id options"
  let optionsStr = ''
  if (isTaskId) {
    // Task-id as subcommand: rest has only options (after task-id)
    optionsStr = rest.trim()
  } else if (taskId) {
    // Explicit mode: rest = "task-id options...", skip past the task-id to get options
    const taskIdLen = taskId.length
    optionsStr = rest.slice(taskIdLen).trim()
  } else {
    // No task-id provided: rest is all options
    optionsStr = rest.trim()
  }

  const options = optionsStr.split(/\s+/)
  let dryRun = false
  let feedback: string | undefined
  let fromStage: string | undefined
  let controlMode: CodyInput['controlMode'] = undefined

  let i = 0
  while (i < options.length) {
    const opt = options[i]
    if (opt === '--dry-run') {
      dryRun = true
      i++
    } else if (opt === '--auto') {
      controlMode = 'auto'
      i++
    } else if (opt === '--gate') {
      controlMode = 'risk-gated'
      i++
    } else if (opt === '--hard-stop') {
      controlMode = 'hard-stop'
      i++
    } else if (opt === '--feedback' && options[i + 1]) {
      // Capture all remaining words until the next --flag as feedback
      const feedbackParts: string[] = []
      let j = i + 1
      while (j < options.length && !options[j].startsWith('--')) {
        feedbackParts.push(options[j])
        j++
      }
      feedback = feedbackParts.join(' ')
      i = j
    } else if (opt === '--from' && options[i + 1]) {
      fromStage = options[i + 1]
      // Validate from stage
      if (!isValidStage(fromStage)) {
        return {
          success: false,
          error: `Invalid stage: ${fromStage}`,
          errorComment: `Invalid stage: \`${fromStage}\`. Valid: \`${VALID_STAGES.join(', ')}\``,
        }
      }
      i += 2
    } else {
      // Skip unknown options
      i++
    }
  }

  // Use implicit feedback if no explicit --feedback was provided (for rerun mode)
  const finalFeedback = feedback || implicitFeedback

  return {
    success: true,
    input: {
      mode,
      taskId,
      dryRun,
      feedback: finalFeedback,
      fromStage,
      issueNumber,
      triggerType: 'comment',
      controlMode,
    },
  }
}

// ============================================================================
// Auth Validation
// ============================================================================

// Note: opencode github run handles OIDC auth internally via the id-token permission.
// We don't need to validate a token ourselves - each invocation handles its own auth.
export function validateAuth(): void {
  // Check we're in GitHub Actions environment (where OIDC auth is available)
  if (!process.env.GITHUB_ACTIONS) {
    console.warn('⚠ Not running in GitHub Actions — OIDC auth may not work')
    console.warn('  Run locally or in CI with id-token: write permission')
  } else {
    console.log('✓ Running in GitHub Actions — OIDC auth available via id-token permission')
  }
}

// ============================================================================
// Formatting Helpers
// ============================================================================

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
  input: CodyInput,
  status: CodyPipelineStatus,
  currentStage?: string,
  _currentState?: string, // Reserved for future use
): string {
  const lines: string[] = []

  if (status.state === 'running') {
    lines.push(`🔄 Cody running for \`${input.taskId}\` (mode: ${input.mode})`)
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
    lines.push(`✅ Cody completed for \`${input.taskId}\`!`)
    lines.push(`Mode: ${input.mode}`)

    // Add per-stage timing for completed pipeline
    const completedStages = Object.entries(status.stages)
    if (completedStages.length > 0) {
      lines.push('')
      for (const [stage, stageStatus] of completedStages) {
        const icon = stageStatus.state === 'completed' ? '✅' : '❌'
        const elapsed = stageStatus.elapsed ? ` (${formatDuration(stageStatus.elapsed)})` : ''
        lines.push(`  ${icon} ${stage}${elapsed}`)
      }
    }
  } else if (status.state === 'paused') {
    lines.push(`⏸️ Cody paused for \`${input.taskId}\``)
    lines.push(
      'Awaiting approval — reply with `@cody approve` or `/cody approve` to proceed. ' +
        'Reply with `@cody reject` or `/cody reject` to cancel.',
    )
  } else if (status.state === 'failed') {
    lines.push(`❌ Cody failed for \`${input.taskId}\``)
  } else if (status.state === 'timeout') {
    lines.push(`⏰ Cody timed out for \`${input.taskId}\``)
  }

  return lines.join('\n')
}

export async function formatStatusCommentV2(input: CodyInput, stateV2: unknown): Promise<string> {
  const { stateToV1 } = await import('./engine/status')
  const v1Status = stateV2 as Parameters<typeof stateToV1>[0]
  return formatStatusComment(input, stateToV1(v1Status))
}
