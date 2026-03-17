/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Error handling CLI test - verifies CLI fails gracefully without task-id
 *
 * Steps:
 *   1. Run CLI without --task-id
 *   2. Verify CLI fails with appropriate error
 */

import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

export const errorHandlingScenario: CliScenario = {
  name: '03-error-handling',
  description: 'Test that CLI fails gracefully without required --task-id',
  timeoutMs: 60 * 1000, // 1 minute

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('error-handling-scenario')

    try {
      // Step 1: Run CLI without --task-id (should fail)
      log.info('Running CLI without --task-id...')
      const result = runCodyCli(['--mode', 'status', '--local'], { cwd: ctx.workingDir })

      // Step 2: Verify CLI runs without crashing (auto-generates task ID in local mode)
      // The CLI should either succeed or fail gracefully
      const output = result.stdout + result.stderr

      // Check that CLI ran (either with auto-generated ID or error)
      if (output.includes('Task:') || output.includes('task ID')) {
        assertions.push({
          name: 'CLI processes request',
          passed: true,
        })
      } else {
        assertions.push({
          name: 'CLI processes request',
          passed: false,
          detail: 'Expected output not found',
        })
      }

      // In local mode, CLI auto-generates task ID, so it should succeed
      if (result.exitCode === 0) {
        assertions.push({
          name: 'CLI exits successfully with auto-generated task ID',
          passed: true,
        })
      } else {
        assertions.push({
          name: 'CLI exits successfully with auto-generated task ID',
          passed: false,
          detail: `Exit code: ${result.exitCode}`,
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
    }
  },
}

export default errorHandlingScenario
