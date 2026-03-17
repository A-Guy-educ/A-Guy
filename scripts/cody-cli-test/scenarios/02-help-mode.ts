import { runCodyCli, assertCliSuccess, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

export const helpModeScenario: CliScenario = {
  name: '02-help-mode',
  description: 'Test --help',
  timeoutMs: 60 * 1000,
  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const result = runCodyCli(['--help'], { cwd: ctx.workingDir })
    try {
      assertCliSuccess(result, 'Help')
      assertions.push({ name: 'CLI ok', passed: true })
    } catch (e) {
      assertions.push({ name: 'CLI ok', passed: false, detail: String(e) })
    }
    const out = result.stdout + result.stderr
    assertions.push({ name: 'Has Usage', passed: out.includes('Usage:') })
    assertions.push({ name: 'Has --mode', passed: out.includes('--mode') })
    assertions.push({ name: 'Has --task-id', passed: out.includes('--task-id') })
    return {
      name: this.name,
      passed: assertions.every((a) => a.passed),
      duration: Date.now() - startTime,
      assertions,
    }
  },
}
export default helpModeScenario
