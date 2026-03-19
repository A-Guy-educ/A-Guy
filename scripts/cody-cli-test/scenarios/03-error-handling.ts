import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

export const errorHandlingScenario: CliScenario = {
  name: '03-error-handling',
  description: 'Test that CLI handles missing --task-id gracefully',
  timeoutMs: 60 * 1000,
  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('error-handling-scenario')
    try {
      log.info('Running CLI without --task-id...')
      const result = runCodyCli(['--mode', 'status', '--local'], { cwd: ctx.workingDir })
      const output = result.stdout + result.stderr
      if (output.includes('Task:') || output.includes('task ID'))
        assertions.push({ name: 'CLI processes request', passed: true })
      else
        assertions.push({
          name: 'CLI processes request',
          passed: false,
          detail: 'Expected output not found',
        })
      if (result.exitCode === 0)
        assertions.push({
          name: 'CLI exits successfully with auto-generated task ID',
          passed: true,
        })
      else
        assertions.push({
          name: 'CLI exits successfully with auto-generated task ID',
          passed: false,
          detail: `Exit code: ${result.exitCode}`,
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
    }
  },
}
export default errorHandlingScenario
