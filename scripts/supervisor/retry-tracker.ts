/**
 * @fileType utility
 * @domain supervisor
 * @pattern retry-tracking
 * @ai-summary Tracks retry attempts for the Supervisor by counting tags in issue comments
 */

import { execSync } from 'child_process'

export interface IssueComment {
  body: string
  user: {
    login: string
  }
}

/**
 * Count how many times the supervisor has already retried for this task
 * by scanning issue comments for [supervisor-retry:] tags
 */
export function countRetries(repo: string, issueNumber: string, taskId: string): number {
  try {
    // Get all comments on the issue via gh CLI (paginated)
    const output = execSync(
      `gh api repos/${repo}/issues/${issueNumber}/comments --paginate --jq '.[].body'`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    )

    const comments = output.split('\n').filter((line) => line.trim())
    let count = 0

    for (const body of comments) {
      // Match patterns like "[supervisor-retry: 1/3]" or "[supervisor-retry: 2/3]"
      const hasRetryTag = body.includes('[supervisor-retry:')
      const hasTaskId = body.includes(`\`${taskId}\``)

      if (hasRetryTag && hasTaskId) {
        // Extract the retry number from the tag
        const match = body.match(/\[supervisor-retry:\s*(\d+)\/\d+\]/)
        if (match) {
          count = Math.max(count, parseInt(match[1], 10))
        }
      }
    }

    return count
  } catch (error) {
    // If gh api fails, return 0 (assume no retries)
    console.error('Failed to fetch issue comments:', error)
    return 0
  }
}

/**
 * Format the retry tag for inclusion in comments
 */
export function formatRetryTag(attempt: number, max: number = 3): string {
  return `[supervisor-retry: ${attempt}/${max}]`
}

/**

 * Format comment when max retries are exhausted
 */
export function formatExhaustedComment(taskId: string, retryCount: number): string {
  return `${formatRetryTag(retryCount, 3)}

## Supervisor: Max Retries Exhausted

Supervisor exhausted **${retryCount}/3** retry attempts for \`${taskId}\`.

Manual intervention required. Review the failure history above and either:
- Fix the issue manually and close
- Refine the issue description and run \`/cody rerun ${taskId} --feedback "..."\`
`
}

/**
 * Format the analysis comment with failure analysis and refined rerun command
 */
export function formatAnalysisComment(
  taskId: string,
  retryAttempt: number,
  maxRetries: number,
  failedStage: string,
  errorMessage: string,
  rootCause: string,
  refinedFeedback: string,
): string {
  const retryTag = formatRetryTag(retryAttempt, maxRetries)

  return `${retryTag}

## Failure Analysis

**Failed stage:** \`${failedStage}\`
**Error:** ${errorMessage}

### Root Cause
${rootCause}

### Refined Approach
${refinedFeedback}

---
/cody rerun ${taskId} --feedback "${refinedFeedback.replace(/"/g, '\\\\"')}"
`
}

/**
 * Parse task ID from a Cody failure comment body
 * Matches pattern: `260221-task-name` (6 digit date prefix + hyphen + slug)
 */
export function extractTaskIdFromComment(commentBody: string): string | null {
  // Match task IDs like `260221-user-metrics` or `260221-feature-xyz`
  const match = commentBody.match(/`(\d{6}-[\w-]+)`/)
  return match ? match[1] : null
}

/**
 * Parse the error message from a Cody failure comment
 * Extracts everything after "Pipeline failed for `task-id`:"
 */
export function extractErrorMessage(commentBody: string): string {
  const match = commentBody.match(/Pipeline failed for `[^\`]+`:?\s*(.+)$/s)
  return match ? match[1].trim() : 'Unknown error'
}
