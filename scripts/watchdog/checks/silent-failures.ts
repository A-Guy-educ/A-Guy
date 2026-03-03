/**
 * @fileType utility
 * @domain watchdog
 * @pattern silent-failure-detection
 * @ai-summary Detects pipeline failures that didn't trigger the supervisor (silent failures)
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import type { CheckResult, WatchdogContext } from '../types'
import { DEDUP_MARKERS } from '../types'
import { getTaskDir } from '../../cody/cody-utils'
import { isDuplicateAlert } from '../delivery'
import { isPipelineStateV2 } from '../../cody/engine/types'

/**
 * Check if a failure comment exists on the issue
 */
function hasFailureComment(repo: string, issueNumber: number, taskId: string): boolean {
  try {
    const output = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/issues/${issueNumber}/comments`,
        '--paginate',
        '--jq',
        `.[] | select(.body | contains("Pipeline failed") and contains("${taskId}")) | .id`,
      ],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    ).trim()

    return output.length > 0
  } catch {
    return false
  }
}

/**
 * Get all open issues from the repo
 */
function getOpenIssues(repo: string): Array<{ number: number; title: string }> {
  try {
    const output = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/issues`,
        '--paginate',
        '--jq',
        '[.[] | select(.state == "open") | {number: .number, title: .title}]',
      ],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    ).trim()

    if (!output) return []

    // Handle paginated array output
    const arrays = output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Array<{ number: number; title: string }>
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
 * Check for tasks that failed but didn't get a supervisor analysis
 * (the supervisor only triggers on failure comments from github-actions[bot])
 */
export async function checkSilentFailures(context: WatchdogContext): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const issues = getOpenIssues(context.repo)

  for (const issue of issues) {
    // Extract task ID
    const taskIdMatch = issue.title.match(/(\d{6}-[\w-]+)/)
    if (!taskIdMatch) continue

    const taskId = taskIdMatch[1]
    const taskDir = getTaskDir(taskId)
    const statusPath = join(taskDir, 'status.json')

    if (!existsSync(statusPath)) continue

    try {
      const content = readFileSync(statusPath, 'utf-8')
      const parsed = JSON.parse(content)

      if (!isPipelineStateV2(parsed)) continue

      // Only care about failed pipelines
      if (parsed.state !== 'failed') continue

      // Check if a failure comment exists
      if (hasFailureComment(context.repo, issue.number, taskId)) {
        continue // Supervisor already handled this
      }

      // Dedup - only auto-rerun once per task (24h window)
      const dedupMarker = DEDUP_MARKERS.autoRerun(taskId)
      if (isDuplicateAlert(context.repo, String(issue.number), dedupMarker, 60 * 24)) {
        continue
      }

      // Find the failed stage
      let failedStage = 'unknown'
      for (const [stageName, stage] of Object.entries(parsed.stages)) {
        if (stage.state === 'failed') {
          failedStage = stageName
          break
        }
      }

      // For silent failures, trigger a basic rerun from the root-cause stage
      const autoAction = {
        type: 'trigger-rerun' as const,
        taskId,
        fromStage: failedStage === 'verify' ? 'build' : failedStage,
        feedback: 'Retry after silent failure detection (no supervisor analysis available)',
      }

      results.push({
        check: 'silent-failures',
        urgency: 'warning',
        title: `Silent failure: ${taskId}`,
        detail: `Pipeline failed at \`${failedStage}\` but no supervisor analysis — auto-triggering rerun`,
        taskId,
        issueNumber: issue.number,
        autoAction,
      })
    } catch (error) {
      console.warn(`Failed to check silent failure for ${taskId}:`, error)
    }
  }

  return results
}
