/**
 * @fileType utility
 * @domain cody | github
 * @pattern github-api
 * @ai-summary GitHub API helpers extracted from cody-utils for better modularity
 */

import { execFileSync } from 'child_process'

// ============================================================================
// GitHub API Functions
// ============================================================================

/**
 * Post a comment to an issue
 */
export function postComment(issueNumber: number, body: string): void {
  if (!issueNumber) return

  try {
    // Use --body-file - to pipe body via stdin, preserving newlines and special characters
    // Use execFileSync for defense against shell injection
    execFileSync('gh', ['issue', 'comment', String(issueNumber), '--body-file', '-'], {
      input: body,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
  } catch (error) {
    console.error(`Failed to post comment to issue ${issueNumber}:`, error)
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
      { encoding: 'utf-8' },
    )
    return output.trim() || null
  } catch (error) {
    console.error(`Failed to get issue body for #${issueNumber}:`, error)
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
      { encoding: 'utf-8' },
    )
    const data = JSON.parse(output)
    return {
      body: data.body?.trim() || null,
      title: data.title?.trim() || null,
    }
  } catch (error) {
    console.error(`Failed to get issue #${issueNumber}:`, error)
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
      { encoding: 'utf-8' },
    )
    return output.trim() || null
  } catch (error) {
    console.error(`Failed to get issue title for #${issueNumber}:`, error)
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
    console.error('editComment: GITHUB_REPOSITORY not set, skipping')
    return
  }

  try {
    // Use --input - to pipe body via stdin (atomic, no temp file)
    execFileSync(
      'gh',
      ['api', `repos/${repo}/issues/comments/${commentId}`, '-X', 'PATCH', '--input', '-'],
      { input: JSON.stringify({ body }), stdio: ['pipe', 'inherit', 'inherit'] },
    )
  } catch (error) {
    console.error(`Failed to edit comment ${commentId}:`, error)
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
      { encoding: 'utf-8' },
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
    // Get comments from users (not bot) that contain approve/reject
    const output = execFileSync(
      'gh',
      [
        'issue',
        'view',
        String(issueNumber),
        '--json',
        'comments',
        '--jq',
        `[.comments[] | select(.author.login != "${exclude}" and (.body | test("^/cody (approve|reject)")))] | last | .body`,
      ],
      { encoding: 'utf-8' },
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
      { encoding: 'utf-8' },
    )
    // Use canonical task-ID marker regex
    const match = output.match(TASK_ID_MARKER_REGEX)
    return match ? match[1] : null
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
      console.log(`Task marker already exists on issue #${issueNumber} for ${taskId}`)
    } else {
      console.log(
        `Task marker exists on issue #${issueNumber} for ${existingTaskId} (current: ${taskId})`,
      )
    }
    return
  }

  // Build comment with mode and run URL
  const modeLine = mode ? ` (\`${mode}\` mode)` : ''
  const runLine = runUrl ? `\nRun: ${runUrl}` : ''

  // No marker found — post one
  console.log(`Posting task marker comment on issue #${issueNumber} for ${taskId}`)
  postComment(
    issueNumber,
    `🎯 Task created: \`${taskId}\`${modeLine}${runLine}\n\nCody will now process this task.`,
  )
}
