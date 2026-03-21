/**
 * @fileType plugin
 * @domain inspector
 * @pattern health-check-plugin
 * @ai-summary Monitor Cody pipeline health and take corrective action
 */

import { execFileSync } from 'child_process'
import type {
  InspectorPlugin,
  ActionRequest,
  InspectorContext,
  TaskHealth,
} from '../../../core/types'
import type { TaskSnapshot, EvaluatedTask } from '../../../core/types'
import { discoverTasks } from './discovery'

const STALENESS_THRESHOLD_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Check if a workflow run exists and is in a terminal state (completed/cancelled)
 * while status.json still says running — meaning the workflow crashed but status wasn't updated.
 */
function checkOrphanedWorkflow(taskId: string, ctx: InspectorContext): boolean {
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
        `--repo=${ctx.repo}`,
      ],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
      },
    ).trim()

    if (!output) return false

    const run = JSON.parse(output)
    return (
      (run.status === 'completed' || run.status === 'cancelled') && run.conclusion !== 'success'
    )
  } catch {
    return false
  }
}

/**
 * FIX #6: Extract failure details from pipeline failure comments on an issue.
 * Searches for multiple comment formats — both old and new pipeline versions.
 */
function parseFailureFromComments(
  ctx: InspectorContext,
  issueNumber: number,
): { failedStage: string; failedError: string } {
  try {
    const comments = ctx.github.getIssueComments(issueNumber)
    // Search newest-to-oldest
    for (let i = comments.length - 1; i >= 0; i--) {
      const body = comments[i].body

      // Pattern 1: New format "❌ Pipeline failed"
      if (body.includes('\u274c Pipeline failed') || body.includes('Pipeline failed')) {
        const stageMatch = body.match(/\*\*Failed stage:\*\*\s*`([^`]+)`/)
        const errorMatch = body.match(/\*\*Error:\*\*\s*(.+)/)
        if (stageMatch || errorMatch) {
          return {
            failedStage: stageMatch?.[1] || 'unknown',
            failedError: errorMatch?.[1]?.trim() || 'Unknown error (parsed from comment)',
          }
        }
      }

      // Pattern 2: Older format "Pipeline failed at stage:"
      if (body.includes('Pipeline failed at stage:')) {
        const stageMatch = body.match(/Pipeline failed at stage:\s*(\w+)/)
        const errorMatch = body.match(/Error:\s*(.+)/)
        return {
          failedStage: stageMatch?.[1] || 'unknown',
          failedError: errorMatch?.[1]?.trim() || 'Pipeline failed (no error details)',
        }
      }

      // Pattern 3: Look for any "failed" + stage name in cody bot comments
      if (
        body.includes('failed') &&
        (body.includes('build') || body.includes('verify') || body.includes('commit'))
      ) {
        const stageMatch = body.match(
          /(?:stage|at)\s*[:`]*\s*(taskify|gap|architect|plan-gap|build|verify|autofix|commit|review|fix|pr)\b/i,
        )
        if (stageMatch) {
          return {
            failedStage: stageMatch[1].toLowerCase(),
            failedError: body.slice(0, 200).trim(),
          }
        }
      }
    }
  } catch {
    // Ignore errors — fallback below
  }
  return { failedStage: 'unknown', failedError: 'Unknown error (no failure comment found)' }
}

/**
 * Evaluate the health of a single task.
 */
