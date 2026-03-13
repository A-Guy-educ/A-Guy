/**
 * @fileType script
 * @domain inspector
 * @pattern entry-point
 * @ai-summary CLI entry point for the Inspector
 */

import pino from 'pino'

import { runInspector } from './core/inspector'
import { createPluginRegistry } from './plugins/registry'
import { healthCheckPlugin } from './plugins/cody/health-check/index'
import { auditPlugin } from './plugins/cody/audit/index'
import { failureAnalysisPlugin } from './plugins/cody/failure-analysis/index'
import { deferredStagesPlugin } from './plugins/cody/deferred-stages/index'
import { docsSyncPlugin } from './plugins/docs-sync/index'
import type { InspectorConfig } from './core/types'

const logger = pino({ level: 'info' })

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  // Read environment variables
  const repo = process.env.REPO
  const token = process.env.GH_TOKEN || ''
  const dryRun = process.env.DRY_RUN === 'true'

  // Parse optional config
  const watchdogIssue = process.env.WATCHDOG_ISSUE ? Number(process.env.WATCHDOG_ISSUE) : undefined

  // Validate required env vars
  if (!repo) {
    logger.error('Missing required environment variable: REPO')
    process.exit(1)
  }

  if (!token) {
    logger.error('Missing required environment variable: GH_TOKEN')
    process.exit(1)
  }

  logger.info({ repo, dryRun }, 'Starting Inspector')

  // Warn about missing optional config
  if (!watchdogIssue) {
    logger.warn('WATCHDOG_ISSUE not set — digest reports will be skipped')
  }
  if (!process.env.MINIMAX_API_KEY) {
    logger.warn('MINIMAX_API_KEY not set — failure analysis will use fallback mode')
  }

  // Create plugin registry
  const registry = createPluginRegistry()

  // Register plugins
  registry.register(healthCheckPlugin)
  registry.register(failureAnalysisPlugin)
  registry.register(auditPlugin)
  registry.register(deferredStagesPlugin)
  registry.register(docsSyncPlugin)

  // Create config
  const config: InspectorConfig = {
    repo,
    dryRun,
    stateFile: `${process.cwd()}/.inspector/state.json`,
    plugins: registry.getAll(),
    watchdogIssue,
  }

  // Run Inspector
  try {
    const result = await runInspector(config)

    // Log summary
    logger.info(
      {
        cycle: result.cycleNumber,
        pluginsRun: result.pluginsRun,
        actionsProduced: result.actionsProduced,
        actionsExecuted: result.actionsExecuted,
        actionsDeduplicated: result.actionsDeduplicated,
        errors: result.errors.length,
      },
      'Inspector completed',
    )

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        logger.warn({ error }, 'Inspector error')
      }
    }

    // Exit with error if there were critical errors
    // For now, always exit 0 - only infrastructure failures should exit 1
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ error: message }, 'Inspector failed')
    process.exit(1)
  }
}

main()
