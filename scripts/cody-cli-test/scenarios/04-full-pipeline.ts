/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Full pipeline CLI test - runs the complete pipeline via CLI
 *
 * Steps:
 *   1. Create a spec file with a simple task
 *   2. Run CLI with --mode=full --local
 *   3. Verify task directory is created
 *   4. Verify status.json shows pipeline progress
 */

import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '260317-full-test'

// Simple spec for testing
const TEST_SPEC = `# Full Pipeline Test

## Task
Create a simple test file \`docs/test/full-pipeline.md\` with the content "Hello from CLI test".

## Implementation
1. Create the file at docs/test/full-pipeline.md
2. Add content: "# Full Pipeline Test\\n\\nHello from CLI test"

## Verify
- File exists at docs/test/full-pipeline.md
- Contains "Hello from CLI test"
`

export const fullPipelineScenario: CliScenario = {
  name: '04-full-pipeline',
  description: 'Test full pipeline via CLI (taskify → build → commit → pr)',
  timeoutMs: 30 * 60 * 1000, // 30 minutes - full pipeline takes time

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('full-pipeline-scenario')

    const taskDir = join(ctx.workingDir, '.tasks', SCENARIO_TASK_ID)
    const docsDir = join(ctx.workingDir, 'docs', 'test')

    try {
      // Step 1: Create spec file
      log.info('Creating spec file...')

      // Create docs/test directory
      mkdirSync(docsDir, { recursive: true })

      const specPath = join(docsDir, 'full-pipeline.md')
      writeFileSync(specPath, TEST_SPEC)
      assertions.push({
        name: 'Created spec file',
        passed: true,
        detail: specPath,
      })

      // Step 2: Run CLI with --mode=full --local
      log.info('Running CLI with --mode=full --local...')

      const result = runCodyCli(
        [
          '--task-id',
          SCENARIO_TASK_ID,
          '--mode',
          'full',
          '--local', // Run locally without GitHub API
          '--file',
          specPath,
          '--complexity',
          '20', // Low complexity for faster test
        ],
        { cwd: ctx.workingDir },
      )

      const output = result.stdout + result.stderr
      log.info(`CLI exited with code: ${result.exitCode}`)

      // Step 3: Verify task directory exists
      if (existsSync(taskDir)) {
        assertions.push({
          name: 'Task directory created',
          passed: true,
          detail: taskDir,
        })
      } else {
        assertions.push({
          name: 'Task directory created',
          passed: false,
          detail: `Expected: ${taskDir}`,
        })
      }

      // Step 4: Check status.json
      const statusPath = join(taskDir, 'status.json')
      if (existsSync(statusPath)) {
        try {
          const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
          assertions.push({
            name: 'status.json valid',
            passed: true,
            detail: `state: ${status.state}`,
          })

          // Check if any stages ran
          const stages = status.stages || {}
          const completedStages = Object.entries(stages).filter(
            ([, s]: [string, unknown]) => (s as { state: string }).state === 'completed',
          )
          assertions.push({
            name: 'Pipeline made progress',
            passed: completedStages.length > 0,
            detail: `${completedStages.length} stages completed`,
          })
        } catch {
          assertions.push({
            name: 'status.json valid',
            passed: false,
            detail: 'Invalid JSON',
          })
        }
      } else {
        assertions.push({
          name: 'status.json valid',
          passed: false,
          detail: 'status.json not found',
        })
      }

      // Check output for errors
      const hasError = output.toLowerCase().includes('error') && result.exitCode !== 0
      if (!hasError) {
        assertions.push({
          name: 'No critical errors',
          passed: true,
        })
      } else {
        assertions.push({
          name: 'No critical errors',
          passed: false,
          detail: 'Errors found in output',
        })
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
      // Cleanup - but don't delete the created file to verify it was created
      if (existsSync(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true })
      }
    }
  },
}

export default fullPipelineScenario
