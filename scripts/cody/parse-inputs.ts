/**
 * @fileType utility
 * @domain cody
 * @ai-summary Parse command inputs from dispatch or comment triggers
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'

// Types for outputs
interface ParseOutputs {
  task_id: string
  mode: string
  clarify: string
  dry_run: string
  from_stage: string
  feedback: string
  issue_number: string
  trigger_type: string
  comment_body: string
  valid: string
  runner: string
  version: string
}

// Task ID format: YYMMDD-description (e.g., 260225-auto-90)
export const TASK_ID_REGEX = /^[0-9]{6}-[a-zA-Z0-9-]+$/

// Valid pipeline modes
export const VALID_MODES = ['spec', 'impl', 'rerun', 'full', 'status']

// Approval keywords (exact match only)
export const APPROVAL_KEYWORDS = ['approve', 'approved', 'yes', 'go', 'proceed', 'y', 'continue']

/**
 * Validate task ID format
 */
export function isValidTaskId(taskId: string): boolean {
  return TASK_ID_REGEX.test(taskId)
}

/**
 * Normalize comment body - lowercase and trim
 */
export function normalizeComment(comment: string): string {
  return comment.toLowerCase().trim()
}

/**
 * Extract command after @cody or /cody prefix
 */
export function extractCommandAfterCody(comment: string): string {
  const normalized = normalizeComment(comment)
  // Match @cody or /cody at the start, followed by optional whitespace
  const match = normalized.match(/^[\/@]cody\s*(.*)$/)
  if (!match) return ''
  return match[1].trim()
}

/**
 * Discover task ID from previous bot comments on the issue
 */
export function discoverTaskIdFromIssue(issueNumber: string): string | null {
  try {
    const result = execSync(
      `gh issue view "${issueNumber}" --json comments --jq '.comments[].body' 2>/dev/null`,
      { encoding: 'utf-8' },
    )

    // Find "Task created: `YYYYMMDD-description`" pattern
    const match = result.match(/Task created: `([0-9]{6}-[a-zA-Z0-9-]+)`/)
    if (match) {
      return match[1]
    }
    return null
  } catch {
    return null
  }
}

/**
 * Parse dispatch inputs (workflow_dispatch trigger)
 */
export function parseDispatchInputs(): ParseOutputs {
  const taskId = process.env.DISPATCH_TASK_ID || ''

  // Validate task_id is provided
  if (!taskId) {
    return {
      ...getDefaultOutputs(),
      issue_number: '',
      valid: 'false',
    }
  }

  // Validate task-id format
  if (!isValidTaskId(taskId)) {
    console.log(`=== Error: Invalid task-id format: ${taskId} ===`)
    console.log('Expected format: YYMMDD-description (e.g., 260225-auto-90)')
    return {
      ...getDefaultOutputs(),
      issue_number: '',
      valid: 'false',
    }
  }

  const outputs: ParseOutputs = {
    task_id: taskId,
    mode: process.env.DISPATCH_MODE || 'full',
    clarify: process.env.DISPATCH_CLARIFY || 'false',
    dry_run: process.env.DISPATCH_DRY_RUN || 'false',
    from_stage: process.env.DISPATCH_FROM_STAGE || '',
    feedback: process.env.DISPATCH_FEEDBACK || '',
    issue_number: '',
    trigger_type: 'dispatch',
    comment_body: '',
    valid: 'true',
    runner: process.env.DISPATCH_RUNNER || 'self-hosted',
    version: process.env.DISPATCH_VERSION || process.env.CODY_DEFAULT_VERSION || '',
  }

  console.log(
    `=== Parsed dispatch: task_id=${outputs.task_id}, mode=${outputs.mode}, clarify=${outputs.clarify}, runner=${outputs.runner} ===`,
  )

  return outputs
}

/**
 * Parse comment inputs (issue_comment trigger)
 */
