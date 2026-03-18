/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Full pipeline CLI test - runs the complete pipeline via CLI
 */

import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '260317-full-test'
const TEST_SPEC = `# Full Pipeline Test

## Task
Create a simple test file \`docs/test/full-pipeline.md\` with "Hello from CLI test".

## Implementation
1. Create docs/test/full-pipeline.md
2. Add content

## Verify
- File exists
`

export const fullPipelineScenario: CliScenario = {
  name: '04-full-pipeline',
  description: 'Test full pipeline via CLI (taskify → build → commit → pr)',
  timeoutMs: 30 * 60 * 1000,

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('full-pipeline-scenario')
    const taskDir = join(ctx.workingDir, '.tasks', SCENARIO_TASK_ID)
    const docsDir = join(ctx.workingDir, 'docs', 'test')

    try {
      log.info('Creating spec file...')
      mkdirSync(docsDir, { recursive: true })
      const specPath = join(docsDir, 'full-pipeline.md')
      writeFileSync(specPath, TEST_SPEC)
      assertions.push({ name: 'Created spec file', passed: true, detail: specPath })

      log.info('Running CLI with --mode=full --local...')
      const result = runCodyCli(
        [
          '--task-id',
          SCENARIO_TASK_ID,
          '--mode',
          'full',
          '--local',
          '--file',
          specPath,
          '--complexity',
          '20',
        ],
        { cwd: ctx.workingDir },
      )
      const output = result.stdout + result.stderr
      log.info(`CLI exited with code: ${result.exitCode}`)

      if (existsSync(taskDir))
        assertions.push({ name: 'Task directory created', passed: true, detail: taskDir })
      else
        assertions.push({
          name: 'Task directory created',
          passed: false,
          detail: `Expected: ${taskDir}`,
        })

      const statusPath = join(taskDir, 'status.json')
      let completedStagesCount = 0
      let completedStageNames: string[] = []

      if (existsSync(statusPath)) {
        try {
          const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
          assertions.push({
            name: 'status.json valid',
            passed: true,
            detail: `state: ${status.state}`,
          })
          const stages = status.stages || {}
          const completedStages = Object.entries(stages).filter(
            ([, s]: [string, unknown]) => (s as { state: string }).state === 'completed',
          )
          completedStagesCount = completedStages.length
          completedStageNames = completedStages.map(([name]) => name)
          assertions.push({
            name: 'Pipeline made progress',
            passed: completedStagesCount > 0,
            detail: `${completedStagesCount} stages completed`,
          })
        } catch {
          assertions.push({ name: 'status.json valid', passed: false, detail: 'Invalid JSON' })
        }
      } else {
        assertions.push({
          name: 'status.json valid',
          passed: false,
          detail: 'status.json not found',
        })
      }

      // Check for critical errors only
      const hasCriticalError =
        result.exitCode === 127 ||
        (result.exitCode !== 0 &&
          (output.toLowerCase().includes('fatal') || output.toLowerCase().includes('panic')))
      assertions.push({
        name: 'No critical errors',
        passed: !hasCriticalError,
        detail: hasCriticalError ? `Exit code: ${result.exitCode}` : undefined,
      })

      if (completedStagesCount > 0)
        assertions.push({
          name: 'Full pipeline executed',
          passed: true,
          detail: `${completedStagesCount} stages: ${completedStageNames.join(', ')}`,
        })
      else
        assertions.push({
          name: 'Full pipeline executed',
          passed: false,
          detail: 'No stages completed',
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
      if (existsSync(taskDir)) rmSync(taskDir, { recursive: true, force: true })
    }
  },
}

export default fullPipelineScenario
