/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Bad spec failure test - verifies pipeline fails gracefully with invalid input
 */

import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '260318-bad-spec'

export const badSpecScenario: CliScenario = {
  name: '07-bad-spec-failure',
  description: 'Test pipeline fails gracefully with empty/invalid spec file',
  timeoutMs: 2 * 60 * 1000,

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('bad-spec-scenario')
    const taskDir = join(ctx.workingDir, '.tasks', SCENARIO_TASK_ID)
    const docsDir = join(ctx.workingDir, 'docs', 'test')

    try {
      // Create an empty spec file
      mkdirSync(docsDir, { recursive: true })
      const specPath = join(docsDir, 'bad-spec.md')
      writeFileSync(specPath, '')
      assertions.push({ name: 'Created empty spec file', passed: true })

      log.info('Running CLI with empty spec file...')
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
          '10',
        ],
        { cwd: ctx.workingDir },
      )
      log.info(`CLI exited with code: ${result.exitCode}`)

      // Pipeline should fail (non-zero exit) or handle gracefully
      const output = result.stdout + result.stderr

      // Should not crash with unhandled exception
      const hasUnhandled = output.includes('UnhandledPromiseRejection') || output.includes('FATAL')
      assertions.push({
        name: 'No unhandled crashes',
        passed: !hasUnhandled,
        detail: hasUnhandled ? 'Found unhandled error' : 'clean failure',
      })

      // Status.json should exist and show failed state
      const statusPath = join(taskDir, 'status.json')
      if (existsSync(statusPath)) {
        try {
          const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
          assertions.push({
            name: 'status.json created',
            passed: true,
            detail: `state: ${status.state}`,
          })

          // State should be failed (not stuck in running)
          const isFailed = status.state === 'failed' || status.state === 'completed'
          assertions.push({
            name: 'Pipeline reached terminal state',
            passed: isFailed,
            detail: `state: ${status.state}`,
          })
        } catch {
          assertions.push({ name: 'status.json valid JSON', passed: false, detail: 'parse error' })
        }
      } else {
        // Task dir might not even be created for truly empty specs - that's OK
        assertions.push({
          name: 'Pipeline handled empty spec',
          passed: true,
          detail: 'no task dir created (early rejection)',
        })
      }

      // Exit code should be non-zero (pipeline should not succeed with empty spec)
      assertions.push({
        name: 'Non-zero exit code',
        passed: result.exitCode !== 0,
        detail: `exit code: ${result.exitCode}`,
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
      const specPath = join(docsDir, 'bad-spec.md')
      if (existsSync(specPath)) rmSync(specPath)
    }
  },
}

export default badSpecScenario