function evaluateHealth(task: TaskSnapshot, ctx: InspectorContext): EvaluatedTask {
  const status = task.status as {
    state?: string
    updatedAt?: string
    stages?: Record<string, { state?: string; error?: string; startedAt?: string }>
  }

  // No status.json
  if (!status) {
    // FIX #5: Treat cody:done as completed
    if (task.labels.includes('cody:done')) {
      return {
        ...task,
        health: 'completed',
        healthDetail: 'Task completed (cody:done label)',
      }
    }
    // Detect failures from label
    if (task.labels.includes('cody:failed')) {
      const { failedStage, failedError } = parseFailureFromComments(ctx, task.issueNumber)
      return {
        ...task,
        health: 'failed',
        healthDetail: 'Pipeline failed (status.json on feature branch)',
        failedStage,
        failedError,
      }
    }
    return {
      ...task,
      health: 'unknown',
      healthDetail: 'No status.json found',
    }
  }

  // Completed
  if (status.state === 'completed') {
    return {
      ...task,
      health: 'completed',
      healthDetail: 'Pipeline completed successfully',
    }
  }

  // Failed or timeout
  if (status.state === 'failed' || status.state === 'timeout') {
    let failedStage = 'unknown'
    let failedError = ''
    for (const [stageName, stage] of Object.entries(status.stages || {})) {
      if (stage.state === 'failed' || stage.state === 'timeout') {
        failedStage = stageName
        failedError = stage.error || `Stage ${stageName} ${stage.state}`
        break
      }
    }
    return {
      ...task,
      health: 'failed',
      healthDetail: `Pipeline ${status.state} at stage: ${failedStage}`,
      failedStage,
      failedError,
    }
  }

  // Paused (gated)
  if (status.state === 'paused') {
    let pausedStage = 'unknown'
    let gatedMinutes = 0
    for (const [stageName, stage] of Object.entries(status.stages || {})) {
      if (stage.state === 'paused' && stage.startedAt) {
        pausedStage = stageName
        gatedMinutes = Math.round((Date.now() - new Date(stage.startedAt).getTime()) / 60000)
        break
      }
    }
    return {
      ...task,
      health: 'gated',
      healthDetail: `Pipeline paused at ${pausedStage}`,
      gatedMinutes,
    }
  }

  // Running — check for staleness and orphaned workflows
  if (status.state === 'running') {
    const updatedAt = status.updatedAt ? new Date(status.updatedAt).getTime() : 0
    const stalledMs = Date.now() - updatedAt
    const stalledMinutes = Math.round(stalledMs / 60000)

    if (stalledMs > STALENESS_THRESHOLD_MS) {
      const isOrphaned = checkOrphanedWorkflow(task.taskId, ctx)

      if (isOrphaned) {
        return {
          ...task,
          health: 'orphaned',
          healthDetail: `Workflow run terminated but status.json still says running (${stalledMinutes}min)`,
          stalledMinutes,
        }
      }

      return {
        ...task,
        health: 'stalled',
        healthDetail: `No progress for ${stalledMinutes} minutes`,
        stalledMinutes,
      }
    }

    return {
      ...task,
      health: 'healthy',
      healthDetail: 'Pipeline running normally',
    }
  }

  return {
    ...task,
    health: 'unknown',
    healthDetail: `Unknown state: ${status.state}`,
  }
}

/**
 * Create a nudge action for gated tasks.
 * @internal — exported for testing
 */
export function createNudgeAction(
  task: EvaluatedTask,
  ctx: InspectorContext,
): ActionRequest | null {
  if (task.health !== 'gated') return null
  if (!task.issueNumber || task.issueNumber <= 0) return null

  const gatedMinutes = task.gatedMinutes || 0
  if (gatedMinutes < 30) return null

  const urgency = gatedMinutes > 120 ? 'critical' : 'warning'

  return {
    plugin: 'cody-health-check',
    type: 'nudge',
    target: task.taskId,
    urgency,
    title: `Gate approval needed: ${task.taskId}`,
    detail: `Pipeline paused for ${gatedMinutes} minutes.`,
    dedupKey: `nudge:${task.taskId}`,
    dedupWindowMinutes: 60,
    execute: async () => {
      ctx.github.postComment(
        task.issueNumber,
        `## ⏳ Gate Approval Needed\n\nPipeline has been waiting for approval for ${gatedMinutes} minutes.\n\nPlease run \`/cody approve\` to continue or \`/cody reject\` to cancel.`,
      )
      return { success: true, message: 'Nudge posted' }
    },
  }
}

/**
 * FIX #4: Create a useful digest action — only actionable tasks, with fixer state.
 * @internal — exported for testing
 */