export function parseCommentInputs(): ParseOutputs {
  const safetyValid = process.env.SAFETY_VALID
  const safetyReason = process.env.SAFETY_REASON || 'unknown'
  const issueNumber = process.env.ISSUE_NUMBER || ''
  const commentBody = process.env.COMMENT_BODY || ''

  // Safety check first
  if (safetyValid !== 'true') {
    console.log(`=== Safety check failed: ${safetyReason} ===`)
    return {
      ...getDefaultOutputs(),
      issue_number: issueNumber,
      valid: 'false',
    }
  }

  // Initialize outputs
  const outputs: ParseOutputs = {
    ...getDefaultOutputs(),
    issue_number: issueNumber,
    trigger_type: 'comment',
    comment_body: JSON.stringify(commentBody),
  }

  // Discover task-id from previous bot comments on the issue
  if (issueNumber) {
    const discoveredTaskId = discoverTaskIdFromIssue(issueNumber)
    if (discoveredTaskId) {
      console.log(`=== Discovered task-id from issue: ${discoveredTaskId} ===`)
      outputs.task_id = discoveredTaskId
    }
  }

  // Parse command to determine mode and flags
  if (commentBody) {
    const cmdAfterCody = extractCommandAfterCody(commentBody)

    // Detect --local flag anywhere in the command
    const hasLocalFlag = /--local\b/.test(cmdAfterCody)
    if (hasLocalFlag) {
      outputs.runner = 'self-hosted'
      console.log('=== Detected --local flag: will use self-hosted runner ===')
    }

    // Detect --version flag anywhere in the command
    const versionMatch = cmdAfterCody.match(/--version\s+(\S+)/)
    if (versionMatch) {
      outputs.version = versionMatch[1]
      console.log(`=== Detected --version flag: ${outputs.version} ===`)
    }

    // Strip flags from command before mode parsing
    const cmdWithoutFlags = cmdAfterCody
      .replace(/--local\b/g, '')
      .replace(/--github\b/g, '')
      .replace(/--version\s+\S+/g, '')
      .trim()

    if (!cmdWithoutFlags) {
      // @cody alone (or @cody --local) - default to full mode
      outputs.mode = 'full'
      console.log('=== @cody alone - defaulting to full mode ===')
    } else if (APPROVAL_KEYWORDS.includes(cmdWithoutFlags)) {
      // Approval command - use rerun mode
      outputs.mode = 'rerun'
      console.log(`=== Detected approval keyword: ${cmdWithoutFlags} ===`)
    } else if (VALID_MODES.includes(cmdWithoutFlags)) {
      // Explicit mode specified
      outputs.mode = cmdWithoutFlags
      console.log(`=== Detected explicit mode: ${cmdWithoutFlags} ===`)
    } else {
      // Not a known command - default to full (might be task-id or description)
      outputs.mode = 'full'
      console.log('=== Not a known command - defaulting to full mode ===')
    }
  }

  // Validate task-id format if set
  if (outputs.task_id && !isValidTaskId(outputs.task_id)) {
    console.log(`=== Error: Invalid task-id format: ${outputs.task_id} ===`)
    console.log('Expected format: YYMMDD-description (e.g., 260225-auto-90)')
    outputs.task_id = ''
    outputs.valid = 'false'
  } else {
    outputs.valid = 'true'
  }

  console.log('=== Passing comment to orchestrator for parsing ===')

  return outputs
}

/**
 * Get default output values
 */
export function getDefaultOutputs(): ParseOutputs {
  return {
    task_id: '',
    mode: 'full',
    clarify: 'false',
    dry_run: 'false',
    from_stage: '',
    feedback: '',
    issue_number: '',
    trigger_type: '',
    comment_body: '',
    valid: 'false',
    runner: 'self-hosted',
    version: process.env.CODY_DEFAULT_VERSION || '',
  }
}

/**
 * Write outputs to GITHUB_OUTPUT
 */
function writeOutputs(outputs: ParseOutputs): void {
  const githubOutput = process.env.GITHUB_OUTPUT || ''

  if (!githubOutput) {
    console.error('GITHUB_OUTPUT not set!')
    process.exit(1)
  }

  const lines = [
    `task_id=${outputs.task_id}`,
    `mode=${outputs.mode}`,
    `clarify=${outputs.clarify}`,
    `dry_run=${outputs.dry_run}`,
    `from_stage=${outputs.from_stage}`,
    `feedback=${outputs.feedback}`,
    `issue_number=${outputs.issue_number}`,
    `trigger_type=${outputs.trigger_type}`,
    `comment_body=${outputs.comment_body}`,
    `valid=${outputs.valid}`,
    `runner=${outputs.runner}`,
    `version=${outputs.version}`,
  ]

  writeFileSync(githubOutput, lines.join('\n') + '\n')
}

/**
 * Main entry point
 */
function main(): void {
  const eventName = process.env.GITHUB_EVENT_NAME || ''

  let outputs: ParseOutputs

  if (eventName === 'workflow_dispatch') {
    outputs = parseDispatchInputs()
  } else {
    outputs = parseCommentInputs()
  }

  writeOutputs(outputs)
}

// Run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
