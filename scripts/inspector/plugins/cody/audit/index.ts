/**
 * @fileType plugin
 * @domain inspector
 * @pattern audit-plugin
 * @ai-summary Analyze completed pipeline runs and create improvement issues
 */

import * as fs from 'fs'
import * as path from 'path'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import type { TaskSnapshot, EvaluatedTask } from '../../../core/types'
import { analyzeRun } from './analyzer'
import { createImprovementIssueAction } from './actions/create-issue'
import type { AuditInput } from './types'

/**
 * Read task files for audit analysis.
 */
function readTaskFiles(taskId: string, taskDir: string): AuditInput {
  const readFile = (filename: string): string => {
    const filePath = path.join(taskDir, filename)
    if (!fs.existsSync(filePath)) {
      return ''
    }
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch {
      return ''
    }
  }

  return {
    taskId,
    taskMd: readFile('task.md'),
    specMd: readFile('spec.md'),
    buildMd: readFile('build.md'),
    verifyMd: readFile('verify.md'),
  }
}

/**
 * Discover tasks that have completed since last audit.
 */
async function discoverCompletedTasks(_ctx: InspectorContext): Promise<TaskSnapshot[]> {
  const tasksDir = path.join(process.cwd(), '.tasks')

  if (!fs.existsSync(tasksDir)) {
    return []
  }

  const entries = fs.readdirSync(tasksDir, { withFileTypes: true })
  const taskDirs = entries.filter((e) => e.isDirectory())

  const completedTasks: TaskSnapshot[] = []

  for (const entry of taskDirs) {
    const taskId = entry.name
    const taskDir = path.join(tasksDir, taskId)
    const statusPath = path.join(taskDir, 'status.json')

    if (!fs.existsSync(statusPath)) {
      continue
    }

    try {
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
      if (status.state === 'completed') {
        completedTasks.push({
          taskId,
          issueNumber: status.issueNumber || 0,
          issueTitle: status.issueTitle || taskId,
          labels: status.labels || [],
          status,
          issueUpdatedAt: status.issueUpdatedAt || new Date().toISOString(),
          statusUpdatedAt: status.updatedAt || null,
        })
      }
    } catch {
      // Skip invalid status files
    }
  }

  return completedTasks
}

/**
 * Audit plugin - analyzes completed tasks and creates improvement issues.
 *
 * Runs every 3rd cycle (every 15 minutes) to avoid overwhelming with issues.
 */
export const auditPlugin: InspectorPlugin = {
  name: 'cody-audit',
  description: 'Analyze completed pipeline runs and create improvement issues',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx) {
    ctx.log.debug('Running audit plugin')

    // Get already-audited tasks from state
    const auditedTasks = ctx.state.get<string[]>('cody:auditedTasks') || []
    ctx.log.debug({ auditedCount: auditedTasks.length }, 'Previously audited tasks')

    // Discover completed tasks from .tasks/ directory (when status.json is on default branch)
    let tasks = await discoverCompletedTasks(ctx)

    // FIX #13: Also check evaluatedTasks from health-check — picks up cody:done tasks
    // where status.json is on the feature branch, not the default branch
    if (tasks.length === 0) {
      const evaluated = ctx.state.get<EvaluatedTask[]>('cody:evaluatedTasks') || []
      tasks = evaluated.filter((t) => t.health === 'completed' || t.labels?.includes('cody:done'))
    }
    ctx.log.debug({ taskCount: tasks.length }, 'Discovered completed tasks')

    const actions: ActionRequest[] = []

    for (const task of tasks) {
      // Skip already-audited tasks
      if (auditedTasks.includes(task.taskId)) {
        ctx.log.debug({ taskId: task.taskId }, 'Skipping already-audited task')
        continue
      }

      const taskDir = path.join(process.cwd(), '.tasks', task.taskId)

      // Read task files for analysis
      const input = readTaskFiles(task.taskId, taskDir)

      // Skip if no meaningful content to analyze
      if (!input.taskMd && !input.buildMd && !input.verifyMd) {
        ctx.log.debug({ taskId: task.taskId }, 'Skipping task with no content')
        continue
      }

      // Analyze the run
      let result
      try {
        result = await analyzeRun(input)
      } catch (error) {
        ctx.log.error({ taskId: task.taskId, error }, 'Failed to analyze task')
        continue
      }

      // Create issues for each improvement
      for (const improvement of result.improvements) {
        actions.push(createImprovementIssueAction(task.taskId, improvement, ctx))
      }

      // Mark task as audited — cap at 200 entries to prevent unbounded growth
      auditedTasks.push(task.taskId)
      while (auditedTasks.length > 200) auditedTasks.shift()
      ctx.log.info(
        { taskId: task.taskId, improvementCount: result.improvements.length },
        'Audited task',
      )
    }

    // Save updated audited tasks list
    ctx.state.set('cody:auditedTasks', auditedTasks)

    ctx.log.debug({ actionCount: actions.length }, 'Generated audit actions')

    return actions
  },
}
