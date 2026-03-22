/**
 * @fileType utility
 * @domain inspector
 * @pattern task-discovery
 * @ai-summary Discover Cody tasks from GitHub issues and their status.json files
 */

import * as fs from 'fs'
import type { InspectorContext, TaskSnapshot } from '../../../core/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineStateV2 = any

// FIX #12: Filter by cody lifecycle labels to avoid fetching ALL open issues
const CODY_LIFECYCLE_LABELS = [
  'cody:planning',
  'cody:building',
  'cody:review',
  'cody:done',
  'cody:failed',
]

/**
 * Discover all active Cody tasks from GitHub issues.
 */
export async function discoverTasks(ctx: InspectorContext): Promise<TaskSnapshot[]> {
  const tasks: TaskSnapshot[] = []
  const seenIssues = new Set<number>()

  // Query for each lifecycle label separately — more API calls but each is targeted
  for (const label of CODY_LIFECYCLE_LABELS) {
    const issues = ctx.github.getOpenIssues([label])

    for (const issue of issues) {
      // Skip duplicates (an issue can have multiple cody: labels)
      if (seenIssues.has(issue.number)) continue
      seenIssues.add(issue.number)

      // Extract task ID from title
      const taskId = extractTaskId(issue.title)
      if (!taskId) {
        // Try to find from marker comment
        const markerTaskId = findTaskIdFromComments(ctx, issue.number)
        if (!markerTaskId) {
          continue
        }
        tasks.push({
          taskId: markerTaskId,
          issueNumber: issue.number,
          issueTitle: issue.title,
          labels: issue.labels,
          status: null,
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
  }

  // Also check queue labels
  const queueLabels = ['cody:queued', 'cody:queue-active']
  for (const label of queueLabels) {
    const issues = ctx.github.getOpenIssues([label])
    for (const issue of issues) {
      if (seenIssues.has(issue.number)) continue
      seenIssues.add(issue.number)

      const taskId = extractTaskId(issue.title) || findTaskIdFromComments(ctx, issue.number)
      if (!taskId) continue

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

    if (!parsed || typeof parsed !== 'object' || !parsed.state || !parsed.stages) {
      return null
    }

    return parsed as PipelineStateV2
  } catch {
    return null
  }
}
