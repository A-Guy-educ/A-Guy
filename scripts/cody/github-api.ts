/**
 * @fileType utility
 * @domain cody | github
 * @pattern github-api
 * @ai-summary GitHub API helpers extracted from cody-utils for better modularity
 */

import { logger } from './logger'
import { getComplexityTier } from './pipeline-utils'
import { execFileSync } from 'child_process'

// ============================================================================
// Constants
// ============================================================================

const GH_API_TIMEOUT = 30_000 // 30 seconds max per gh CLI call

// ============================================================================
// Synchronous Sleep Helper
// ============================================================================

/**
 * Synchronous sleep using Atomics.wait — blocks thread without busy-looping.
 * Used for retry delays in synchronous fire-and-forget functions.
 */
export function syncSleep(ms: number): void {
  const buf = new SharedArrayBuffer(4)
  const arr = new Int32Array(buf)
  Atomics.wait(arr, 0, 0, ms)
}

// ============================================================================
// GitHub API Functions
// ============================================================================

/**
 * Post a comment to an issue.
 * Uses GH_PAT when available so comments are posted under the PAT identity,
 * which allows them to trigger other workflows (e.g. supervisor.yml).
 * Comments posted with GITHUB_TOKEN do NOT trigger other workflows due to
 * GitHub Actions security restrictions.
 */
export function postComment(issueNumber: number, body: string): void {
  if (!issueNumber) return

  // Use GH_PAT if available so the comment triggers other workflows (supervisor)
  const ghToken = process.env.GH_PAT?.trim() || process.env.GH_TOKEN
  const env = ghToken ? { ...process.env, GH_TOKEN: ghToken } : process.env

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      execFileSync('gh', ['issue', 'comment', String(issueNumber), '--body-file', '-'], {
        input: body,
        stdio: ['pipe', 'inherit', 'inherit'],
        env,
        timeout: GH_API_TIMEOUT,
      })
      return // Success
    } catch (error) {
      if (attempt === 0) {
        logger.warn(
          { err: error },
          `postComment attempt 1 failed for issue ${issueNumber}, retrying...`,
        )
        // Brief synchronous delay before retry (2 seconds)
        syncSleep(2000)
      } else {
        logger.error(
          { err: error },
          `Failed to post comment to issue ${issueNumber} after 2 attempts`,
        )
      }
    }
  }
}

/**
 * Get issue body
 */
export function getIssueBody(issueNumber: number): string | null {
  if (!issueNumber) return null

  try {
    const output = execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'body', '--jq', '.body'],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    return output.trim() || null
  } catch (error) {
    logger.error({ err: error }, `Failed to get issue body for #${issueNumber}:`)
    return null
  }
}

/**
 * Get full issue data (body and title)
 */
export function getIssue(issueNumber: number): { body: string | null; title: string | null } {
  if (!issueNumber) return { body: null, title: null }

  try {
    const output = execFileSync(
      'gh',
      [
        'issue',
        'view',
        String(issueNumber),
        '--json',
        'body,title',
        '--jq',
        '{body: .body, title: .title}',
      ],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    const data = JSON.parse(output)
    return {
      body: data.body?.trim() || null,
      title: data.title?.trim() || null,
    }
  } catch (error) {
    logger.error({ err: error }, `Failed to get issue #${issueNumber}:`)
    return { body: null, title: null }
  }
}

/**
 * Get issue title
 */
export function getIssueTitle(issueNumber: number): string | null {
  if (!issueNumber) return null

  try {
    const output = execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'title', '--jq', '.title'],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    return output.trim() || null
  } catch (error) {
    logger.error({ err: error }, `Failed to get issue title for #${issueNumber}:`)
    return null
  }
}

/**
 * Edit an existing comment
 * R6: Rewrote to use stdin instead of temp files for atomicity
 */
