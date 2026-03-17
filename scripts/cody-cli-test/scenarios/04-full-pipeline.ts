import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { runCodyCli, createTestLogger } from '../lib'
import type { CliScenarioContext, CliScenario, CliScenarioResult } from './types'

const SCENARIO_TASK_ID = '260317-full-test'

export const fullPipelineScenario: CliScenario = {
  name: '04-full-pipeline',
  description: 'Test full pipeline via CLI',
  timeoutMs: 30 * 60 * 1000,
  async run(ctx: CliScenarioContext): Promise<CliScenarioResult> {
    const startTime = Date.now()
    const assertions: CliScenarioResult['assertions'] = []
    const log = createTestLogger('full-pipeline')
    const taskDir = join(ctx.workingDir, '.tasks', SCENARIO_TASK_ID)
    const docsDir = join(ctx.workingDir, 'docs', 'test')
    try {
      log.info('Creating spec...')
      mkdirSync(docsDir, { recursive: true })
      writeFileSync(join(docsDir, 'full-pipeline.md'), '# Test\n\nHello')
      assertions.push({ name: 'Created spec', passed: true })
      const result = runCodyCli(
        [
          '--task-id',
          SCENARIO_TASK_ID,
          '--mode',
          'full',
          '--local',
          '--file',
          join(docsDir, 'full-pipeline.md'),
          '--complexity',
          '20',
        ],
        { cwd: ctx.workingDir },
      )
      const out = result.stdout + result.stderr
      assertions.push({ name: 'Task dir exists', passed: existsSync(taskDir), detail: taskDir })
      const statusPath = join(taskDir, 'status.json')
      if (existsSync(statusPath)) {
        const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
        const completed = Object.values(status.stages || {}).filter(
          (s: unknown) => (s as { state: string }).state === 'completed',
        ).length
        assertions.push({
          name: 'Pipeline progress',
          passed: completed > 0,
          detail: `${completed} stages`,
        })
      }
      // Ignore exit code 127 (ocode not found in CI)
      const hasFatal =
        result.exitCode !== 0 && result.exitCode !== 127 && out.toLowerCase().includes('fatal')
      assertions.push({ name: 'No fatal errors', passed: !hasFatal })
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
export default fullPipelineScenario
