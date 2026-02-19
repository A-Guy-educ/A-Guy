/**
 * @fileType utility
 * @domain ci | cody | github
 * @pattern cody-pipeline | github-api | status-tracking
 * @ai-summary CI-specific utilities for the Cody pipeline: comment parsing, GitHub API helpers, status management
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

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
}

export interface CodyPipelineStatus {
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
  'plan-review',
  'build',
  'commit',
  'autofix',
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

export function writeStatus(taskId: string, status: CodyPipelineStatus): void {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2))
}

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

export function completeStatus(taskId: string, state: CodyPipelineStatus['state']): void {
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
    // Use --body-file - to pipe body via stdin, preserving newlines and special characters
    execSync(`gh issue comment ${issueNumber} --body-file -`, {
      input: body,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
  } catch (error) {
    console.error(`Failed to post comment to issue ${issueNumber}:`, error)
  }
}

export function getIssueBody(issueNumber: number): string | null {
  if (!issueNumber) return null

  try {
    const output = execSync(`gh issue view ${issueNumber} --json body --jq '.body'`, {
      encoding: 'utf-8',
    })
    return output.trim() || null
  } catch (error) {
    console.error(`Failed to get issue body for #${issueNumber}:`, error)
    return null
  }
}

export function editComment(_commentId: string, _body: string): void {
  // TODO: Implement if needed - gh api required for editing comments
  console.warn('editComment not implemented')
}

/**
 * Get the latest comment on an issue (not from the bot, not a /cody command)
 */
export function getLatestIssueComment(issueNumber: number, excludeAuthor?: string): string | null {
  if (!issueNumber) return null

  try {
    const exclude = excludeAuthor || 'github-actions[bot]'
    // Get comments, exclude bot and /cody commands, return the latest plain-text answer
    const output = execSync(
      `gh issue view ${issueNumber} --json comments --jq '[.comments[] | select(.author.login != "${exclude}" and (.body | startswith("/cody") | not))] | last | .body'`,
      { encoding: 'utf-8' },
    )
    return output.trim() || null
  } catch {
    return null
  }
}

/**
 * Discover task-id from a previous Cody run by parsing bot comments on the issue.
 * Looks for "Task created: `XXXXXX-task-name`" in bot comments.
 */
export function discoverTaskIdFromIssue(issueNumber: number): string | null {
  if (!issueNumber) return null

  try {
    const output = execSync(
      `gh issue view ${issueNumber} --json comments --jq '[.comments[] | select(.author.login == "github-actions[bot]")] | .[].body'`,
      { encoding: 'utf-8' },
    )
    // Look for "Task created: `XXXXXX-task-name`"
    const match = output.match(/Task created: `(\d{6}-[a-zA-Z0-9-]+)`/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Ensure the "Task created" marker comment exists on the issue.
 *
 * This is critical for task-id discovery: when someone runs `/cody` on an issue,
 * the pipeline discovers the existing task-id by searching for a bot comment
 * containing "Task created: `XXXXXX-task-name`". Without this marker,
 * subsequent runs auto-generate a new task-id instead of reusing the existing one.
 *
 * Previously, the marker was only posted when task.md was created from the issue body
 * (inside runSpecPipeline). This meant dispatch-triggered runs or runs where task.md
 * already existed never posted the marker, breaking discovery on subsequent issue-based runs.
 */
export function ensureTaskMarkerComment(issueNumber: number, taskId: string): void {
  if (!issueNumber || !taskId) return

  // Check if marker already exists for ANY task-id on this issue
  const existingTaskId = discoverTaskIdFromIssue(issueNumber)
  if (existingTaskId) {
    if (existingTaskId === taskId) {
      console.log(`Task marker already exists on issue #${issueNumber} for ${taskId}`)
    } else {
      console.log(
        `Task marker exists on issue #${issueNumber} for ${existingTaskId} (current: ${taskId})`,
      )
    }
    return
  }

  // No marker found — post one
  console.log(`Posting task marker comment on issue #${issueNumber} for ${taskId}`)
  postComment(issueNumber, `🎯 Task created: \`${taskId}\`\n\nCody will now process this task.`)
}

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
      i++
    } else if (arg === '--mode' && normalized[i + 1]) {
      const mode = normalized[i + 1]
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
        if (parsed.input.taskId) input.taskId = parsed.input.taskId
        input.dryRun = parsed.input.dryRun
        input.feedback = parsed.input.feedback
        input.fromStage = parsed.input.fromStage
        input.triggerType = 'comment'
        // Store issueNumber from comment to merge after --issue-number is processed
        if (parsed.input.issueNumber) {
          input.issueNumber = parsed.input.issueNumber
        }
      }
      i++
    } else if (arg === '--file' && normalized[i + 1]) {
      input.file = normalized[i + 1]
      i++
    } else if (arg === '--local') {
      input.local = true
    }
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

  // Handle task-id as subcommand: /cody 260218-task defaults to full with that task
  const isTaskId = /^[0-9]{6}-[a-zA-Z0-9-]+$/.test(subCmd)
  if (isTaskId) {
    mode = 'full'
    taskId = `${subCmd}${rest ? ' ' + rest : ''}`.trim()
    // When task-id is the subcommand, we need to track what was "rest" for options parsing
    // The reconstructed taskId now contains both the ID and options, so use it as original
  } else if (subCmd) {
    // Validate subcommand
    if (!isValidMode(subCmd)) {
      return {
        success: false,
        error: `Unknown subcommand: ${subCmd}`,
        errorComment: `Unknown command \`${subCmd}\`. Valid commands: \`spec\`, \`impl\`, \`rerun\`, \`status\`, \`full\`, or omit for full pipeline`,
      }
    }
    mode = subCmd as CodyInput['mode']
  }

  // Extract task-id (first word of remaining)
  if (taskId) {
    const taskIdEnd = taskId.indexOf(' ')
    if (taskIdEnd !== -1) {
      taskId = taskId.slice(0, taskIdEnd)
    }
  }

  // Don't auto-generate task-id here — let parseCliArgs handle discovery + fallback generation
  // This allows discoverTaskIdFromIssue to find the task-id from previous bot comments

  // Validate task-id format (skip if empty — parseCliArgs will handle it)
  if (taskId && !validateTaskId(taskId)) {
    return {
      success: false,
      error: `Invalid task-id format: ${taskId}`,
      errorComment: `Invalid task ID format: \`${taskId}\`. Expected: \`YYMMDD-description\` (e.g., \`260217-user-metrics\`)`,
    }
  }

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

  let i = 0
  while (i < options.length) {
    const opt = options[i]
    if (opt === '--dry-run') {
      dryRun = true
      i++
    } else if (opt === '--feedback' && options[i + 1]) {
      feedback = options[i + 1]
      i += 2
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

  return {
    success: true,
    input: {
      mode,
      taskId,
      dryRun,
      feedback,
      fromStage,
      issueNumber,
      triggerType: 'comment',
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
  } else if (status.state === 'failed') {
    lines.push(`❌ Cody failed for \`${input.taskId}\``)
  } else if (status.state === 'timeout') {
    lines.push(`⏰ Cody timed out for \`${input.taskId}\``)
  }

  return lines.join('\n')
}
