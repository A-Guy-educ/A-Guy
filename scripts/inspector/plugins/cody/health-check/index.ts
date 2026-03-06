/**
 * @fileType plugin
 * @domain inspector
 * @pattern health-check-plugin
 * @ai-summary Monitor Cody pipeline health and take corrective action
 */

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
 * Evaluate the health of a single task.
 */
function evaluateHealth(task: TaskSnapshot, _ctx: InspectorContext): EvaluatedTask {
  const status = task.status as {
    state?: string
    updatedAt?: string
    stages?: Record<string, { state?: string; error?: string; startedAt?: string }>
  }

  // No status = unknown
  if (!status) {
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
    // Find the failed stage
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
    // Find paused stage and calculate wait time
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

  // Running - check for staleness
  if (status.state === 'running') {
    const updatedAt = status.updatedAt ? new Date(status.updatedAt).getTime() : 0
    const stalledMs = Date.now() - updatedAt
    const stalledMinutes = Math.round(stalledMs / 60000)

    if (stalledMs > STALENESS_THRESHOLD_MS) {
      // Could check for orphaned workflow here in Phase 2
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
 * Create a retry action for failed tasks.
 */
function createRetryAction(task: EvaluatedTask, ctx: InspectorContext): ActionRequest | null {
  if (task.health !== 'failed' && task.health !== 'orphaned') {
    return null
  }

  // Check retry count
  const retryKey = `cody:retries:${task.taskId}`
  const retryCount = ctx.state.get<number>(retryKey) || 0

  if (retryCount >= 3) {
    ctx.log.debug({ taskId: task.taskId, retryCount }, 'Max retries exhausted')
    return null
  }

  const dedupKey = `retry:${task.taskId}`

  return {
    plugin: 'cody-health-check',
    type: 'retry',
    target: task.taskId,
    urgency: 'critical',
    title: `Retry failed pipeline: ${task.taskId}`,
    detail: `Pipeline failed at ${task.failedStage}. Retry attempt ${retryCount + 1}/3.`,
    dedupKey,
    dedupWindowMinutes: 30,
    execute: async () => {
      // Trigger workflow rerun
      const fromStage = task.failedStage === 'verify' ? 'build' : task.failedStage || 'build'
      ctx.github.triggerWorkflow('cody.yml', {
        task_id: task.taskId,
        mode: 'rerun',
        from_stage: fromStage,
        feedback: `Auto-retry after health-check detection. Previous failure: ${task.failedError}`,
      })

      // Post comment to issue
      ctx.github.postComment(
        task.issueNumber,
        `## 🔄 Auto-Retry\n\nPipeline failed at \`${task.failedStage}\`. Triggering retry attempt ${retryCount + 1}/3.`,
      )

      // Increment retry count
      ctx.state.set(retryKey, retryCount + 1)

      return { success: true, message: 'Retry triggered' }
    },
  }
}

/**
 * Create a nudge action for gated tasks.
 */
function createNudgeAction(task: EvaluatedTask, ctx: InspectorContext): ActionRequest | null {
  if (task.health !== 'gated') {
    return null
  }

  const gatedMinutes = task.gatedMinutes || 0

  // Only nudge after 30 minutes
  if (gatedMinutes < 30) {
    return null
  }

  const urgency = gatedMinutes > 120 ? 'critical' : 'warning'
  const dedupKey = `nudge:${task.taskId}`

  return {
    plugin: 'cody-health-check',
    type: 'nudge',
    target: task.taskId,
    urgency,
    title: `Gate approval needed: ${task.taskId}`,
    detail: `Pipeline paused for ${gatedMinutes} minutes. Reply \`/cody approve\` to continue.`,
    dedupKey,
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
 * Create a digest action summarizing all task health.
 */
function createDigestAction(tasks: EvaluatedTask[], ctx: InspectorContext): ActionRequest | null {
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

  // If everything is healthy or completed, no need for digest
  if (healthCounts.healthy + healthCounts.completed === tasks.length || tasks.length === 0) {
    return null
  }

  const dedupKey = 'digest'

  return {
    plugin: 'cody-health-check',
    type: 'digest',
    urgency: 'info',
    title: 'Cody Pipeline Health Digest',
    detail: `Total: ${tasks.length} | Healthy: ${healthCounts.healthy} | Completed: ${healthCounts.completed} | Failed: ${healthCounts.failed} | Stalled: ${healthCounts.stalled} | Gated: ${healthCounts.gated}`,
    dedupKey,
    dedupWindowMinutes: 30,
    execute: async () => {
      // Build markdown table
      let table = '| Task | Status | Detail |\n|------|--------|--------|\n'
      for (const task of tasks) {
        const statusEmoji =
          task.health === 'healthy'
            ? '✅'
            : task.health === 'completed'
              ? '🎉'
              : task.health === 'failed'
                ? '❌'
                : task.health === 'stalled'
                  ? '⏸️'
                  : task.health === 'gated'
                    ? '🚧'
                    : '❓'
        table += `| ${task.taskId} | ${statusEmoji} ${task.health} | ${task.healthDetail} |\n`
      }

      ctx.github.postComment(
        Number(process.env.WATCHDOG_ISSUE) || 0,
        `## 🐕 Inspector Digest\n\n${table}\n\n_Cycle ${ctx.cycleNumber}_`,
      )
      return { success: true, message: 'Digest posted' }
    },
  }
}

/**
 * Health check plugin.
 */
export const healthCheckPlugin: InspectorPlugin = {
  name: 'cody-health-check',
  description: 'Monitor Cody pipeline health and take corrective action',
  domain: 'cody',

  async run(ctx) {
    ctx.log.debug('Running health-check plugin')

    // Discover tasks
    const tasks = await discoverTasks(ctx)
    ctx.log.debug({ taskCount: tasks.length }, 'Discovered tasks')

    // Evaluate health
    const evaluated = tasks.map((task) => evaluateHealth(task, ctx))

    // Generate actions
    const actions: ActionRequest[] = []

    for (const task of evaluated) {
      const retry = createRetryAction(task, ctx)
      if (retry) actions.push(retry)

      const nudge = createNudgeAction(task, ctx)
      if (nudge) actions.push(nudge)
    }

    // Add digest
    const digest = createDigestAction(evaluated, ctx)
    if (digest) actions.push(digest)

    ctx.log.debug({ actionCount: actions.length }, 'Generated actions')

    return actions
  },
}
