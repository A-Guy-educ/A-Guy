/**
 * @fileType plugin
 * @domain inspector
 * @pattern failure-miner-plugin
 * @ai-summary Scans task history for systemic failure patterns and creates GitHub improvement issues
 *
 * Collects all failed tasks from .tasks/ directory, analyzes for:
 * - Stage hotspots (a stage failing >= 2 times)
 * - Recurring error patterns (same error type appearing >= 2 times)
 * Creates deduplicated cody:improvement GitHub issues for actionable findings.
 * No LLM calls — purely deterministic pattern matching.
 */

import * as path from 'path'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import { collectFailures } from './collector'
import { analyzeFailures } from './analyzer'
import {
  formatHotspotTitle,
  formatHotspotBody,
  formatErrorPatternTitle,
  formatErrorPatternBody,
  hotspotSearchQuery,
  errorPatternSearchQuery,
} from './reporter'

const DEDUP_WINDOW_MINUTES = 23 * 60
const IMPROVEMENT_LABEL = 'cody:improvement'

/**
 * Failure Pattern Miner plugin.
 *
 * Runs ~daily (every 6th cycle + 23h dedup).
 */
export const failureMinerPlugin: InspectorPlugin = {
  name: 'failure-miner',
  description: 'Detect systemic pipeline failure patterns and create improvement issues',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx): Promise<ActionRequest[]> {
    ctx.log.debug('Running failure-miner plugin')

    const tasksDir = path.join(process.cwd(), '.tasks')
    const failures = collectFailures(tasksDir)

    if (failures.length === 0) {
      ctx.log.info('No failed tasks found — skipping failure-miner')
      return []
    }

    const analysis = analyzeFailures(failures)

    ctx.log.info(
      {
        totalFailures: analysis.totalFailures,
        stageHotspots: analysis.stageHotspots.length,
        errorPatterns: analysis.errorPatterns.length,
      },
      'Failure analysis complete',
    )

    if (analysis.stageHotspots.length === 0 && analysis.errorPatterns.length === 0) {
      ctx.log.info('No systemic patterns found — no issues to create')
      return []
    }

    const actions: ActionRequest[] = []

    // Create actions for stage hotspots
    for (const hotspot of analysis.stageHotspots) {
      const title = formatHotspotTitle(hotspot.stage, hotspot.failureCount)
      const body = formatHotspotBody(analysis, hotspot.stage, hotspot.failureCount)
      const searchQuery = hotspotSearchQuery(hotspot.stage)
      const dedupKey = `failure-miner:hotspot:${hotspot.stage}`

      actions.push({
        plugin: 'failure-miner',
        type: 'create-improvement-issue',
        urgency: hotspot.fraction >= 0.5 ? 'warning' : 'info',
        title,
        detail: `Stage '${hotspot.stage}' failed ${hotspot.failureCount}x (${Math.round(hotspot.fraction * 100)}% of failures)`,
        dedupKey,
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          // Check for existing open issue to avoid spam
          const existing = execCtx.github.searchIssues(searchQuery)
          if (existing.length > 0) {
            return {
              success: true,
              message: `Issue already exists (#${existing[0].number}) — skipping`,
            }
          }

          const issueNumber = execCtx.github.createIssue(title, body, [IMPROVEMENT_LABEL])
          if (issueNumber) {
            return { success: true, message: `Created issue #${issueNumber}` }
          }
          return { success: false, message: 'Failed to create issue' }
        },
      })
    }

    // Create actions for error patterns
    for (const pattern of analysis.errorPatterns) {
      const title = formatErrorPatternTitle(pattern.label, pattern.occurrences)
      const body = formatErrorPatternBody(
        analysis,
        pattern.label,
        pattern.occurrences,
        pattern.affectedTaskIds,
      )
      const searchQuery = errorPatternSearchQuery(pattern.label)
      const dedupKey = `failure-miner:error-pattern:${pattern.label}`

      actions.push({
        plugin: 'failure-miner',
        type: 'create-improvement-issue',
        urgency: 'info',
        title,
        detail: `Error pattern '${pattern.label}' occurred ${pattern.occurrences}x across ${pattern.affectedTaskIds.length} tasks`,
        dedupKey,
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          const existing = execCtx.github.searchIssues(searchQuery)
          if (existing.length > 0) {
            return {
              success: true,
              message: `Issue already exists (#${existing[0].number}) — skipping`,
            }
          }

          const issueNumber = execCtx.github.createIssue(title, body, [IMPROVEMENT_LABEL])
          if (issueNumber) {
            return { success: true, message: `Created issue #${issueNumber}` }
          }
          return { success: false, message: 'Failed to create issue' }
        },
      })
    }

    return actions
  },
}
