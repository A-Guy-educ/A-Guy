/**
 * @fileType plugin
 * @domain inspector
 * @pattern health-check-plugin
 * @ai-summary Monitor Cody pipeline health and take corrective action
 */

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import type {
  InspectorPlugin,
  ActionRequest,
  InspectorContext,
  TaskHealth,
} from '../../../core/types'
import type { TaskSnapshot, EvaluatedTask } from '../../../core/types'
import { discoverTasks } from './discovery'
import { getTaskDir } from '../../../clients/github'

const STALENESS_THRESHOLD_MS = 20 * 60 * 1000 // 20 minutes - when stalled/orphaned is detected

/**
 * Check if a workflow run exists and is in a terminal state (completed/cancelled)
 * while status.json still says running — meaning the workflow crashed but status wasn't updated.
 *
 * Ported from: scripts/watchdog/checks/stuck-pipelines.ts → checkOrphanedWorkflow()
 */
function checkOrphanedWorkflow(taskId: string, ctx: InspectorContext): boolean {
  try {
    // Use gh CLI via the github client's underlying mechanism
    // We need to check workflow runs for the task's branch
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
    // If run is completed or cancelled but status.json says running, it's orphaned
    return (
      (run.status === 'completed' || run.status === 'cancelled') && run.conclusion !== 'success'
    )
  } catch {
    return false
  }
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

  // Running - check for staleness and orphaned workflows
  if (status.state === 'running') {
    const updatedAt = status.updatedAt ? new Date(status.updatedAt).getTime() : 0
    const stalledMs = Date.now() - updatedAt
    const stalledMinutes = Math.round(stalledMs / 60000)

    if (stalledMs > STALENESS_THRESHOLD_MS) {
      // Check for orphaned workflow (workflow crashed but status not updated)
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
 * Get the status.json path for a task.
 */
function getStatusPath(taskId: string): string {
  const taskDir = getTaskDir(taskId)
  return `${taskDir}/status.json`
}

/**
 * Mark a task as failed in status.json (used for orphaned tasks).
 * @internal — exported for testing
 */
export function markTaskFailed(taskId: string, errorMessage: string): boolean {
  const statusPath = getStatusPath(taskId)

  if (!existsSync(statusPath)) {
    return false
  }

  try {
    const status = JSON.parse(readFileSync(statusPath, 'utf-8')) as Record<string, unknown>

    // Mark all running stages as failed
    const stages = (status.stages as Record<string, Record<string, unknown>>) || {}
    for (const [stageName, stage] of Object.entries(stages)) {
      if (stage.state === 'running') {
        stages[stageName] = {
          ...stage,
          state: 'failed',
          error: errorMessage,
          completedAt: new Date().toISOString(),
        }
      }
    }

    // Update pipeline state
    const updatedStatus = {
      ...status,
      state: 'failed',
      completedAt: new Date().toISOString(),
      stages,
      updatedAt: new Date().toISOString(),
    }

    // Atomic write: write to temp file, then rename to target (atomic on POSIX)
    const tmpPath = `${statusPath}.tmp`
    writeFileSync(tmpPath, JSON.stringify(updatedStatus, null, 2))
    renameSync(tmpPath, statusPath)

    return true
  } catch (error) {
    console.error(`Failed to mark task ${taskId} as failed:`, error)
    return false
  }
}

/**
 * Create an action for orphaned tasks (workflow terminated but status says running).
 * Immediately marks the task as failed and sets up for retry.
 * @internal — exported for testing
 */
export function createOrphanedAction(
  task: EvaluatedTask,
  ctx: InspectorContext,
): ActionRequest | null {
  if (task.health !== 'orphaned') {
    return null
  }

  // Guard: skip if issue number is invalid
  if (!task.issueNumber || task.issueNumber <= 0) {
    return null
  }

  const dedupKey = `orphan-reap:${task.taskId}`
  const stalledMinutes = task.stalledMinutes || 0

  return {
    plugin: 'cody-health-check',
    type: 'orphan-reap',
    target: task.taskId,
    urgency: 'critical',
    title: `Orphaned pipeline: ${task.taskId}`,
    detail: `Workflow terminated but status.json still says running (${stalledMinutes}min)`,
    dedupKey,
    dedupWindowMinutes: 60,
    execute: async () => {
      // Mark task as failed in status.json
      const marked = markTaskFailed(
        task.taskId,
        'Workflow terminated unexpectedly - marked by inspector',
      )

      // Post comment
      ctx.github.postComment(
        task.issueNumber,
        `## 👻 Pipeline Orphaned

The workflow run appears to have terminated but status.json still says running (${stalledMinutes} minutes).

Inspector has marked this pipeline as **failed** to enable retry.

To investigate and retry, run:
\`/cody rerun ${task.taskId}\`
`,
      )

      // Set lifecycle label to failed
      ctx.github.setLifecycleLabel(task.issueNumber, 'cody:failed')

      return {
        success: marked,
        message: marked ? 'Orphaned pipeline reaped' : 'Failed to update status.json',
      }
    },
  }
}

/**
 * Create a warning action for stalled tasks (no progress for extended time).
 * @internal — exported for testing
 */
export function createStalledWarningAction(
  task: EvaluatedTask,
  ctx: InspectorContext,
): ActionRequest | null {
  if (task.health !== 'stalled') {
    return null
  }

  // Guard: skip if issue number is invalid
  if (!task.issueNumber || task.issueNumber <= 0) {
    return null
  }

  const stalledMinutes = task.stalledMinutes || 0

  // Only warn after threshold
  if (stalledMinutes < 30) {
    return null
  }

  const urgency = stalledMinutes > 60 ? 'critical' : 'warning'
  const dedupKey = `stalled-warn:${task.taskId}`

  return {
    plugin: 'cody-health-check',
    type: 'stalled-warning',
    target: task.taskId,
    urgency,
    title: `Stalled pipeline: ${task.taskId}`,
    detail: `No progress for ${stalledMinutes} minutes`,
    dedupKey,
    dedupWindowMinutes: 60,
    execute: async () => {
      ctx.github.postComment(
        task.issueNumber,
        `## ⏸️ Pipeline Stalled

No progress detected for **${stalledMinutes} minutes**.

The pipeline may be hung. If this continues, Inspector will attempt recovery.

To manually intervene, you can:
- Check the workflow run: look for active runs on the branch
- Run \`/cody rerun ${task.taskId}\` to restart from the last checkpoint
`,
      )
      return { success: true, message: 'Stalled warning posted' }
    },
  }
}

/**
 * Create an action for unknown health (missing/corrupt status.json).
 * @internal — exported for testing
 */
export function createUnknownAction(
  task: EvaluatedTask,
  ctx: InspectorContext,
): ActionRequest | null {
  if (task.health !== 'unknown') {
    return null
  }

  // Guard: skip if issue number is invalid
  if (!task.issueNumber || task.issueNumber <= 0) {
    return null
  }

  const dedupKey = `unknown:${task.taskId}`

  return {
    plugin: 'cody-health-check',
    type: 'unknown-health',
    target: task.taskId,
    urgency: 'warning',
    title: `Unknown pipeline: ${task.taskId}`,
    detail: task.healthDetail || 'Cannot determine pipeline status',
    dedupKey,
    dedupWindowMinutes: 1440, // 24 hours - only nag once per day
    execute: async () => {
      ctx.github.postComment(
        task.issueNumber,
        `## ❓ Pipeline Status Unknown

Inspector cannot determine the status of this pipeline: **${task.healthDetail}**

This may indicate:
- A missing or corrupted status.json file
- The pipeline has not started yet
- A configuration issue

If this is a Cody task, please run \`/cody\` to start the pipeline, or close this issue if it's not a Cody task.`,
      )
      return { success: true, message: 'Unknown health notice posted' }
    },
  }
}
export function createNudgeAction(
  task: EvaluatedTask,
  ctx: InspectorContext,
): ActionRequest | null {
  if (task.health !== 'gated') {
    return null
  }

  // Guard: skip if issue number is invalid (e.g., task discovered without a GitHub issue)
  if (!task.issueNumber || task.issueNumber <= 0) {
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
 * @internal — exported for testing
 */
export function createDigestAction(
  tasks: EvaluatedTask[],
  ctx: InspectorContext,
): ActionRequest | null {
  // Guard: skip digest when INSPECTOR_DIGEST_ISSUE is not configured
  if (!ctx.digestIssue) {
    ctx.log.warn('INSPECTOR_DIGEST_ISSUE not configured — skipping digest')
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
    untracked: 0,
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
    detail: `Total: ${tasks.length} | Healthy: ${healthCounts.healthy} | Completed: ${healthCounts.completed} | Failed: ${healthCounts.failed} | Stalled: ${healthCounts.stalled} | Gated: ${healthCounts.gated} | Orphaned: ${healthCounts.orphaned}`,
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
                    : task.health === 'orphaned'
                      ? '👻'
                      : '❓'
        table += `| ${task.taskId} | ${statusEmoji} ${task.health} | ${task.healthDetail} |\n`
      }

      ctx.github.postComment(
        ctx.digestIssue!,
        `## 🐕 Inspector Digest\n\n${table}\n\n_Cycle ${ctx.cycleNumber}_`,
      )
      return { success: true, message: 'Digest posted' }
    },
  }
}

/**
 * Health check plugin.
 *
 * Responsibilities:
 * - Discover active Cody tasks
 * - Evaluate health (healthy, stalled, failed, gated, orphaned, unknown)
 * - Create corrective actions for orphaned, stalled, and unknown tasks
 * - Create nudge actions for gated tasks
 * - Create digest action for visibility
 * - Share evaluated tasks via state for failure-analysis plugin
 *
 * NOTE: Failed task retries are delegated to the failure-analysis plugin.
 * This plugin handles stuck/orphaned/unknown states immediately.
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

    // Share evaluated tasks with failure-analysis plugin via state
    ctx.state.set('cody:evaluatedTasks', evaluated)

    // Generate actions
    const actions: ActionRequest[] = []

    for (const task of evaluated) {
      // Orphaned tasks - immediate recovery action
      const orphaned = createOrphanedAction(task, ctx)
      if (orphaned) actions.push(orphaned)

      // Stalled tasks - warning action
      const stalled = createStalledWarningAction(task, ctx)
      if (stalled) actions.push(stalled)

      // Unknown health - notification action
      const unknown = createUnknownAction(task, ctx)
      if (unknown) actions.push(unknown)

      // Gated tasks - nudge action
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
