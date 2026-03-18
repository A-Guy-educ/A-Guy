/**
 * @fileType plugin
 * @domain inspector
 * @pattern system-test-plugin
 * @ai-summary Daily system test of the full Cody pipeline
 */

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'

const STATE_KEY = 'systemTest:lastRunDate'
const STATE_IN_PROGRESS = 'systemTest:inProgress'

/**
 * Daily system test plugin - triggers the cody-system-test.yml workflow once per day.
 */
export const systemTestPlugin: InspectorPlugin = {
  name: 'cody-system-test',
  description: 'Daily system test of the full Cody pipeline',
  domain: 'cody',
  schedule: { every: 288 }, // Every 288th cycle ≈ 24 hours (5 min × 288 = 1440 min)

  async run(ctx: InspectorContext): Promise<ActionRequest[]> {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // Check if already ran today
    const lastRunDate = ctx.state.get<string>(STATE_KEY)
    if (lastRunDate === today) {
      ctx.log.debug({ lastRunDate }, 'System test already ran today, skipping')
      return []
    }

    // Check if a run is currently in progress
    const inProgress = ctx.state.get<boolean>(STATE_IN_PROGRESS)
    if (inProgress) {
      ctx.log.debug('System test run already in progress, skipping')
      return []
    }

    // Check if workflow is already running
    const runs = ctx.github.listWorkflowRuns('cody-system-test.yml', {
      per_page: 1,
      status: 'in_progress',
    })

    if (runs.length > 0) {
      ctx.log.debug('System test workflow already running, skipping')
      return []
    }

    // Create action to trigger the workflow
    const action: ActionRequest = {
      plugin: 'cody-system-test',
      type: 'trigger-system-test',
      urgency: 'info',
      title: 'Daily Cody system test',
      detail: 'Triggering cody-system-test.yml with all scenarios',
      dedupKey: 'system-test:daily',
      dedupWindowMinutes: 1380, // 23 hours

      async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
        if (execCtx.dryRun) {
          execCtx.log.info('[dry-run] Would trigger cody-system-test.yml')
          return { success: true, message: 'dry-run: skipped' }
        }

        try {
          // Mark as in progress
          execCtx.state.set(STATE_IN_PROGRESS, true)
          execCtx.state.save()

          // Trigger the workflow
          execCtx.github.triggerWorkflow('cody-system-test.yml', {
            scenarios: 'all',
            cleanup: 'true',
          })

          // Mark as run today
          execCtx.state.set(STATE_KEY, today)
          execCtx.state.save()

          execCtx.log.info('Triggered cody-system-test.yml')
          return { success: true, message: 'System test triggered' }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          execCtx.log.error({ error: msg }, 'Failed to trigger system test')
          // Reset in-progress flag on failure
          execCtx.state.set(STATE_IN_PROGRESS, false)
          execCtx.state.save()
          return { success: false, message: msg }
        }
      },
    }

    return [action]
  },
}

export default systemTestPlugin
