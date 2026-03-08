/**
 * @fileType utility
 * @domain inspector
 * @pattern create-issue-action
 * @ai-summary Creates GitHub issues for audit improvements
 */

import type { ActionRequest, InspectorContext } from '../../../../core/types'
import type { Improvement } from '../types'

/**
 * Create an action to post an improvement as a GitHub issue.
 */
export function createImprovementIssueAction(
  taskId: string,
  improvement: Improvement,
  ctx: InspectorContext,
): ActionRequest {
  const dedupKey = `audit:${taskId}:${improvement.title}`

  return {
    plugin: 'cody-audit',
    type: 'create-issue',
    target: taskId,
    urgency: 'info',
    title: `[audit] ${improvement.title}`,
    detail: improvement.rationale,
    dedupKey,
    dedupWindowMinutes: 24 * 60, // 24 hours - prevent dupes across cycles
    execute: async () => {
      const body = buildIssueBody(taskId, improvement)

      // Create issue via GitHub CLI
      const { execFileSync } = await import('child_process')
      const repo = ctx.repo

      try {
        execFileSync(
          'gh',
          [
            'issue',
            'create',
            '--repo',
            repo,
            '--title',
            `[audit] ${improvement.title}`,
            '--body',
            body,
            '--label',
            'type:chore',
            '--label',
            'cody:audit',
          ],
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore'],
          },
        )

        return { success: true, message: 'Issue created' }
      } catch {
        return { success: false, message: 'Failed to create issue' }
      }
    },
  }
}

/**
 * Build the issue body from improvement details.
 */
function buildIssueBody(taskId: string, improvement: Improvement): string {
  let body = `## Improvement

**Type:** ${improvement.type}
**Rationale:** ${improvement.rationale}
`

  if (improvement.where) {
    body += `\n**Where:** ${improvement.where}\n`
  }

  body += `\n---
_This issue was auto-created by the Inspector audit plugin for task: ${taskId}_
`

  return body
}
