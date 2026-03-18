/**
 * @fileType plugin
 * @domain inspector
 * @pattern docs-sync-plugin
 * @ai-summary Runs nightly-docs agent as a deferred inspector plugin (~once daily)
 *
 * Migrated from .github/workflows/nightly-docs.yml (daily cron at 02:00 UTC).
 * Uses dedupWindowMinutes: 1380 (~23h) to run approximately once per day.
 * Runs every 6th cycle (~30 min), but dedup ensures only one execution per day.
 *
 * The nightly-docs agent detects structural changes and opens a PR when
 * doc-impacting changes are found. No-op exits (code 0) are treated as success.
 */

import { execFileSync } from 'child_process'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../core/types'

const DEDUP_KEY = 'docs-sync:nightly-run'
// 23 hours in minutes — ensures ~once daily, robust against clock drift
const DEDUP_WINDOW_MINUTES = 1380

function runNightlyDocs(dryRun: boolean): { success: boolean; output: string } {
  const args = ['tsx', 'scripts/nightly-docs/index.ts']
  if (dryRun) args.push('--dry-run')

  try {
    const output = execFileSync('pnpm', args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      // nightly-docs exits 0 for no-op, 0 for success — any non-zero is a real failure
      timeout: 300_000, // 5 min max
    })
    return { success: true, output: output.trim() }
  } catch (error) {
    // execFileSync throws on non-zero exit code
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    const output = [err.stdout, err.stderr].filter(Boolean).join('\n').trim()
    return { success: false, output: output || String(error) }
  }
}

/**
 * Docs Sync plugin — runs nightly-docs approximately once per day.
 *
 * Runs every 6th cycle (~30 min), dedup window of 23h prevents re-runs.
 */
export const docsSyncPlugin: InspectorPlugin = {
  name: 'docs-sync',
  description: 'Run nightly-docs agent to keep documentation in sync with structural changes',
  domain: 'docs',
  schedule: { every: 6 }, // Every 6th cycle = every ~30 min; dedup handles daily rate-limiting

  async run(ctx) {
    ctx.log.debug('Running docs-sync plugin')

    // Emit a single action with dedup to ensure ~daily execution
    const action: ActionRequest = {
      plugin: 'docs-sync',
      type: 'run-nightly-docs',
      urgency: 'info',
      title: 'Run nightly-docs agent',
      detail: 'Run nightly-docs to detect structural changes and open a docs update PR if needed',
      dedupKey: DEDUP_KEY,
      dedupWindowMinutes: DEDUP_WINDOW_MINUTES,

      async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
        execCtx.log.info('Running nightly-docs agent')

        const { success, output } = runNightlyDocs(execCtx.dryRun)

        if (success) {
          execCtx.log.info({ output }, 'nightly-docs completed successfully')
          return { success: true, message: 'nightly-docs completed' }
        } else {
          execCtx.log.error({ output }, 'nightly-docs failed')
          return { success: false, message: `nightly-docs failed: ${output.slice(0, 200)}` }
        }
      },
    }

    return [action]
  },
}
