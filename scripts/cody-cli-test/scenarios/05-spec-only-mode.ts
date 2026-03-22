/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Spec-only mode test - runs only spec stages (taskify + gap + architect)
 */

import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '260318-spec-only'
const TEST_SPEC = `# Spec Only Test

## Task
Add a greeting utility function to src/infra/utils/greeting.ts

## Requirements
- Export a greet(name: string) function
- Returns "Hello, {name}!"
`

export const specOnlyScenario: CliScenario = {
  name: '05-spec-only-mode',
  description: 'Test --mode=spec runs only spec stages, not build/commit/pr',
  timeoutMs: 5 * 60 * 1000,

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('spec-only-scenario')
    const taskDir = join(ctx.workingDir, '.tasks', SCENARIO_TASK_ID)
    const docsDir = join(ctx.workingDir, 'docs', 'test')

    try {
      mkdirSync(docsDir, { recursive: true })
      const specPath = join(docsDir, 'spec-only.md')
      writeFileSync(specPath, TEST_SPEC)
      assertions.push({ name: 'Created spec file', passed: true })

      log.info('Running CLI with --mode=spec --local...')
      const result = runCodyCli(
        [
          '--task-id',
          SCENARIO_TASK_ID,
          '--mode',
          'spec',
          '--local',
          '--file',
          specPath,
          '--complexity',
          '20',
        ],
        { cwd: ctx.workingDir },
      )
      log.info(`CLI exited with code: ${result.exitCode}`)

      // Check task directory created
      assertions.push({
        name: 'Task directory created',
        passed: existsSync(taskDir),
        detail: existsSync(taskDir) ? taskDir : `Expected: ${taskDir}`,
      })

      // Check status.json
      const statusPath = join(taskDir, 'status.json')
      if (existsSync(statusPath)) {
        const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
        const stages = status.stages || {}
        const completedNames = Object.entries(stages)
          .filter(([, s]: [string, unknown]) => (s as { state: string }).state === 'completed')
          .map(([name]) => name)

        // Spec stages should have run
        const hasTaskify = completedNames.includes('taskify')
        assertions.push({
          name: 'Taskify stage completed',
          passed: hasTaskify,
          detail: hasTaskify ? 'completed' : `Completed: ${completedNames.join(', ')}`,
        })

        // Build stage should NOT have run
        const hasBuild = completedNames.includes('build')
        assertions.push({
          name: 'Build stage did NOT run',
          passed: !hasBuild,
          detail: hasBuild ? 'build ran unexpectedly' : 'correctly skipped',
        })

        // PR stage should NOT have run
        const hasPr = completedNames.includes('pr')
        assertions.push({
          name: 'PR stage did NOT run',
          passed: !hasPr,
          detail: hasPr ? 'pr ran unexpectedly' : 'correctly skipped',
        })

        // task.json should exist (taskify output)
        const hasTaskJson = existsSync(join(taskDir, 'task.json'))
        assertions.push({
          name: 'task.json created',
          passed: hasTaskJson,
        })
      } else {
        assertions.push({ name: 'status.json exists', passed: false, detail: 'not found' })
      }

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
      if (existsSync(taskDir)) rmSync(taskDir, { recursive: true, force: true })
      const specPath = join(docsDir, 'spec-only.md')
      if (existsSync(specPath)) rmSync(specPath)
    }
  },
}

export default specOnlyScenario
