/**
 * @fileType plugin
 * @domain inspector
 * @pattern success-tracker-plugin
 * @ai-summary Tracks Cody pipeline success rates and trends, posts daily digest
 *
 * Queries GitHub Actions API for cody.yml workflow runs over 7 and 30 days.
 * Calculates success rate, average duration, and trend direction.
 * Posts digest to Slack and/or the digest issue.
 * Triggers a warning action if the 7-day success rate drops >15pp below 30-day.
 */

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import { computeReport } from './metrics'
import { formatSlackMessage, formatMarkdownReport } from './formatter'

const CODY_WORKFLOW = 'cody.yml'
const DEDUP_WINDOW_MINUTES = 23 * 60
/** Threshold in percentage points for degradation warning. */
const DEGRADATION_WARNING_PP = -15

/**
 * Success Rate Tracker plugin.
 *
 * Runs ~daily (every 6th cycle + 23h dedup).
 */
export const successTrackerPlugin: InspectorPlugin = {
  name: 'success-tracker',
  description: 'Track Cody pipeline success rate and post daily metrics digest',
  domain: 'cody',
  schedule: { every: 6 },

  async run(ctx): Promise<ActionRequest[]> {
    ctx.log.debug('Running success-tracker plugin')

    // Fetch last 100 completed runs (covers ~30 days at typical cadence)
    const runs = ctx.github.listWorkflowRuns(CODY_WORKFLOW, {
      per_page: 100,
      status: 'completed',
    })

    if (runs.length === 0) {
      ctx.log.info('No completed workflow runs found — skipping success-tracker')
      return []
    }

    const report = computeReport(runs)

    if (!report) {
      ctx.log.info('Insufficient run data for metrics — skipping success-tracker')
      return []
    }

    ctx.log.info(
      {
        sevenDayRate: report.sevenDay.successRate,
        thirtyDayRate: report.thirtyDay.successRate,
        trend: report.trendDirection,
        trendPp: report.trendPp,
      },
      'Computed success metrics',
    )

    const isDegrading = report.trendPp <= DEGRADATION_WARNING_PP
    const urgency = isDegrading ? 'warning' : 'info'

    const actions: ActionRequest[] = []

    // Slack action
    if (ctx.slack?.isConfigured()) {
      actions.push({
        plugin: 'success-tracker',
        type: 'slack-digest',
        urgency,
        title: 'Cody metrics Slack digest',
        detail: formatSlackMessage(report),
        dedupKey: 'success-tracker:slack-daily',
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          if (!execCtx.slack?.isConfigured()) {
            return { success: false, message: 'Slack not configured at execution time' }
          }
          const msg = formatSlackMessage(report)
          await execCtx.slack.postMessage(msg)
          return { success: true, message: 'Slack digest sent' }
        },
      })
    }

    // Digest issue action
    if (ctx.digestIssue) {
      actions.push({
        plugin: 'success-tracker',
        type: 'digest',
        urgency,
        title: 'Cody metrics digest',
        detail: `7d: ${report.sevenDay.successRate}% | 30d: ${report.thirtyDay.successRate}% | trend: ${report.trendDirection}`,
        dedupKey: 'success-tracker:digest-daily',
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          if (!execCtx.digestIssue) {
            return { success: false, message: 'Digest issue not configured at execution time' }
          }
          const markdown = formatMarkdownReport(report, execCtx.cycleNumber)
          execCtx.github.postComment(execCtx.digestIssue, markdown)
          return { success: true, message: 'Digest posted' }
        },
      })
    }

    return actions
  },
}
