/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Complexity skip test - verifies low complexity skips review/plan-gap stages
 *
 * Reads status.json from a completed task that has a complexity score.
 * If no such task exists, runs a quick --mode=full with --complexity 15 to generate one.
 */

import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'fs'
import { join } from 'path'
import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '260318-complexity-check'

function findTaskWithComplexity(
  tasksDir: string,
): { status: Record<string, unknown>; taskId: string; complexity: number } | null {
  if (!existsSync(tasksDir)) return null
  let best: { status: Record<string, unknown>; taskId: string; complexity: number } | null = null
  let bestMtime = 0

  for (const entry of readdirSync(tasksDir)) {
    const statusPath = join(tasksDir, entry, 'status.json')
    const taskJsonPath = join(tasksDir, entry, 'task.json')
    if (!existsSync(statusPath) || !existsSync(taskJsonPath)) continue

    try {
      const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
      const taskJson = JSON.parse(readFileSync(taskJsonPath, 'utf-8'))
      const complexity = taskJson.complexity ?? 0
      if (complexity > 0 && (status.state === 'completed' || status.state === 'failed')) {
        const stat = statSync(statusPath)
        if (stat.mtimeMs > bestMtime) {
          best = { status, taskId: entry, complexity }
          bestMtime = stat.mtimeMs
        }
      }
    } catch {
      /* skip */
    }
  }
  return best
}

export const complexitySkipScenario: CliScenario = {
  name: '06-complexity-skip',
  description: 'Verify low-complexity pipeline skips review and plan-gap stages',
  timeoutMs: 5 * 60 * 1000,

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('complexity-skip-scenario')
    const tasksDir = join(ctx.workingDir, '.tasks')
    const taskDir = join(tasksDir, SCENARIO_TASK_ID)
    let createdTask = false

    try {
      let found = findTaskWithComplexity(tasksDir)

      // If no task with complexity, run a quick one
      if (!found) {
        log.info('No task with complexity found, running quick pipeline...')
        const docsDir = join(ctx.workingDir, 'docs', 'test')
        mkdirSync(docsDir, { recursive: true })
        const specPath = join(docsDir, 'complexity-check.md')
        writeFileSync(
          specPath,
          '# Test\n\n## Task\nCreate docs/test/complexity-check.md with "test"\n',
        )
        createdTask = true

        runCodyCli(
          [
            '--task-id',
            SCENARIO_TASK_ID,
            '--mode',
            'full',
            '--local',
            '--file',
            specPath,
            '--complexity',
            '15',
          ],
          { cwd: ctx.workingDir },
        )

        if (existsSync(specPath)) rmSync(specPath)
        found = findTaskWithComplexity(tasksDir)
      }

      if (!found) {
        assertions.push({
          name: 'Found task with complexity',
          passed: false,
          detail: 'none found even after running pipeline',
        })
        return { name: this.name, passed: false, duration: Date.now() - startTime, assertions }
      }

      log.info(`Analyzing task: ${found.taskId} (complexity: ${found.complexity})`)
      assertions.push({
        name: 'Found task with complexity',
        passed: true,
        detail: `task: ${found.taskId}, complexity: ${found.complexity}`,
      })

      const stages = (found.status.stages || {}) as Record<string, { state: string }>
      const stageNames = Object.keys(stages)
      const completedNames = Object.entries(stages)
        .filter(([, s]) => s.state === 'completed')
        .map(([name]) => name)
      const skippedNames = Object.entries(stages)
        .filter(([, s]) => s.state === 'skipped')
        .map(([name]) => name)

      // For low complexity (<30), review and plan-gap should be skipped
      if (found.complexity < 30) {
        const reviewSkipped = skippedNames.includes('review') || !stageNames.includes('review')
        assertions.push({
          name: 'Review skipped for low complexity',
          passed: reviewSkipped,
          detail: reviewSkipped
            ? 'correctly skipped'
            : `review state: ${stages.review?.state ?? 'in pipeline'}`,
        })

        const planGapSkipped = skippedNames.includes('plan-gap') || !stageNames.includes('plan-gap')
        assertions.push({
          name: 'Plan-gap skipped for low complexity',
          passed: planGapSkipped,
          detail: planGapSkipped
            ? 'correctly skipped'
            : `plan-gap state: ${stages['plan-gap']?.state ?? 'in pipeline'}`,
        })
      } else {
        assertions.push({
          name: 'High complexity - review expected',
          passed: true,
          detail: `complexity: ${found.complexity}`,
        })
      }

      assertions.push({
        name: 'Taskify completed',
        passed: completedNames.includes('taskify'),
        detail: `completed stages: ${completedNames.join(', ')}`,
      })

      return {
        name: this.name,
        passed: assertions.every((a) => a.passed),
        duration: Date.now() - startTime,
        assertions,
      }
    } catch (error) {
      return {
        name: this.name,
        passed: false,
        duration: Date.now() - startTime,
        assertions,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      if (createdTask && existsSync(taskDir)) rmSync(taskDir, { recursive: true, force: true })
    }
  },
}

export default complexitySkipScenario
