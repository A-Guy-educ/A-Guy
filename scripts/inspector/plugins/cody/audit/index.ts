/**
 * @fileType plugin
 * @domain inspector
 * @pattern audit-plugin
 * @ai-summary Analyze completed pipeline runs and create improvement issues
 */

import * as fs from 'fs'
import * as path from 'path'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import type { TaskSnapshot } from '../../../core/types'
import { analyzeRun } from './analyzer'
import { createImprovementIssueAction } from './actions/create-issue'
import type { AuditInput } from './types'

const MAX_OPEN_AUDIT_ISSUES = 5
const AUDIT_LABEL = 'cody:audit'

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
  schedule: { every: 3 }, // Every 3rd cycle (15 min)

  async run(ctx) {
    ctx.log.debug('Running audit plugin')

    // Check for existing open audit issues - cap at MAX_OPEN_AUDIT_ISSUES
    const existingAuditIssues = ctx.github.searchIssues(`is:open label:${AUDIT_LABEL}`)
    const tooManyOpen = existingAuditIssues.length >= MAX_OPEN_AUDIT_ISSUES

    if (tooManyOpen) {
      ctx.log.info(
        { openCount: existingAuditIssues.length, limit: MAX_OPEN_AUDIT_ISSUES },
        'Too many open audit issues — skipping new issue creation',
      )
      // Still audit tasks but skip creating new issues
    }

    // Get already-audited tasks from state
    const auditedTasks = ctx.state.get<string[]>('cody:auditedTasks') || []
    ctx.log.debug({ auditedCount: auditedTasks.length }, 'Previously audited tasks')

    // Discover completed tasks
    const tasks = await discoverCompletedTasks(ctx)
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

      // Create issues for each improvement, but only if under the limit
      for (const improvement of result.improvements) {
        // Check if we've already hit the limit (include actions we're about to create)
        const pendingActions = actions.filter((a) => a.type === 'create-audit-issue').length
        if (tooManyOpen && pendingActions >= MAX_OPEN_AUDIT_ISSUES - existingAuditIssues.length) {
          ctx.log.debug('Skipping audit issue creation - at limit')
          break
        }
        actions.push(createImprovementIssueAction(task.taskId, improvement, ctx))
      }

      // Mark task as audited
      auditedTasks.push(task.taskId)
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
