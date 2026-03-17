import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { runCodyCli, assertCliSuccess, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '250101-cli-test-status'

export const statusModeScenario: CliScenario = {
  name: '01-status-mode',
  description: 'Test --mode=status with valid task',
  timeoutMs: 2 * 60 * 1000,
  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('status-mode')
    const taskDir = join(ctx.workingDir, '.tasks', SCENARIO_TASK_ID)
    try {
      log.info('Creating task dir...')
      mkdirSync(taskDir, { recursive: true })
      writeFileSync(
        join(taskDir, 'status.json'),
        JSON.stringify(
          {
            taskId: SCENARIO_TASK_ID,
            state: 'completed',
            stages: { taskify: { state: 'completed' } },
          },
          null,
          2,
        ),
      )
      assertions.push({ name: 'Created task dir', passed: true })
      const result = runCodyCli(['--task-id', SCENARIO_TASK_ID, '--mode', 'status', '--local'], {
        cwd: ctx.workingDir,
      })
      try {
        assertCliSuccess(result, 'Status')
        assertions.push({ name: 'CLI ok', passed: true })
      } catch (e) {
        assertions.push({ name: 'CLI ok', passed: false, detail: String(e) })
      }
      const out = result.stdout + result.stderr
      assertions.push({ name: 'Output has task ID', passed: out.includes(SCENARIO_TASK_ID) })
      return {
        name: this.name,
        passed: assertions.every((a) => a.passed),
        duration: Date.now() - startTime,
        assertions,
      }
    } catch (e) {
      return {
        name: this.name,
        passed: false,
        duration: Date.now() - startTime,
        assertions,
        error: String(e),
      }
    } finally {
      if (existsSync(taskDir)) rmSync(taskDir, { recursive: true, force: true })
    }
  },
}
export default statusModeScenario
