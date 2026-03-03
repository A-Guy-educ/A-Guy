/**
 * @fileType script
 * @domain supervisor
 * @pattern orchestration
 * @ai-summary Main entry point for the Supervisor - analyzes failures and posts refined rerun commands
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import {
  countRetries,
  formatExhaustedComment,
  formatAnalysisComment,
  extractTaskIdFromComment,
  extractErrorMessage,
} from './retry-tracker'
import { analyzeFailure } from './failure-analyzer'
import { classifyRetryability, formatNonRetryableComment } from './retry-classifier'

// Reuse getTaskDir from Cody utils
import { getTaskDir } from '../cody/cody-utils'

const MAX_RETRIES = 3

interface StatusJson {
  state: 'running' | 'completed' | 'failed' | 'timeout'
  stages: Record<string, StageStatus>
}

interface StageStatus {
  state: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

/**
 * Resolve the from_stage for rerun based on failure analysis.
 * This provides deterministic routing before entry.ts applies its own backup logic.
 *
 * Two-layer approach:
 * 1. Supervisor picks root-cause stage (this function)
 * 2. entry.ts may further back up to architect if feedback warrants
 */
function resolveFromStage(failedStage: string): string {
  // Commit failures → rerun commit only (don't back up to architect)
  // Backing up to architect for a commit format error is wasteful
  if (failedStage === 'commit') {
    return 'commit'
  }

  // PR failures → rerun PR only
  if (failedStage === 'pr') {
    return 'pr'
  }

  // Verify failures → the code is bad, rerun from build
  // (entry.ts may further back up to architect if feedback warrants)
  if (failedStage === 'verify') {
    return 'build'
  }

  // Apply-audit failures → rerun from auditor
  if (failedStage === 'apply-audit') {
    return 'auditor'
  }

  // Autofix failures → rerun from build
  if (failedStage === 'autofix') {
    return 'build'
  }

  // Everything else → pass through (entry.ts may further back up)
  return failedStage
}

/**
 * Post a comment to the GitHub issue
 */
function postComment(issueNumber: string, body: string): void {
  try {
    execSync(`gh issue comment ${issueNumber} --body-file -`, {
      input: body,
      stdio: ['pipe', 'inherit', 'inherit'],
      encoding: 'utf-8',
    })
    console.log(`Posted comment to issue #${issueNumber}`)
  } catch (error) {
    console.error(`Failed to post comment to issue ${issueNumber}:`, error)
    throw error
  }
}

/**
 * Get the issue body (original requirement)
 */
