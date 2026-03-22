/**
 * @fileType plugin
 * @domain inspector
 * @ai-summary Nightly E2E system tests and QA scenarios runner
 */

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'

const STATE_KEY = 'e2eTest:lastRunDate'
const STATE_IN_PROGRESS = 'e2eTest:inProgress'

export const e2eTestPlugin: InspectorPlugin = {
  name: 'cody-e2e-test',
  description: 'Nightly E2E system tests and QA scenarios runner',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx: InspectorContext): Promise<ActionRequest[]> {
    const today = new Date().toISOString().slice(0, 10)
    const lastRunDate = ctx.state.get<string>(STATE_KEY)
    if (lastRunDate === today) {
      ctx.log.debug({ lastRunDate }, 'E2E test already ran today, skipping')
      return []
    }

    const inProgress = ctx.state.get<boolean>(STATE_IN_PROGRESS)
    if (inProgress) {
      ctx.log.debug('E2E test run already in progress, skipping')
      return []
    }

    const runs = ctx.github.listWorkflowRuns('ci.yml', {
      per_page: 1,
      status: 'in_progress',
    })
    if (runs.length > 0) {
      ctx.log.debug('E2E test workflow already running, skipping')
      return []
    }

    const action: ActionRequest = {
      plugin: 'cody-e2e-test',
      type: 'trigger-e2e-test',
      urgency: 'info',
      title: 'Nightly E2E tests and QA scenarios',
      detail: 'Triggering ci.yml with E2E tests and QA scenarios',
      dedupKey: 'e2e-test:daily',
      dedupWindowMinutes: 1380,

      async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
        if (execCtx.dryRun) {
          execCtx.log.info('[dry-run] Would trigger ci.yml for E2E tests')
          return { success: true, message: 'dry-run: skipped' }
        }
        try {
          execCtx.state.set(STATE_IN_PROGRESS, true)
          execCtx.state.save()
          execCtx.github.triggerWorkflow('ci.yml', { run_e2e_tests: 'true' })
          execCtx.state.set(STATE_KEY, today)
          execCtx.state.save()
          execCtx.log.info('Triggered ci.yml for E2E tests')
          return { success: true, message: 'E2E test triggered' }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          execCtx.log.error({ error: msg }, 'Failed to trigger E2E test')
          execCtx.state.set(STATE_IN_PROGRESS, false)
          execCtx.state.save()
          return { success: false, message: msg }
        }
      },
    }
    return [action]
  },
}

export default e2eTestPlugin
