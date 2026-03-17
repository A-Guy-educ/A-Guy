/**
 * @fileType plugin
 * @domain inspector
 * @pattern cli-test-plugin
 * @ai-summary Daily system test of the Cody CLI directly
 */

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'

const STATE_KEY = 'cliTest:lastRunDate'
const STATE_IN_PROGRESS = 'cliTest:inProgress'

/**
 * Daily CLI test plugin - triggers the cody-cli-test.yml workflow once per day.
 */
export const cliTestPlugin: InspectorPlugin = {
  name: 'cody-cli-test',
  description: 'Daily system test of the Cody CLI directly',
  domain: 'cody',
  schedule: { every: 288 }, // Every 288th cycle ≈ 24 hours (5 min × 288 = 1440 min)

  async run(ctx: InspectorContext): Promise<ActionRequest[]> {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // Check if already ran today
    const lastRunDate = ctx.state.get<string>(STATE_KEY)
    if (lastRunDate === today) {
      ctx.log.debug({ lastRunDate }, 'CLI test already ran today, skipping')
      return []
    }

    // Check if a run is currently in progress
    const inProgress = ctx.state.get<boolean>(STATE_IN_PROGRESS)
    if (inProgress) {
      ctx.log.debug('CLI test run already in progress, skipping')
      return []
    }

    // Check if workflow is already running
    const runs = ctx.github.listWorkflowRuns('cody-cli-test.yml', {
      per_page: 1,
      status: 'in_progress',
    })

    if (runs.length > 0) {
      ctx.log.debug('CLI test workflow already running, skipping')
      return []
    }

    // Create action to trigger the workflow
    const action: ActionRequest = {
      plugin: 'cody-cli-test',
      type: 'trigger-cli-test',
      urgency: 'info',
      title: 'Daily Cody CLI test',
      detail: 'Triggering cody-cli-test.yml with CLI scenarios',
      dedupKey: 'cli-test:daily',
      dedupWindowMinutes: 1380, // 23 hours

      async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
        if (execCtx.dryRun) {
          execCtx.log.info('[dry-run] Would trigger cody-cli-test.yml')
          return { success: true, message: 'dry-run: skipped' }
        }

        try {
          // Mark as in progress
          execCtx.state.set(STATE_IN_PROGRESS, true)
          execCtx.state.save()

          // Trigger the workflow
          execCtx.github.triggerWorkflow('cody-cli-test.yml', {
            scenarios: 'all',
            cleanup: 'true',
          })

          // Mark as run today
          execCtx.state.set(STATE_KEY, today)
          execCtx.state.save()

          execCtx.log.info('Triggered cody-cli-test.yml')
          return { success: true, message: 'CLI test triggered' }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          execCtx.log.error({ error: msg }, 'Failed to trigger CLI test')
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

export default cliTestPlugin
