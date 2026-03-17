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
import { pipelineFixerPlugin } from './plugins/cody/pipeline-fixer/index'
import { deferredStagesPlugin } from './plugins/cody/deferred-stages/index'
import { deferredTestsPlugin } from './plugins/cody/deferred-tests/index'
import { docsSyncPlugin } from './plugins/docs-sync/index'
import { zombieReaperPlugin } from './plugins/cody/zombie-reaper/index'
import { successTrackerPlugin } from './plugins/cody/success-tracker/index'
import { failureMinerPlugin } from './plugins/cody/failure-miner/index'
import { knowledgeGardenerPlugin } from './plugins/cody/knowledge-gardener/index'
import { securityScannerPlugin } from './plugins/project/security-scanner/index'
import { apiSurfaceAuditorPlugin } from './plugins/project/api-surface/index'
import { queueManagerPlugin } from './plugins/cody/queue-manager/index'
import { systemTestPlugin } from './plugins/cody/system-test/index'
import { cliTestPlugin } from './plugins/cody/cli-test/index'
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
  const digestIssue = process.env.INSPECTOR_DIGEST_ISSUE
    ? Number(process.env.INSPECTOR_DIGEST_ISSUE)
    : undefined

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
  if (!digestIssue) {
    logger.warn('INSPECTOR_DIGEST_ISSUE not set — digest reports will be skipped')
  }
  if (!process.env.MINIMAX_API_KEY) {
    logger.warn('MINIMAX_API_KEY not set — audit plugin will use fallback analysis')
  }
  if (!process.env.GH_PAT) {
    logger.warn('GH_PAT not set — workflow dispatches (retries, reruns) will silently fail')
  }

  // Create plugin registry
  const registry = createPluginRegistry()

  // Register plugins
  registry.register(healthCheckPlugin)
  registry.register(queueManagerPlugin)
  registry.register(pipelineFixerPlugin)
  registry.register(auditPlugin)
  registry.register(deferredStagesPlugin)
  registry.register(deferredTestsPlugin)
  registry.register(docsSyncPlugin)
  registry.register(zombieReaperPlugin)
  registry.register(successTrackerPlugin)
  registry.register(failureMinerPlugin)
  registry.register(knowledgeGardenerPlugin)
  registry.register(securityScannerPlugin)
  registry.register(apiSurfaceAuditorPlugin)
  registry.register(systemTestPlugin)
  registry.register(cliTestPlugin)
  registry.register(cliTestPlugin)

  // Validate critical plugin ordering:
  // health-check MUST run before pipeline-fixer and queue-manager since they
  // consume cody:evaluatedTasks which health-check populates.
  const pluginNames = registry.getAll().map((p) => p.name)
  const healthIdx = pluginNames.indexOf('cody-health-check')
  const fixerIdx = pluginNames.indexOf('cody-pipeline-fixer')
  const queueIdx = pluginNames.indexOf('cody-queue-manager')
  if (healthIdx === -1 || fixerIdx === -1 || queueIdx === -1) {
    logger.error('Required plugins missing: health-check, cody-pipeline-fixer, cody-queue-manager')
    process.exit(1)
  }
  if (healthIdx >= fixerIdx || healthIdx >= queueIdx) {
    logger.error(
      'Plugin order violation: health-check must be registered before pipeline-fixer and queue-manager',
    )
    process.exit(1)
  }

  // Create config
  const config: InspectorConfig = {
    repo,
    dryRun,
    stateFile: `${process.cwd()}/.inspector/state.json`,
    plugins: registry.getAll(),
    digestIssue,
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
