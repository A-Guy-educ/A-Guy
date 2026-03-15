/**
 * @fileType utility
 * @domain inspector
 * @pattern task-discovery
 * @ai-summary Discover Cody tasks from GitHub issues and their status.json files
 */

import * as fs from 'fs'
import type { InspectorContext, TaskSnapshot } from '../../../core/types'

// Minimal type for status.json - we don't need to import from cody
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineStateV2 = any

/**
 * Discover all active Cody tasks from GitHub issues.
 */
export async function discoverTasks(ctx: InspectorContext): Promise<TaskSnapshot[]> {
  const tasks: TaskSnapshot[] = []

  // Get open issues - no label filter, we'll check manually
  const issues = ctx.github.getOpenIssues()

  for (const issue of issues) {
    // Filter to issues with any cody lifecycle label
    const hasCodyLabel = issue.labels.some((label: string) => label.startsWith('cody:'))
    if (!hasCodyLabel) {
      continue
    }

    // Extract task ID from title
    const taskId = extractTaskId(issue.title)
    if (!taskId) {
      // Try to find from marker comment
      const markerTaskId = findTaskIdFromComments(ctx, issue.number)
      if (markerTaskId) {
        // Found from comments
        const status = readTaskStatus(markerTaskId)
        tasks.push({
          taskId: markerTaskId,
          issueNumber: issue.number,
          issueTitle: issue.title,
          labels: issue.labels,
          status,
          issueUpdatedAt: issue.updatedAt,
          statusUpdatedAt: status?.updatedAt || null,
        })
        continue
      }

      // Task ID not found - this is an untracked issue
      // Push with a special taskId that indicates we can't monitor it
      tasks.push({
        taskId: `unknown-${issue.number}`,
        issueNumber: issue.number,
        issueTitle: issue.title,
        labels: issue.labels,
        status: null, // No status.json because we don't know the task ID
        issueUpdatedAt: issue.updatedAt,
        statusUpdatedAt: null,
      })
      continue
    }

    // Read status.json
    const status = readTaskStatus(taskId)

    tasks.push({
      taskId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      labels: issue.labels,
      status,
      issueUpdatedAt: issue.updatedAt,
      statusUpdatedAt: status?.updatedAt || null,
    })
  }

  return tasks
}

/**
 * Extract task ID from issue title using regex.
 */
function extractTaskId(title: string): string | null {
  const match = title.match(/(\d{6}-[\w-]+)/)
  return match ? match[1] : null
}

/**
 * Find task ID from issue comments (looks for Task marker).
 */
function findTaskIdFromComments(ctx: InspectorContext, issueNumber: number): string | null {
  try {
    const comments = ctx.github.getIssueComments(issueNumber)
    for (const comment of comments) {
      // Look for "Task created: `XXXXXX-slug`" pattern
      const match = comment.body.match(/Task created: `(\d{6}-[\w-]+)`/)
      if (match) {
        return match[1]
      }
    }
  } catch {
    // Ignore errors
  }
  return null
}

/**
 * Read and validate status.json for a task.
 */
function readTaskStatus(taskId: string): PipelineStateV2 | null {
  const statusPath = `${process.cwd()}/.tasks/${taskId}/status.json`

  if (!fs.existsSync(statusPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(statusPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Basic validation - must have required fields
    if (!parsed || typeof parsed !== 'object' || !parsed.state || !parsed.stages) {
      return null
    }

    return parsed as PipelineStateV2
  } catch {
    return null
  }
}