export function editComment(commentId: string, body: string): void {
  if (!commentId) return

  // R6: Replace 'OWNER/REPO' fallback with early return
  const repo = process.env.GITHUB_REPOSITORY
  if (!repo) {
    logger.error('editComment: GITHUB_REPOSITORY not set, skipping')
    return
  }

  try {
    // Use --input - to pipe body via stdin (atomic, no temp file)
    execFileSync(
      'gh',
      ['api', `repos/${repo}/issues/comments/${commentId}`, '-X', 'PATCH', '--input', '-'],
      {
        input: JSON.stringify({ body }),
        stdio: ['pipe', 'inherit', 'inherit'],
        timeout: GH_API_TIMEOUT,
      },
    )
  } catch (error) {
    logger.error({ err: error }, `Failed to edit comment ${commentId}:`)
  }
}

/**
 * Get the latest comment on an issue (not from the bot, not a /cody command)
 */
export function getLatestIssueComment(issueNumber: number, excludeAuthor?: string): string | null {
  if (!issueNumber) return null

  try {
    const exclude = (excludeAuthor || 'github-actions[bot]').replace(/[^a-zA-Z0-9\[\]_\-]/g, '')
    // Get comments, exclude bot and /cody commands, return the latest plain-text answer
    const output = execFileSync(
      'gh',
      [
        'issue',
        'view',
        String(issueNumber),
        '--json',
        'comments',
        '--jq',
        `[.comments[] | select(.author.login != "${exclude}" and (.body | startswith("/cody") | not))] | last | .body`,
      ],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    return output.trim() || null
  } catch {
    return null
  }
}

/**
 * Get the latest approval/rejection command on an issue
 * Used by gate approval to detect /cody approve or /cody reject
 */
export function getLatestApprovalComment(
  issueNumber: number,
  excludeAuthor?: string,
): string | null {
  if (!issueNumber) return null

  try {
    const exclude = (excludeAuthor || 'github-actions[bot]').replace(/[^a-zA-Z0-9\[\]_\-]/g, '')
    // Get comments from users (not bot) that contain approval/rejection keywords
    // Matches: approve, approved, yes, go, proceed, y, continue, reject, rejected, no, cancel, stop, n
    // Uses 'i' flag for case-insensitive matching
    const output = execFileSync(
      'gh',
      [
        'issue',
        'view',
        String(issueNumber),
        '--json',
        'comments',
        '--jq',
        `[.comments[] | select(.author.login != "${exclude}" and (.body | test("^[/@]cody\\s+(approve|approved|yes|go|proceed|y|continue|reject|rejected|no|cancel|stop|n)(\\s|$)"; "i")))] | last | .body`,
      ],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    return output.trim() || null
  } catch {
    return null
  }
}

/**
 * Canonical regex for extracting task-ID from "Task created: `NNNNNN-slug`" marker
 * Used by both parse-inputs.sh and TypeScript implementations
 */
export const TASK_ID_MARKER_REGEX = /Task created: `(\d{6}-[a-zA-Z0-9-]+)`/

/**
 * Extract task-ID from text using the canonical marker format
 * Returns null if no valid task-ID found
 */
export function extractTaskIdFromMarker(text: string): string | null {
  const match = text.match(TASK_ID_MARKER_REGEX)
  return match ? match[1] : null
}

/**
 * Discover task-id from a previous Cody run by parsing bot comments on the issue.
 * Looks for "Task created: `XXXXXX-task-name`" in any comment.
 */
export function discoverTaskIdFromIssue(issueNumber: number): string | null {
  if (!issueNumber) return null

  try {
    // Get all comments (don't filter by author - matches parse-inputs.sh behavior)
    // Use execFileSync for defense against shell injection
    const output = execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'comments', '--jq', '.comments[].body'],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    // Use canonical task-ID marker regex
    const match = output.match(TASK_ID_MARKER_REGEX)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ============================================================================
// PR Review Functions
// ============================================================================

/**
 * Fetch PR review feedback: the latest "changes requested" review body +
 * all inline review comments. Returns formatted markdown suitable for
 * writing to rerun-feedback.md.
 *
 * Uses `gh api` to fetch PR reviews and review comments.
 * Returns null if no change-request reviews or comments found.
 */
export function getPRReviewFeedback(prNumber: number): string | null {
  if (!prNumber) return null

  const repo = process.env.GITHUB_REPOSITORY
  if (!repo) {
    logger.warn('getPRReviewFeedback: GITHUB_REPOSITORY not set')
    return null
  }

  const sections: string[] = []

  // 1. Get the latest "changes_requested" review body
  try {
    const reviewsOutput = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/pulls/${prNumber}/reviews`,
        '--jq',
        '[.[] | select(.state == "CHANGES_REQUESTED")] | last | {body: .body, user: .user.login, submitted_at: .submitted_at}',
      ],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    const review = JSON.parse(reviewsOutput.trim())
    if (review?.body) {
      sections.push(`## Change Request from @${review.user}\n\n${review.body}`)
    }
  } catch (error) {
    logger.warn({ err: error }, `Failed to fetch PR reviews for #${prNumber}`)
  }

  // 2. Get inline review comments (code-level feedback)
  try {
    const commentsOutput = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/pulls/${prNumber}/comments`,
        '--jq',
        '[.[] | {path: .path, line: .line, body: .body, user: .user.login}]',
      ],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    const comments = JSON.parse(commentsOutput.trim()) as Array<{
      path: string
      line: number | null
      body: string
      user: string
    }>

    if (comments.length > 0) {
      const commentLines = comments.map((c) => {
        const location = c.line ? `${c.path}:${c.line}` : c.path
        return `- **${location}** (@${c.user}): ${c.body}`
      })
      const header = '## Inline Comments'
      sections.push(header + '\n\n' + commentLines.join('\n'))
    }
  } catch (error) {
    logger.warn({ err: error }, `Failed to fetch PR review comments for #${prNumber}`)
  }

  if (sections.length === 0) return null

  return sections.join('\n\n')
}

/**
 * Discover the PR number associated with the current branch.
 * Uses `gh pr view` which finds the PR for the current HEAD branch.
 * Returns null if no PR exists.
 */
export function getCurrentPRNumber(): number | null {
  try {
    const output = execFileSync('gh', ['pr', 'view', '--json', 'number', '--jq', '.number'], {
      encoding: 'utf-8',
      timeout: GH_API_TIMEOUT,
    })
    const num = parseInt(output.trim(), 10)
    return isNaN(num) ? null : num
  } catch {
    return null
  }
}

/**
 * Discover the task ID from a PR by checking bot comments on the PR.
 * PRs are issues in GitHub's API, so we can reuse discoverTaskIdFromIssue.
 */
export function discoverTaskIdFromPR(prNumber: number): string | null {
  return discoverTaskIdFromIssue(prNumber)
}

/**
 * Get the issue number linked to a PR via "Closes #XXX" in the PR description.
 * Used in fix mode to find the original issue from a PR.
 */
export function getLinkedIssueFromPR(prNumber: number): number | null {
  if (!prNumber) return null
  try {
    const output = execFileSync(
      'gh',
      [
        'pr',
        'view',
        String(prNumber),
        '--json',
        'closingIssuesReferences',
        '--jq',
        '.closingIssuesReferences[0].number',
      ],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    ).trim()
    return output ? parseInt(output, 10) : null
  } catch {
    return null
  }
}

/**
 * Extract the gate comment body from a gate-*.md file.
 * The file is written as: `# Gate Request\n\n${formatGateComment(...)}\n`
 * This function strips the `# Gate Request\n\n` prefix and trims trailing whitespace,
 * returning the full comment body ready to post to GitHub.
 */
export function extractGateCommentBody(fileContent: string): string {
  return fileContent.replace(/^# Gate Request\n\n/, '').trim()
}

/**
 * Ensure the "Task created" marker comment exists on the issue.
 *
 * This is critical for task-id discovery: when someone runs `/cody` on an issue,
 * the pipeline discovers the existing task-id by searching for a bot comment
 * containing "Task created: `XXXXXX-task-name`". Without this marker,
 * subsequent runs auto-generate a new task-id instead of reusing the existing one.
 */
export function ensureTaskMarkerComment(
  issueNumber: number,
  taskId: string,
  mode?: string,
  runUrl?: string,
): void {
  if (!issueNumber || !taskId) return

  // Check if marker already exists for ANY task-id on this issue
  const existingTaskId = discoverTaskIdFromIssue(issueNumber)
  if (existingTaskId) {
    if (existingTaskId === taskId) {
      logger.info(`Task marker already exists on issue #${issueNumber} for ${taskId}`)
    } else {
      logger.info(
        `Task marker exists on issue #${issueNumber} for ${existingTaskId} (current: ${taskId})`,
      )
    }
    // Post a lightweight "run started" comment so every invocation has a visible run link
    if (runUrl) {
      const modeLine = mode ? ` (\`${mode}\` mode)` : ''
      postComment(
        issueNumber,
        `🔄 Cody re-run for \`${existingTaskId}\`${modeLine}\nRun: ${runUrl}`,
      )
    }
    return
  }

  // Build comment with mode and run URL
  const modeLine = mode ? ` (\`${mode}\` mode)` : ''
  const runLine = runUrl ? `\nRun: ${runUrl}` : ''

  // No marker found — post one
  logger.info(`Posting task marker comment on issue #${issueNumber} for ${taskId}`)
  postComment(
    issueNumber,
    `🎯 Task created: \`${taskId}\`${modeLine}${runLine}\n\nCody will now process this task.`,
  )
}

// ============================================================================
// Label Functions
// ============================================================================

/**
 * Add a label to an issue
 */
export function addIssueLabel(issueNumber: number, label: string): void {
  if (!issueNumber || !label) return

  try {
    execFileSync('gh', ['issue', 'edit', String(issueNumber), '--add-label', label], {
      stdio: ['inherit', 'inherit', 'inherit'],
      timeout: GH_API_TIMEOUT,
    })
    logger.info(`  Added label "${label}" to issue #${issueNumber}`)
  } catch (error) {
    logger.error({ err: error }, `Failed to add label "${label}" to issue ${issueNumber}:`)
  }
}

/**
 * Remove a label from an issue
 */
export function removeIssueLabel(issueNumber: number, label: string): void {
  if (!issueNumber || !label) return

  try {
    execFileSync('gh', ['issue', 'edit', String(issueNumber), '--remove-label', label], {
      stdio: ['inherit', 'inherit', 'inherit'],
      timeout: GH_API_TIMEOUT,
    })
    logger.info(`  Removed label "${label}" from issue #${issueNumber}`)
  } catch (error) {
    logger.error({ err: error }, `Failed to remove label "${label}" from issue ${issueNumber}:`)
  }
}

/**
 * Gate labels for visibility in dashboard
 */
export const GATE_LABELS = {
  HARD_STOP: 'hard-stop',
  RISK_GATED: 'risk-gated',
} as const

// ============================================================================
// Lifecycle and Classification Label Management
// ============================================================================

/**
 * Lifecycle labels - mutually exclusive, set by pipeline state machine
 */
export const LIFECYCLE_LABELS = [
  'cody:planning',
  'cody:building',
  'cody:review',
  'cody:done',
  'cody:failed',
] as const

/**
 * Task type labels - set by taskify based on task_type field
 */
export const TASK_TYPE_LABELS = [
  'type:bug',
  'type:feature',
  'type:refactor',
  'type:docs',
  'type:ops',
] as const

/**
 * Risk level labels - set by taskify based on risk_level field
 */
export const RISK_LABELS = ['risk:high', 'risk:medium', 'risk:low'] as const

/**
 * Complexity labels - set by taskify based on complexity score
 * 1-30 = simple, 31-60 = moderate, 61-100 = complex
 */
export const COMPLEXITY_LABELS = [
  'complexity:simple',
  'complexity:moderate',
  'complexity:complex',
] as const

/**
 * Domain labels - set by taskify based on primary_domain field
 */
export const DOMAIN_LABELS = [
  'domain:backend',
  'domain:frontend',
  'domain:infra',
  'domain:llm',
  'domain:data',
  'domain:devops',
  'domain:product',
] as const

/**
 * Profile labels - set by resolve-profile post-action
 */
export const PROFILE_LABELS = ['profile:lightweight', 'profile:standard'] as const

/**
 * Set a lifecycle label - adds new label and removes all other lifecycle labels
 * Fire-and-forget: errors are logged but never thrown
 */
export function setLifecycleLabel(issueNumber: number, label: string): void {
  if (!issueNumber || !label) return

  // Validate the label is a lifecycle label
  if (!LIFECYCLE_LABELS.includes(label as (typeof LIFECYCLE_LABELS)[number])) {
    logger.error(`Invalid lifecycle label: ${label}`)
    return
  }

  // Get all OTHER lifecycle labels to remove (mutual exclusion)
  const labelsToRemove = LIFECYCLE_LABELS.filter((l) => l !== label)

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Remove all other lifecycle labels, add the new one
      const args = [
        'issue',
        'edit',
        String(issueNumber),
        '--remove-label',
        labelsToRemove.join(','),
        '--add-label',
        label,
      ]
      execFileSync('gh', args, {
        stdio: ['inherit', 'inherit', 'inherit'],
        timeout: GH_API_TIMEOUT,
      })
      logger.info(`  Set lifecycle label "${label}" on issue #${issueNumber}`)
      return // Success
    } catch (error) {
      if (attempt === 0) {
        logger.warn(
          { err: error },
          `setLifecycleLabel attempt 1 failed for issue ${issueNumber}, retrying...`,
        )
        syncSleep(2000)
      } else {
        logger.error(
          { err: error },
          `Failed to set lifecycle label "${label}" on issue ${issueNumber} after 2 attempts`,
        )
      }
    }
  }
}

/**
 * Set classification labels from task.json fields
 * Maps: task_type, risk_level, complexity, primary_domain
 * Fire-and-forget: errors are logged but never thrown
 */
export function setClassificationLabels(
  issueNumber: number,
  taskDef: {
    task_type?: string
    risk_level?: string
    complexity?: number
    primary_domain?: string
  },
): void {
  if (!issueNumber) return
  if (!taskDef) {
    logger.error(`No task definition provided for issue #${issueNumber}`)
    return
  }

  const labels: string[] = []

  // Map task_type to type:* label
  if (taskDef.task_type) {
    const typeMap: Record<string, string> = {
      fix_bug: 'type:bug',
      implement_feature: 'type:feature',
      refactor: 'type:refactor',
      docs: 'type:docs',
      ops: 'type:ops',
      spec_only: 'type:feature', // treat spec as feature
      research: 'type:ops',
    }
    const label = typeMap[taskDef.task_type]
    if (label && TASK_TYPE_LABELS.includes(label as (typeof TASK_TYPE_LABELS)[number])) {
      labels.push(label)
    }
  }

  // Map risk_level to risk:* label
  if (taskDef.risk_level) {
    const riskLabel = `risk:${taskDef.risk_level}`
    if (RISK_LABELS.includes(riskLabel as (typeof RISK_LABELS)[number])) {
      labels.push(riskLabel)
    }
  }

  // Map complexity to complexity:* label (uses getComplexityTier for single source of truth)
  if (taskDef.complexity !== undefined) {
    const tier = getComplexityTier(taskDef.complexity)
    let label: string
    if (tier === 'trivial' || tier === 'simple') {
      label = 'complexity:simple'
    } else if (tier === 'moderate') {
      label = 'complexity:moderate'
    } else {
      // complex or very_complex
      label = 'complexity:complex'
    }
    labels.push(label)
  }

  // Map primary_domain to domain:* label
  if (taskDef.primary_domain) {
    const domainLabel = `domain:${taskDef.primary_domain}`
    if (DOMAIN_LABELS.includes(domainLabel as (typeof DOMAIN_LABELS)[number])) {
      labels.push(domainLabel)
    }
  }

  if (labels.length === 0) {
    logger.info(`No classification labels to set for issue #${issueNumber}`)
    return
  }

  // Build list of stale labels to remove (old labels in same category as new ones)
  const labelsToRemove: string[] = []
  const allCategoryLabels: ReadonlyArray<readonly string[]> = [
    TASK_TYPE_LABELS,
    RISK_LABELS,
    COMPLEXITY_LABELS,
    DOMAIN_LABELS,
  ]
  for (const category of allCategoryLabels) {
    const newInCategory = labels.filter((l) => category.includes(l as never))
    if (newInCategory.length > 0) {
      // Remove all OTHER labels in this category
      const stale = category.filter((l) => !newInCategory.includes(l))
      labelsToRemove.push(...stale)
    }
  }

  // Step 1: Add new labels (critical — fail on error)
  try {
    execFileSync('gh', ['issue', 'edit', String(issueNumber), '--add-label', labels.join(',')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: GH_API_TIMEOUT,
    })
    logger.info(`  Set classification labels [${labels.join(', ')}] on issue #${issueNumber}`)
  } catch (error) {
    logger.error({ err: error }, `Failed to set classification labels on issue ${issueNumber}:`)
  }

  // Step 2: Remove stale labels in a separate call.
  // This is separate because `gh issue edit --remove-label` fails if ANY label in the
  // list doesn't exist on the repo. By separating add/remove, a remove failure
  // doesn't prevent the add from succeeding.
  if (labelsToRemove.length > 0) {
    try {
      execFileSync(
        'gh',
        ['issue', 'edit', String(issueNumber), '--remove-label', labelsToRemove.join(',')],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: GH_API_TIMEOUT,
        },
      )
    } catch {
      // Silently ignore — labels may not exist on the repo or issue.
      // This is expected for newly added domain/category labels.
    }
  }
}

