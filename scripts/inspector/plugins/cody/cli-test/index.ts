import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'

const STATE_KEY = 'cliTest:lastRunDate'

export const cliTestPlugin: InspectorPlugin = {
  name: 'cody-cli-test',
  description: 'Daily CLI test',
  domain: 'cody',
  schedule: { every: 288 },
  async run(ctx: InspectorContext): Promise<ActionRequest[]> {
    const today = new Date().toISOString().slice(0, 10)
    if (ctx.state.get<string>(STATE_KEY) === today) return []
    const action: ActionRequest = {
      plugin: 'cody-cli-test',
      type: 'trigger-cli-test',
      urgency: 'info',
      title: 'Daily CLI test',
      detail: 'Triggering cody-cli-test.yml',
      dedupKey: 'cli-test:daily',
      dedupWindowMinutes: 1380,
      async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
        if (execCtx.dryRun) return { success: true, message: 'dry-run' }
        try {
          execCtx.github.triggerWorkflow('cody-cli-test.yml', {})
          execCtx.state.set(STATE_KEY, today)
          execCtx.state.save()
          return { success: true }
        } catch (e) {
          return { success: false, message: String(e) }
        }
      },
    }
    return [action]
  },
}
export default cliTestPlugin
