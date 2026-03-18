import { runCodyCli, assertCliSuccess, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

export const helpModeScenario: CliScenario = {
  name: '02-help-mode',
  description: 'Test that --help shows usage information',
  timeoutMs: 60 * 1000,
  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('help-mode-scenario')
    try {
      log.info('Running CLI with --help...')
      const result = runCodyCli(['--help'], { cwd: ctx.workingDir })
      try {
        assertCliSuccess(result, 'Help mode should succeed')
        assertions.push({ name: 'CLI exited successfully', passed: true })
      } catch (error) {
        assertions.push({ name: 'CLI exited successfully', passed: false, detail: String(error) })
      }
      const output = result.stdout + result.stderr
      if (output.includes('Usage:'))
        assertions.push({ name: 'Output contains Usage', passed: true })
      else assertions.push({ name: 'Output contains Usage', passed: false })
      if (output.includes('--mode'))
        assertions.push({ name: 'Output contains --mode option', passed: true })
      else assertions.push({ name: 'Output contains --mode option', passed: false })
      if (output.includes('--task-id'))
        assertions.push({ name: 'Output contains --task-id option', passed: true })
      else assertions.push({ name: 'Output contains --task-id option', passed: false })
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