/**
 * Set profile label - adds new profile and removes the other
 * Fire-and-forget: errors are logged but never thrown
 */
export function setProfileLabel(
  issueNumber: number,
  profile: 'lightweight' | 'standard' | 'turbo',
): void {
  if (!issueNumber || !profile) return

  const label = `profile:${profile}`
  const otherLabel = profile === 'lightweight' ? 'profile:standard' : 'profile:lightweight'

  try {
    execFileSync(
      'gh',
      ['issue', 'edit', String(issueNumber), '--remove-label', otherLabel, '--add-label', label],
      { stdio: ['inherit', 'inherit', 'inherit'], timeout: GH_API_TIMEOUT },
    )
    logger.info(`  Set profile label "${label}" on issue #${issueNumber}`)
  } catch (error) {
    logger.error({ err: error }, `Failed to set profile label on issue ${issueNumber}:`)
  }
}

/**
 * Close an issue with a reason
 * Fire-and-forget: errors are logged but never thrown
 */
export function closeIssue(
  issueNumber: number,
  reason: 'completed' | 'not planned' = 'completed',
): void {
  if (!issueNumber) return

  try {
    execFileSync('gh', ['issue', 'close', String(issueNumber), '--reason', reason], {
      stdio: ['inherit', 'inherit', 'inherit'],
      timeout: GH_API_TIMEOUT,
    })
    logger.info(`  Closed issue #${issueNumber} (${reason})`)
  } catch (error) {
    logger.error({ err: error }, `Failed to close issue ${issueNumber}:`)
  }
}

