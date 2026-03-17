/**
 * @fileType scenario
 * @domain cody | cody-cli-test
 * @ai-summary Help mode CLI test - verifies --help works
 *
 * Steps:
 *   1. Run CLI with --help
 *   2. Verify output contains usage information
 */

import { runCodyCli, assertCliSuccess, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

export const helpModeScenario: CliScenario = {
  name: '02-help-mode',
  description: 'Test that --help shows usage information',
  timeoutMs: 60 * 1000, // 1 minute

  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('help-mode-scenario')

    try {
      // Step 1: Run CLI with --help
      log.info('Running CLI with --help...')
      const result = runCodyCli(['--help'], { cwd: ctx.workingDir })

      // Step 2: Verify output
      try {
        assertCliSuccess(result, 'Help mode should succeed')
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
      if (output.includes('Usage:')) {
        assertions.push({
          name: 'Output contains Usage',
          passed: true,
        })
      } else {
        assertions.push({
          name: 'Output contains Usage',
          passed: false,
          detail: 'Usage not found in output',
        })
      }

      if (output.includes('--mode')) {
        assertions.push({
          name: 'Output contains --mode option',
          passed: true,
        })
      } else {
        assertions.push({
          name: 'Output contains --mode option',
          passed: false,
          detail: '--mode option not found in output',
        })
      }

      if (output.includes('--task-id')) {
        assertions.push({
          name: 'Output contains --task-id option',
          passed: true,
        })
      } else {
        assertions.push({
          name: 'Output contains --task-id option',
          passed: false,
          detail: '--task-id option not found in output',
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

export default helpModeScenario
