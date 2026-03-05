/**
 * @fileType utility
 * @domain watchdog
 * @pattern gate-reminder
 * @ai-summary Detects gated pipelines waiting for human approval and sends reminders
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import type { CheckResult, WatchdogContext } from '../types'
import { THRESHOLDS, DEDUP_MARKERS } from '../types'
import { getTaskDir } from '../../cody/cody-utils'
import { isDuplicateAlert } from '../delivery'
import { isPipelineStateV2 } from '../../cody/engine/types'

interface GatedIssue {
  number: number
  title: string
  labels: string[]
}

/**
 * Get issues with gate labels (hard-stop or risk-gated).
 * Uses --paginate and proper jq array output.
 */
function getGatedIssues(repo: string): GatedIssue[] {
  try {
    const output = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/issues`,
        '--paginate',
        '--jq',
        '[.[] | select(.state == "open") | select(.labels[].name == "hard-stop" or .labels[].name == "risk-gated") | {number: .number, title: .title, labels: [.labels[].name]}]',
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
          return JSON.parse(line) as GatedIssue[]
        } catch {
          return []
        }
      })

    return arrays.flat()
  } catch {
    return []
  }
}

/**
 * Check for gates waiting too long for approval
 */
export async function checkGateReminders(context: WatchdogContext): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const gatedIssues = getGatedIssues(context.repo)

  for (const issue of gatedIssues) {
    // Extract task ID from issue title
    const taskIdMatch = issue.title.match(/(\d{6}-[\w-]+)/)
    if (!taskIdMatch) continue

    const taskId = taskIdMatch[1]
    const taskDir = getTaskDir(taskId)
    const statusPath = join(taskDir, 'status.json')

    if (!existsSync(statusPath)) continue

    try {
      const content = readFileSync(statusPath, 'utf-8')
      const status = JSON.parse(content)

      if (!isPipelineStateV2(status)) continue

      // Find paused stage
      let pausedStage: { name: string; startedAt: string } | null = null
      for (const [stageName, stage] of Object.entries(status.stages)) {
        if (stage.state === 'paused' && stage.startedAt) {
          pausedStage = { name: stageName, startedAt: stage.startedAt }
          break
        }
      }

      if (!pausedStage) {
        // Gate may have been resolved but label not removed - skip
        continue
      }

      const startedAt = new Date(pausedStage.startedAt)
      const waitMinutes = (Date.now() - startedAt.getTime()) / (1000 * 60)

      // Validate
      if (Number.isNaN(waitMinutes)) {
        console.warn(`Invalid startedAt for ${taskId}: ${pausedStage.startedAt}`)
        continue
      }

      // Suppress if less than threshold
      if (waitMinutes < THRESHOLDS.GATE_SILENT) {
        continue
      }

      // Check dedup - don't remind more than once per hour
      const dedupMarker = DEDUP_MARKERS.gateReminder(taskId)
      if (isDuplicateAlert(context.repo, String(issue.number), dedupMarker, 60)) {
        console.log(`Skipping duplicate gate reminder for ${taskId}`)
        continue
      }

      // Determine urgency
      let urgency: 'warning' | 'critical'
      let detail: string

      if (waitMinutes > THRESHOLDS.GATE_CRITICAL) {
        urgency = 'critical'
        detail = `Paused at \`${pausedStage.name}\` for ${Math.round(waitMinutes)}min — please \`/cody approve\` or \`/cody reject\``
      } else {
        urgency = 'warning'
        detail = `Paused at \`${pausedStage.name}\` for ${Math.round(waitMinutes)}min — reply \`/cody approve\` to continue`
      }

      results.push({
        check: 'gate-reminders',
        urgency,
        title: `Gate waiting: ${taskId}`,
        detail,
        taskId,
        issueNumber: issue.number,
      })
    } catch (error) {
      console.warn(`Failed to check gate status for ${taskId}:`, error)
    }
  }

  return results
}