/**
 * Close PR associated with an issue and delete the branch
 * Uses --delete-branch to remove both local and remote branches
 * Fire-and-forget: errors are logged but never thrown
 */
export function closeLinkedPR(issueNumber: number): boolean {
  if (!issueNumber) return false

  try {
    // Find PR linked to this issue
    const listResult = execFileSync(
      'gh',
      ['pr', 'list', '--search', `closes:#${issueNumber}`, '--json', 'number'],
      { encoding: 'utf-8', timeout: GH_API_TIMEOUT },
    )
    const prs = JSON.parse(listResult) as { number: number }[]

    if (prs.length === 0) {
      logger.info(`  No PR found for issue #${issueNumber}`)
      return false
    }

    const prNumber = prs[0].number

    // Close PR and delete branch in one command
    execFileSync('gh', ['pr', 'close', String(prNumber), '--delete-branch'], {
      stdio: ['inherit', 'inherit', 'inherit'],
      timeout: GH_API_TIMEOUT,
    })
    logger.info(`  ✅ Closed PR #${prNumber} and deleted branch`)
    return true
  } catch (error) {
    logger.error({ err: error }, `Failed to close PR for issue ${issueNumber}:`)
    return false
  }
}

/**
 * Close an issue, its associated PR, and delete the branch
 * This is a convenience function that combines closeIssue and closeLinkedPR
 * Use this when you want to close an issue and clean up the PR/branch in one action
 * Fire-and-forget: errors are logged but never thrown
 */
export function closeIssueWithCleanup(
  issueNumber: number,
  reason: 'completed' | 'not planned' = 'completed',
): void {
  if (!issueNumber) return

  // First close the PR and delete the branch
  closeLinkedPR(issueNumber)

  // Then close the issue
  closeIssue(issueNumber, reason)
}
