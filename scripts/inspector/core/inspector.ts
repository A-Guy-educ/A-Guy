/**
 * @fileType script
 * @domain inspector
 * @pattern inspector-core
 * @ai-summary Main Inspector loop - orchestrates plugins, dedup, execution, and state
 */

import pino from 'pino'

import type { ActionRequest, InspectorConfig, InspectorContext, InspectorResult } from './types'
import { JsonStateStore } from './state'
import { shouldDedup, markExecuted, cleanupExpiredDedup } from './dedup'
import { createGitHubClient } from '../clients/github'
import { createSlackClient } from '../clients/slack'

/**
 * Run the Inspector with the given configuration.
 */
export async function runInspector(config: InspectorConfig): Promise<InspectorResult> {
  const { repo, dryRun, stateFile, plugins } = config

  // Initialize components
  const state = JsonStateStore.load(stateFile)

  // Get or increment cycle number
  const cycleNumber = (state.get<number>('system:cycleNumber') || 0) + 1
  state.set('system:cycleNumber', cycleNumber)

  // Create GitHub client
  const token = process.env.GH_TOKEN || ''
  const patToken = process.env.GH_PAT || undefined
  const github = createGitHubClient(repo, token, patToken)

  // Create logger
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.GITHUB_ACTIONS
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
          },
        },
  })

  const timestamp = new Date().toISOString()

  // Create Slack client
  const slack = createSlackClient(process.env.SLACK_WEBHOOK_URL)

  // Create context
  const ctx: InspectorContext = {
    repo,
    dryRun,
    state,
    github,
    log: logger,
    runTimestamp: timestamp,
    cycleNumber,
    slack,
    watchdogIssue: config.watchdogIssue,
  }

  // Clean up expired dedup entries (older than 24 hours)
  const cleaned = cleanupExpiredDedup(ctx)
  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Cleaned up expired dedup entries')
  }

  const errors: string[] = []
  const allActions: ActionRequest[] = []

  // Run scheduled plugins
  const scheduledPlugins = plugins.filter((plugin) => {
    if (!plugin.schedule || !plugin.schedule.every) {
      return true
    }
    return cycleNumber % plugin.schedule.every === 0
  })

  logger.info(
    {
      cycle: cycleNumber,
      pluginsTotal: plugins.length,
      pluginsScheduled: scheduledPlugins.length,
    },
    'Inspector cycle started',
  )

  for (const plugin of scheduledPlugins) {
    try {
      logger.debug({ plugin: plugin.name }, 'Running plugin')
      const actions = await plugin.run(ctx)
      allActions.push(...actions)
      logger.debug({ plugin: plugin.name, actionCount: actions.length }, 'Plugin completed')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`Plugin ${plugin.name}: ${message}`)
      logger.error({ plugin: plugin.name, error: message }, 'Plugin failed')
      // Continue to next plugin - error isolation
    }
  }

  // Deduplicate actions
  const dedupedActions: ActionRequest[] = []
  let actionsDeduplicated = 0

  for (const action of allActions) {
    if (shouldDedup(action, ctx)) {
      actionsDeduplicated++
      logger.debug(
        { plugin: action.plugin, type: action.type, dedupKey: action.dedupKey },
        'Action deduplicated',
      )
      continue
    }
    dedupedActions.push(action)
  }

  // Execute actions
  let actionsExecuted = 0

  if (!dryRun) {
    for (const action of dedupedActions) {
      try {
        logger.info(
          {
            plugin: action.plugin,
            type: action.type,
            target: action.target,
            urgency: action.urgency,
          },
          'Executing action',
        )
        const result = await action.execute(ctx)
        if (result.success) {
          actionsExecuted++
          // Mark as executed for dedup
          markExecuted(action, ctx)
          logger.debug({ plugin: action.plugin, type: action.type }, 'Action executed successfully')
        } else {
          logger.warn(
            { plugin: action.plugin, type: action.type, message: result.message },
            'Action failed',
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`Action ${action.plugin}/${action.type}: ${message}`)
        logger.error({ plugin: action.plugin, type: action.type, error: message }, 'Action error')
      }
    }
  } else {
    logger.info({ actionCount: dedupedActions.length }, 'Dry run - skipping action execution')
    actionsExecuted = 0
  }

  // Persist state
  state.save()

  const result: InspectorResult = {
    cycleNumber,
    pluginsRun: scheduledPlugins.length,
    actionsProduced: allActions.length,
    actionsExecuted,
    actionsDeduplicated,
    errors,
  }

  logger.info(
    {
      cycle: cycleNumber,
      pluginsRun: result.pluginsRun,
      actionsProduced: result.actionsProduced,
      actionsExecuted: result.actionsExecuted,
      actionsDeduplicated: result.actionsDeduplicated,
      errors: result.errors.length,
    },
    'Inspector cycle completed',
  )

  return result
}
