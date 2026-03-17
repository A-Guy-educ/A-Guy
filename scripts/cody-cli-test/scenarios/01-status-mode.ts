/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Status mode CLI test - verifies status command works
 *
 * Steps:
 *   1. Create a task directory with a valid status.json
 *   2. Run CLI with --mode=status
 *   3. Verify output contains task information
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

import { runCodyCli, assertCliSuccess, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '250101-cli-test-status'

export const statusModeScenario: CliScenario = {
  name: '01-status-mode',
  description: 'Test that --mode=status works with a valid task',
  timeoutMs: 2 * 60 * 1000, // 2 minutes

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('status-mode-scenario')

    const taskDir = join(ctx.workingDir, '.tasks', SCENARIO_TASK_ID)

    try {
      // Step 1: Create task directory with valid status.json
      log.info('Creating task directory with status.json...')
      mkdirSync(taskDir, { recursive: true })

      const statusJson = {
        taskId: SCENARIO_TASK_ID,
        state: 'completed',
        mode: 'full',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stages: {
          taskify: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 1000 },
          gap: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 2000 },
          architect: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 3000 },
          build: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 10000 },
          commit: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 500 },
          review: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 4000 },
          verify: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 6000 },
          pr: { state: 'completed', startedAt: new Date().toISOString(), elapsed: 2000 },
        },
        cost: 0.15,
      }

      writeFileSync(join(taskDir, 'status.json'), JSON.stringify(statusJson, null, 2))
      assertions.push({
        name: 'Created task directory with status.json',
        passed: true,
      })

      // Step 2: Run CLI with --mode=status
      log.info('Running CLI with --mode=status...')
      const result = runCodyCli(
        [
          '--task-id',
          SCENARIO_TASK_ID,
          '--mode',
          'status',
          '--local', // Skip GitHub API
        ],
        { cwd: ctx.workingDir },
      )

      // Step 3: Verify output
      try {
        assertCliSuccess(result, 'Status mode should succeed')
        assertions.push({
          name: 'CLI exited successfully',
          passed: true,
        })
      } catch (error) {
        assertions.push({
          name: 'CLI exited successfully',
          passed: false,
          detail: String(error),
        })
      }

      // Check output contains expected info
      const output = result.stdout + result.stderr
      if (output.includes(SCENARIO_TASK_ID)) {
        assertions.push({
          name: 'Output contains task ID',
          passed: true,
        })
      } else {
        assertions.push({
          name: 'Output contains task ID',
          passed: false,
          detail: 'Task ID not found in output',
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
      // Cleanup
      if (existsSync(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true })
      }
    }
  },
}

export default statusModeScenario
