/**
 * @fileType utility
 * @domain cody
 * @ai-summary Parse command inputs from dispatch or comment triggers
 */

import { logger } from './logger'
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
  is_pull_request: string
  trigger_type: string
  comment_body: string
  valid: string
  runner: string
  version: string
  fresh: string
}

// Task ID format: YYMMDD-description (e.g., 260225-auto-90)
export const TASK_ID_REGEX = /^[0-9]{6}-[a-zA-Z0-9-]+$/

// Valid pipeline modes
export const VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status']

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
 * Handles both single-line and multiline comments
 */
export function extractCommandAfterCody(comment: string): string {
  const normalized = normalizeComment(comment)
  // Match @cody or /cody at the start, followed by optional whitespace
  // Use 's' flag so . matches newlines for multiline comments
  const match = normalized.match(/^[\/@]cody\s*(.*)$/s)
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
      is_pull_request: process.env.IS_PULL_REQUEST == 'true' ? 'true' : '',
      valid: 'false',
    }
  }

  // Validate task-id format
  if (!isValidTaskId(taskId)) {
    logger.info(`=== Error: Invalid task-id format: ${taskId} ===`)
    logger.info('Expected format: YYMMDD-description (e.g., 260225-auto-90)')
    return {
      ...getDefaultOutputs(),
      issue_number: '',
      is_pull_request: process.env.IS_PULL_REQUEST == 'true' ? 'true' : '',
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
    is_pull_request: process.env.IS_PULL_REQUEST == 'true' ? 'true' : '',
    trigger_type: 'dispatch',
    comment_body: '',
    valid: 'true',
    runner: process.env.DISPATCH_RUNNER || 'github-hosted',
    version: process.env.DISPATCH_VERSION || process.env.CODY_DEFAULT_VERSION || '',
    fresh: process.env.FRESH || '',
  }

  logger.info(
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
    logger.info(`=== Safety check failed: ${safetyReason} ===`)
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

  // Extract command after @cody or /cody (MUST be before flag detection)
  const cmdAfterCody = commentBody ? extractCommandAfterCody(commentBody) : ''

  // Detect --fresh flag - skip taskId discovery if fresh
  const hasFreshFlag = /--fresh\b/.test(cmdAfterCody)
  if (hasFreshFlag) {
    outputs.fresh = 'true'
    logger.info('=== Detected --fresh flag: will create new task ===')
  }

  // Discover task-id from previous bot comments on the issue (skip if fresh)
  if (issueNumber && !hasFreshFlag) {
    const discoveredTaskId = discoverTaskIdFromIssue(issueNumber)
    if (discoveredTaskId) {
      logger.info(`=== Discovered task-id from issue: ${discoveredTaskId} ===`)
      outputs.task_id = discoveredTaskId
    }
  }

  // Parse command to determine mode and flags
  if (cmdAfterCody) {
    // Detect --local flag anywhere in the command
    const hasLocalFlag = /--local\b/.test(cmdAfterCody)
    if (hasLocalFlag) {
      outputs.runner = 'self-hosted'
      logger.info('=== Detected --local flag: will use self-hosted runner ===')
    }

    // Detect --github-hosted flag anywhere in the command
    const hasGithubHostedFlag = /--github-hosted\b/.test(cmdAfterCody)
    if (hasGithubHostedFlag) {
      outputs.runner = 'github-hosted'
      logger.info('=== Detected --github-hosted flag: will use GitHub-hosted runner ===')
    }

    // Detect --version flag anywhere in the command
    const versionMatch = cmdAfterCody.match(/--version\s+(\S+)/)
    if (versionMatch) {
      outputs.version = versionMatch[1]
      logger.info(`=== Detected --version flag: ${outputs.version} ===`)
    }

    // Detect --from flag (both --from=stage and --from stage syntax)
    const fromMatch = cmdAfterCody.match(/--from[=\s](\S+)/)
    if (fromMatch) {
      outputs.from_stage = fromMatch[1]
      logger.info(`=== Detected --from flag: ${outputs.from_stage} ===`)
    }

    // Detect --feedback flag (both --feedback=text and --feedback text syntax)
    const feedbackMatch = cmdAfterCody.match(/--feedback[=\s](\S+)/)
    if (feedbackMatch) {
      outputs.feedback = feedbackMatch[1]
      logger.info(`=== Detected --feedback flag: ${outputs.feedback} ===`)
    }

    // Strip flags from command before mode parsing
    const cmdWithoutFlags = cmdAfterCody
      .replace(/--local\b/g, '')
      .replace(/--github\b/g, '')
      .replace(/--github-hosted\b/g, '')
      .replace(/--version\s+\S+/g, '')
      .replace(/--fresh\b/g, '')
      .replace(/--from[=\s]\S+/g, '')
      .replace(/--feedback[=\s]\S+/g, '')
      .trim()

    if (!cmdWithoutFlags) {
      // @cody alone (or @cody --local) - default to full mode
      outputs.mode = 'full'
      logger.info('=== @cody alone - defaulting to full mode ===')
    } else {
      // Check if the first word is a known mode or approval keyword
      // This handles commands like "/cody rerun 260218-task" where extra args follow the mode
      const firstWord = cmdWithoutFlags.split(/[\s\n]/)[0]
      if (APPROVAL_KEYWORDS.includes(firstWord)) {
        // Approval command with optional answer - use rerun mode
        outputs.mode = 'rerun'
        logger.info(`=== Detected approval keyword: ${firstWord} ===`)
      } else if (VALID_MODES.includes(firstWord)) {
        // First word is a valid mode (e.g., "rerun", "spec", "impl")
        outputs.mode = firstWord
        logger.info(`=== Detected explicit mode: ${firstWord} ===`)
      } else {
        // Not a known command - default to full (might be task-id or description)
        outputs.mode = 'full'
        logger.info('=== Not a known command - defaulting to full mode ===')
      }
    }
  }

  // Validate task-id format if set
  if (outputs.task_id && !isValidTaskId(outputs.task_id)) {
    logger.info(`=== Error: Invalid task-id format: ${outputs.task_id} ===`)
    logger.info('Expected format: YYMMDD-description (e.g., 260225-auto-90)')
    outputs.task_id = ''
    outputs.valid = 'false'
  } else {
    outputs.valid = 'true'
  }

  logger.info('=== Passing comment to orchestrator for parsing ===')

  return outputs
}

/**
 * Parse PR review inputs (pull_request_review trigger)
 * Automatically routes to fix mode with the review feedback as context.
 */
export function parsePRReviewInputs(): ParseOutputs {
  const prNumber = process.env.PR_NUMBER || process.env.ISSUE_NUMBER || ''
  const reviewState = process.env.PR_REVIEW_STATE || ''
  const reviewBody = process.env.PR_REVIEW_BODY || ''

  logger.info(`=== PR Review trigger: PR #${prNumber}, state=${reviewState} ===`)

  // Only process "changes_requested" reviews
  if (reviewState !== 'changes_requested') {
    logger.info(`=== Ignoring PR review with state: ${reviewState} ===`)
    return {
      ...getDefaultOutputs(),
      issue_number: prNumber,
      is_pull_request: 'true',
      valid: 'false',
    }
  }

  // Discover existing task ID from PR comments
  let taskId = ''
  if (prNumber) {
    const discoveredTaskId = discoverTaskIdFromIssue(prNumber)
    if (discoveredTaskId) {
      logger.info(`=== Discovered task-id from PR: ${discoveredTaskId} ===`)
      taskId = discoveredTaskId
    }
  }

  if (!taskId) {
    logger.info('=== No task-id found on PR — cannot run fix mode ===')
    return {
      ...getDefaultOutputs(),
      issue_number: prNumber,
      is_pull_request: 'true',
      valid: 'false',
    }
  }

  const outputs: ParseOutputs = {
    task_id: taskId,
    mode: 'fix',
    clarify: 'false',
    dry_run: 'false',
    from_stage: '',
    feedback: reviewBody || 'Changes requested via PR review',
    issue_number: prNumber,
    is_pull_request: 'true',
    trigger_type: 'pr_review',
    comment_body: '',
    valid: 'true',
    runner: 'github-hosted',
    version: process.env.CODY_DEFAULT_VERSION || '',
    fresh: '',
  }

  logger.info(
    `=== PR review → fix mode: task_id=${outputs.task_id}, feedback=${outputs.feedback.slice(0, 100)}... ===`,
  )

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
    is_pull_request: process.env.IS_PULL_REQUEST == 'true' ? 'true' : '',
    trigger_type: '',
    comment_body: '',
    valid: 'false',
    runner: 'github-hosted',
    version: process.env.CODY_DEFAULT_VERSION || '',
    fresh: '',
  }
}

/**
 * Write outputs to GITHUB_OUTPUT
 */
function writeOutputs(outputs: ParseOutputs): void {
  const githubOutput = process.env.GITHUB_OUTPUT || ''

  if (!githubOutput) {
    logger.error('GITHUB_OUTPUT not set!')
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
    `is_pull_request=${outputs.is_pull_request}`,
    `trigger_type=${outputs.trigger_type}`,
    `comment_body=${outputs.comment_body}`,
    `valid=${outputs.valid}`,
    `runner=${outputs.runner}`,
    `version=${outputs.version}`,
    `fresh=${outputs.fresh}`,
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
  } else if (eventName === 'pull_request_review') {
    outputs = parsePRReviewInputs()
  } else {
    outputs = parseCommentInputs()
  }

  writeOutputs(outputs)
}

// Run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
