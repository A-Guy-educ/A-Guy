/**
 * @fileType utility
 * @domain watchdog
 * @pattern delivery
 * @ai-summary Tiered notification delivery to GitHub issues and Slack
 */

import { execFileSync } from 'child_process'
import type { CheckResult, DeliveryResult, WatchdogContext } from './types'

/**
 * Post a comment to a GitHub issue.
 * Uses --body-file - with stdin to avoid shell injection.
 */
function postComment(issueNumber: string, body: string): void {
  try {
    execFileSync('gh', ['issue', 'comment', issueNumber, '--body-file', '-'], {
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
 * Post a message to Slack via webhook.
 * Uses native fetch() to avoid shell injection via curl.
 */
async function postToSlack(webhookUrl: string, message: string): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
    if (!response.ok) {
      throw new Error(`Slack returned ${response.status}: ${response.statusText}`)
    }
    console.log('Posted message to Slack')
  } catch (error) {
    console.error('Failed to post to Slack:', error)
    // Don't throw - Slack failure shouldn't block the watchdog
  }
}

/**
 * Check if a dedup marker already exists in recent issue comments.
 * Returns true if the marker was posted within the window.
 */
function hasRecentDedupMarker(
  repo: string,
  issueNumber: string,
  marker: string,
  windowMinutes: number = 60,
): boolean {
  try {
    const output = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/issues/${issueNumber}/comments`,
        '--paginate',
        '--jq',
        `.[] | select(.body | contains("${marker}")) | .created_at`,
      ],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    )

    if (!output.trim()) return false

    const comments = output.trim().split('\n').filter(Boolean)
    const now = new Date()

    for (const createdAt of comments) {
      const commentTime = new Date(createdAt)
      const diffMinutes = (now.getTime() - commentTime.getTime()) / (1000 * 60)
      if (diffMinutes < windowMinutes) {
        return true
      }
    }

    return false
  } catch {
    return false // If we can't check, assume no duplicate
  }
}

/**
 * Format check results as a GitHub issue digest
 */
function formatGitHubDigest(results: CheckResult[], timestamp: string): string {
  const critical = results.filter((r) => r.urgency === 'critical')
  const warnings = results.filter((r) => r.urgency === 'warning')
  const info = results.filter((r) => r.urgency === 'info')

  let body = `## 🐕 Watchdog — ${timestamp}\n\n`

  if (critical.length > 0) {
    body += `### 🚨 Action Required\n`
    for (const r of critical) {
      body += `- **${r.title}**: ${r.detail}\n`
    }
    body += '\n'
  }

  if (warnings.length > 0) {
    body += `### ⚠️ Warnings\n`
    for (const r of warnings) {
      body += `- **${r.title}**: ${r.detail}\n`
    }
    body += '\n'
  }

  if (info.length > 0) {
    body += `### ℹ️ Notified\n`
    for (const r of info) {
      body += `- ${r.title}: ${r.detail}\n`
    }
    body += '\n'
  }

  body += `<!-- watchdog:${timestamp} -->`

  return body
}

/**
 * Format check results as a Slack message
 */
function formatSlackMessage(results: CheckResult[]): string {
  const critical = results.filter((r) => r.urgency === 'critical')
  const warnings = results.filter((r) => r.urgency === 'warning')

  const lines: string[] = []

  if (critical.length > 0) {
    lines.push('🚨 *Action Required:*')
    for (const r of critical) {
      lines.push(`• ${r.title}: ${r.detail}`)
    }
  }

  if (warnings.length > 0) {
    lines.push('\n⚠️ *Warnings:*')
    for (const r of warnings) {
      lines.push(`• ${r.title}: ${r.detail}`)
    }
  }

  return lines.join('\n')
}

/**
 * Main delivery function - tiered notification to GitHub issue + Slack
 */
export async function deliver(
  results: CheckResult[],
  context: WatchdogContext,
): Promise<DeliveryResult> {
  const targets: string[] = []
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  // Filter out silent/ok results
  const actionable = results.filter((r) => r.urgency !== 'silent')

  if (actionable.length === 0) {
    console.log('WATCHDOG_OK — No actionable results')
    return { delivered: false, targets: [] }
  }

  console.log(`Delivering ${actionable.length} actionable results`)

  // Always post to GitHub issue if provided
  if (context.watchdogIssue && context.watchdogIssue !== '0') {
    try {
      const digest = formatGitHubDigest(actionable, timestamp)
      postComment(context.watchdogIssue, digest)
      targets.push(`issue:${context.watchdogIssue}`)
    } catch (error) {
      console.error('Failed to post to GitHub issue:', error)
    }
  }

  // Post to Slack for warnings + critical
  const slackWorthy = actionable.filter((r) => r.urgency === 'critical' || r.urgency === 'warning')
  if (slackWorthy.length > 0 && context.slackWebhookUrl) {
    try {
      const message = formatSlackMessage(slackWorthy)
      await postToSlack(context.slackWebhookUrl, message)
      targets.push('slack')
    } catch (error) {
      console.error('Failed to post to Slack:', error)
    }
  }

  // Execute auto-actions
  for (const result of actionable) {
    if (result.autoAction) {
      await executeAutoAction(result.autoAction, context)
    }
  }

  return { delivered: true, targets }
}

/**
 * Execute an auto-action (e.g., trigger a rerun).
 * Uses execFileSync to avoid shell injection.
 */
async function executeAutoAction(
  action: { type: 'trigger-rerun'; taskId: string; fromStage: string; feedback: string },
  context: WatchdogContext,
): Promise<void> {
  if (action.type === 'trigger-rerun') {
    console.log(`Auto-triggering rerun for ${action.taskId} from ${action.fromStage}`)
    try {
      execFileSync(
        'gh',
        [
          'workflow',
          'run',
          'cody.yml',
          '-f',
          `task_id=${action.taskId}`,
          '-f',
          'mode=rerun',
          '-f',
          `feedback=${action.feedback}`,
          '-f',
          `from_stage=${action.fromStage}`,
          `--repo=${context.repo}`,
        ],
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'inherit'],
        },
      )
      console.log(`Triggered rerun for ${action.taskId}`)
    } catch (error) {
      console.error(`Failed to trigger rerun for ${action.taskId}:`, error)
    }
  }
}

/**
 * Check for recent duplicate alerts (for dedup).
 * Requires repo to query the correct GitHub repo.
 */
export function isDuplicateAlert(
  repo: string,
  issueNumber: string,
  marker: string,
  windowMinutes: number = 60,
): boolean {
  return hasRecentDedupMarker(repo, issueNumber, marker, windowMinutes)
}