export function createDigestAction(
  tasks: EvaluatedTask[],
  ctx: InspectorContext,
): ActionRequest | null {
  if (!ctx.digestIssue) {
    ctx.log.warn('INSPECTOR_DIGEST_ISSUE not configured — skipping digest')
    return null
  }

  // Only include actionable tasks (not completed, not unknown/done)
  const actionable = tasks.filter((t) => t.health !== 'completed' && t.health !== 'unknown')

  // If nothing actionable, skip digest entirely
  if (actionable.length === 0) {
    return null
  }

  const healthCounts: Record<TaskHealth, number> = {
    healthy: 0,
    completed: 0,
    stalled: 0,
    failed: 0,
    gated: 0,
    orphaned: 0,
    unknown: 0,
  }
  for (const task of tasks) {
    healthCounts[task.health]++
  }

  return {
    plugin: 'cody-health-check',
    type: 'digest',
    urgency: 'info',
    title: 'Cody Pipeline Health Digest',
    detail: `Failed: ${healthCounts.failed} | Running: ${healthCounts.healthy} | Gated: ${healthCounts.gated} | Completed: ${healthCounts.completed}`,
    dedupKey: 'digest',
    // FIX #7: Increase dedup to 6 hours — digest is rarely changing
    dedupWindowMinutes: 360,
    execute: async () => {
      // Read fixer state for context
      const fixerState =
        ctx.state.get<Record<string, { retries: number; fixIssueNumber: number | null }>>(
          'cody:fixerState',
        ) || {}

      // Summary line
      let md = `## 🐕 Inspector Digest — Cycle ${ctx.cycleNumber}\n\n`
      md += `**Summary**: ${healthCounts.failed} failed, ${healthCounts.healthy} running, ${healthCounts.gated} gated, ${healthCounts.completed} completed, ${healthCounts.unknown} unknown\n\n`

      // Only show actionable tasks
      if (actionable.length > 0) {
        md += `### Actionable Tasks\n\n`
        md += `| Issue | Task | Status | Detail | Fixer |\n|-------|------|--------|--------|-------|\n`

        for (const task of actionable) {
          const emoji =
            task.health === 'healthy'
              ? '🟢'
              : task.health === 'failed'
                ? '🔴'
                : task.health === 'stalled'
                  ? '🟡'
                  : task.health === 'gated'
                    ? '🟠'
                    : task.health === 'orphaned'
                      ? '👻'
                      : '❓'

          const fixer = fixerState[task.taskId]
          const fixerInfo = fixer
            ? `retry ${fixer.retries}/5${fixer.fixIssueNumber ? ` • fix #${fixer.fixIssueNumber}` : ''}`
            : '—'

          md += `| #${task.issueNumber} | ${task.taskId} | ${emoji} ${task.health} | ${task.healthDetail.slice(0, 60)} | ${fixerInfo} |\n`
        }
      }

      md += `\n_${new Date().toISOString()}_`

      ctx.github.postComment(ctx.digestIssue!, md)
      return { success: true, message: 'Digest posted' }
    },
  }
}

/**
 * Health check plugin.
 *
 * Responsibilities:
 * - Discover active Cody tasks
 * - Evaluate health (healthy, stalled, failed, gated, orphaned, completed)
 * - Create nudge actions for gated tasks
 * - Create digest action for visibility
 * - Share evaluated tasks via state for pipeline-fixer plugin
 *
 * NOTE: Failed task retries are delegated to the pipeline-fixer plugin.
 */

/**
 * Prune completed tasks from fixerState to prevent unbounded growth.
 * Called after evaluating task health.
 */
function pruneFixerStateForCompletedTasks(ctx: InspectorContext, evaluated: EvaluatedTask[]): void {
  const completedTaskIds = new Set(
    evaluated.filter((t) => t.health === 'completed').map((t) => t.taskId),
  )

  if (completedTaskIds.size === 0) return

  const fixerState =
    ctx.state.get<Record<string, { retries: number; fixIssueNumber: number | null }>>(
      'cody:fixerState',
    ) || {}

  let pruned = 0
  for (const taskId of completedTaskIds) {
    if (taskId in fixerState) {
      delete fixerState[taskId]
      pruned++
    }
  }

  if (pruned > 0) {
    ctx.state.set('cody:fixerState', fixerState)
    ctx.log.debug(
      { pruned, remaining: Object.keys(fixerState).length },
      'Pruned completed tasks from fixerState',
    )
  }
}

/**
 * NOTE: Failed task retries are delegated to the pipeline-fixer plugin.
 */
export const healthCheckPlugin: InspectorPlugin = {
  name: 'cody-health-check',
  description: 'Monitor Cody pipeline health and take corrective action',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx) {
    ctx.log.debug('Running health-check plugin')

    const tasks = await discoverTasks(ctx)
    ctx.log.debug({ taskCount: tasks.length }, 'Discovered tasks')

    const evaluated = tasks.map((task) => evaluateHealth(task, ctx))

    // Prune completed tasks from fixerState to prevent unbounded growth
    pruneFixerStateForCompletedTasks(ctx, evaluated)

    // Share evaluated tasks with pipeline-fixer plugin via state
    ctx.state.set('cody:evaluatedTasks', evaluated)

    const actions: ActionRequest[] = []

    for (const task of evaluated) {
      const nudge = createNudgeAction(task, ctx)
      if (nudge) actions.push(nudge)
    }

    const digest = createDigestAction(evaluated, ctx)
    if (digest) actions.push(digest)

    ctx.log.debug({ actionCount: actions.length }, 'Generated actions')

    return actions
  },
}