function getIssueBody(repo: string, issueNumber: string): string {
  try {
    const output = execSync(`gh api repos/${repo}/issues/${issueNumber} --jq '.body'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    return output.trim() || ''
  } catch (error) {
    console.error('Failed to get issue body:', error)
    return ''
  }
}

/**
 * Read a file from the task directory
 */
function readTaskFile(taskDir: string, filename: string): string {
  const filepath = join(taskDir, filename)
  if (!existsSync(filepath)) {
    return ''
  }
  try {
    return readFileSync(filepath, 'utf-8')
  } catch (error) {
    console.warn(`Failed to read ${filename}:`, error)
    return ''
  }
}

/**
 * Parse status.json to find failed stage
 */
function findFailedStage(status: StatusJson): { stage: string; error: string } | null {
  for (const [stageName, stageStatus] of Object.entries(status.stages)) {
    if (stageStatus.state === 'failed') {
      return {
        stage: stageName,
        error: stageStatus.error || 'Stage failed',
      }
    }
  }
  return null
}

/**
 * Main supervisor logic
 */
async function runSupervisor(): Promise<void> {
  // Get environment variables
  const taskId = process.env.TASK_ID
  const commentBody = process.env.COMMENT_BODY || ''
  const issueNumber = process.env.ISSUE_NUMBER
  const repo = process.env.REPO || ''

  console.log('=== Cody Supervisor ===')
  console.log({ taskId, issueNumber, repo })

  // Validate required inputs
  if (!taskId) {
    const extracted = extractTaskIdFromComment(commentBody)
    if (!extracted) {
      console.log('No task ID found in comment, exiting')
      return
    }
    console.log(`Extracted task ID from comment: ${extracted}`)
  }

  const resolvedTaskId = taskId || extractTaskIdFromComment(commentBody)
  if (!resolvedTaskId || !issueNumber || !repo) {
    console.log('Missing required environment variables, exiting')
    console.log({ resolvedTaskId, issueNumber, repo })
    return
  }

  // Check retry count
  const retryCount = countRetries(repo, issueNumber, resolvedTaskId)
  console.log(`Current retry count: ${retryCount}`)

  if (retryCount >= MAX_RETRIES) {
    console.log('Max retries exhausted')
    const comment = formatExhaustedComment(resolvedTaskId, retryCount)
    postComment(issueNumber, comment)
    return
  }

  const currentAttempt = retryCount + 1
  console.log(`Starting attempt #${currentAttempt}`)

  // Read task files
  const taskDir = getTaskDir(resolvedTaskId)
  console.log(`Task directory: ${taskDir}`)

  // Read status.json
  const statusContent = readTaskFile(taskDir, 'status.json')
  let failedStage = 'unknown'
  let stageError = ''

  if (statusContent) {
    try {
      const status: StatusJson = JSON.parse(statusContent)
      const failed = findFailedStage(status)
      if (failed) {
        failedStage = failed.stage
        stageError = failed.error
      } else {
        // Fallback: use error from comment body
        stageError = extractErrorMessage(commentBody)
      }
    } catch (error) {
      console.warn('Failed to parse status.json:', error)
      stageError = extractErrorMessage(commentBody)
    }
  } else {
    // No status.json, use error from comment body
    stageError = extractErrorMessage(commentBody)
  }

  // Pre-classify retryability BEFORE calling the LLM
  // This saves MiniMax tokens for clearly non-retryable failures
  const classification = classifyRetryability(failedStage, stageError)
  console.log(`Retry classification:`, classification)

  if (!classification.canRetry) {
    console.log(`Failure is non-retryable: ${classification.reason}`)
    const comment = formatNonRetryableComment(
      resolvedTaskId,
      failedStage,
      classification.reason || 'Unknown reason',
    )
    postComment(issueNumber, comment)
    return
  }

  // Read relevant stage output files
  const stageOutput = readTaskFile(taskDir, `${failedStage}.md`) || ''
  const verifyOutput = readTaskFile(taskDir, 'verify.md') || ''
  const previousFeedback = readTaskFile(taskDir, 'rerun-feedback.md') || ''

  // Get original requirement from issue body
  const requirement = getIssueBody(repo, issueNumber)

  // Call failure analyzer
  console.log(`Analyzing failure at stage: ${failedStage}`)
  const analysis = await analyzeFailure({
    requirement,
    errorMessage: stageError,
    failedStage,
    stageOutput,
    verifyOutput,
    previousFeedback: previousFeedback || undefined,
    retryNumber: currentAttempt,
  })

  console.log('Analysis result:', analysis)

  // Format and post comment (for visibility)
  const comment = formatAnalysisComment(
    resolvedTaskId,
    currentAttempt,
    MAX_RETRIES,
    failedStage,
    stageError,
    analysis.rootCause,
    analysis.refinedFeedback,
    analysis.canRetry,
  )

  postComment(issueNumber, comment)

  // If retry is possible, trigger the cody workflow via workflow_dispatch
  // (not via comment - the bot-comment-triggers-bot chain is broken)
  if (analysis.canRetry && analysis.refinedFeedback) {
    console.log(`Triggering cody rerun via workflow_dispatch...`)

    // Use deterministic from_stage routing
    const fromStage = resolveFromStage(failedStage)
    console.log(`Resolved from_stage: ${failedStage} -> ${fromStage}`)

    try {
      const escapedFeedback = analysis.refinedFeedback.replace(/"/g, '\\"')
      execSync(
        `gh workflow run cody.yml -f task_id=${resolvedTaskId} -f mode=rerun -f feedback="${escapedFeedback}" -f from_stage=${fromStage} --repo=${repo}`,
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'inherit'],
        },
      )
      console.log(`Cody workflow triggered for rerun`)
    } catch (error) {
      console.error('Failed to trigger workflow:', error)
      // Still post the comment with the rerun command as fallback
      postComment(
        issueNumber,
        `\n> ℹ️ Could not auto-trigger workflow. You can manually run:\n> \`/cody rerun ${resolvedTaskId} --feedback "${analysis.refinedFeedback.replace(/"/g, '\\"')}"\``,
      )
    }
  }

  console.log('Supervisor completed successfully')
}

// Run main
runSupervisor().catch((error) => {
  console.error('Supervisor failed:', error)

  // Post error comment if we have issue number
  const issueNumber = process.env.ISSUE_NUMBER
  if (issueNumber) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const taskId = process.env.TASK_ID || 'unknown'
    postComment(
      issueNumber,
      `## Supervisor Error

Supervisor encountered an error while analyzing the failure:

\`\`\`
${errorMsg}
\`\`\`

Please run \`/cody rerun ${taskId} --feedback "fix the issue manually"\` to retry manually.`,
    )
  }

  process.exit(1)
})
