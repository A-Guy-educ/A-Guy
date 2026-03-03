/**
 * @fileType utility
 * @domain watchdog
 * @pattern stuck-pipeline-detection
 * @ai-summary Detects pipelines that are stuck (running but no progress) or have orphaned workflow runs
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import type { CheckResult, WatchdogContext } from '../types'
import { THRESHOLDS, DEDUP_MARKERS } from '../types'
import { getTaskDir } from '../../cody/cody-utils'
import { isDuplicateAlert } from '../delivery'
import { isPipelineStateV2, type PipelineStateV2 } from '../../cody/engine/types'

interface IssueInfo {
  number: number
  title: string
  labels: string[]
}

/**
 * Get all open issues from the repo.
 * Uses --paginate and proper jq array output to handle repos with many issues.
 */
function getOpenIssues(repo: string): IssueInfo[] {
  try {
    const output = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/issues`,
        '--paginate',
        '--jq',
        '[.[] | select(.state == "open") | {number: .number, title: .title, labels: [.labels[].name]}]',
      ],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    ).trim()

    if (!output) return []

    // --paginate with array jq output may produce multiple JSON arrays
    // e.g., "[{...}]\n[{...}]" — concatenate them
    const arrays = output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as IssueInfo[]
        } catch {
          return []
        }
      })

    return arrays.flat()
  } catch (error) {
    console.error('Failed to get open issues:', error)
    return []
  }
}

/**
 * Read and validate status.json for a task
 */
function readTaskStatus(taskId: string): PipelineStateV2 | null {
  const taskDir = getTaskDir(taskId)
  const statusPath = join(taskDir, 'status.json')

  if (!existsSync(statusPath)) return null

  try {
    const content = readFileSync(statusPath, 'utf-8')
    const parsed = JSON.parse(content)

    if (!isPipelineStateV2(parsed)) {
      console.warn(`Invalid status.json for ${taskId}`)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Check if a workflow run exists and is in a terminal state (completed/cancelled)
 * while status.json still says running
 */
function checkOrphanedWorkflow(taskId: string, repo: string): boolean {
  try {
    const output = execFileSync(
      'gh',
      [
        'run',
        'list',
        '--workflow=cody.yml',
        `--branch=feat/${taskId}`,
        '--json',
        'status,conclusion',
        '-q',
        '.[0]',
        `--repo=${repo}`,
      ],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    ).trim()

    if (!output) return false

    const run = JSON.parse(output)
    // If run is completed or cancelled but status.json says running, it's orphaned
    return (
      (run.status === 'completed' || run.status === 'cancelled') && run.conclusion !== 'success'
    )
  } catch {
    return false
  }
}

/**
 * Check for stuck pipelines
 */
export async function checkStuckPipelines(context: WatchdogContext): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const issues = getOpenIssues(context.repo)
  const now = new Date()

  for (const issue of issues) {
    // Extract task ID from issue title
    const taskIdMatch = issue.title.match(/(\d{6}-[\w-]+)/)
    if (!taskIdMatch) continue

    const taskId = taskIdMatch[1]
    const status = readTaskStatus(taskId)

    if (!status || status.state !== 'running') continue

    const updatedAt = new Date(status.updatedAt)
    const stuckMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)

    // Check for NaN (malformed updatedAt)
    if (Number.isNaN(stuckMinutes)) {
      console.warn(`Invalid updatedAt for ${taskId}: ${status.updatedAt}`)
      continue
    }

    // Check for stuck (no progress in N minutes)
    if (stuckMinutes > THRESHOLDS.STUCK_WARNING) {
      const isOrphaned = checkOrphanedWorkflow(taskId, context.repo)
      const urgency =
        stuckMinutes > THRESHOLDS.STUCK_CRITICAL || isOrphaned ? 'critical' : 'warning'

      // Check dedup
      const dedupMarker = DEDUP_MARKERS.stuckPipeline(taskId)
      if (isDuplicateAlert(context.repo, String(issue.number), dedupMarker, 60)) {
        console.log(`Skipping duplicate stuck alert for ${taskId}`)
        continue
      }

      const detail = isOrphaned
        ? `Pipeline orphaned — workflow run may have crashed (${Math.round(stuckMinutes)}min without progress)`
        : `Pipeline running for ${Math.round(stuckMinutes)}min without progress`

      results.push({
        check: 'stuck-pipelines',
        urgency,
        title: `Stuck pipeline: ${taskId}`,
        detail,
        taskId,
        issueNumber: issue.number,
      })
    }
  }

  return results
}
