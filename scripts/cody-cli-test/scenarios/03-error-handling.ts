import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

export const errorHandlingScenario: CliScenario = {
  name: '03-error-handling',
  description: 'Test CLI handles no --task-id',
  timeoutMs: 60 * 1000,
  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const result = runCodyCli(['--mode', 'status', '--local'], { cwd: ctx.workingDir })
    const out = result.stdout + result.stderr
    assertions.push({ name: 'CLI runs', passed: out.includes('Task:') || out.includes('task ID') })
    return {
      name: this.name,
      passed: assertions.every((a) => a.passed),
      duration: Date.now() - startTime,
      assertions,
    }
  },
}
export default errorHandlingScenario
