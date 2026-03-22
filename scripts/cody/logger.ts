/**
 * @fileType utility
 * @domain ci | cody | observability
 * @pattern structured-logging
 * @ai-summary Structured logging helpers with stage context for the Cody pipeline
 */

import pino from 'pino'

import { getEnv } from './env'

// Lazy-initialize pino logger to avoid validation at import time
let _logger: ReturnType<typeof pino> | null = null

function getPinoLogger() {
  if (!_logger) {
    const env = getEnv()
    const isCI = !!env.GITHUB_ACTIONS

    _logger = pino({
      level: env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: !isCI,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    })
  }
  return _logger
}

/**
 * Get the root pino logger instance
 */
export function getRootLogger() {
  return getPinoLogger()
}

/**
 * Create a child logger scoped to a specific pipeline stage.
 */
export function createStageLogger(stage: string, taskId?: string) {
  return getPinoLogger().child({ stage, ...(taskId && { taskId }) })
}

// Re-export pino logger for backward compatibility
export const logger = getPinoLogger()
export default logger

// ============================================================================
// CI Log Grouping (GitHub Actions)
// ============================================================================

/**
 * Emit a GitHub Actions collapsible group header.
 * No-op when not running in CI.
 */
export function ciGroup(title: string): void {
  if (process.env.GITHUB_ACTIONS) {
    process.stdout.write(`::group::${title}\n`)
  }
}

/**
 * Emit a GitHub Actions collapsible group footer.
 * No-op when not running in CI.
 */
export function ciGroupEnd(): void {
  if (process.env.GITHUB_ACTIONS) {
    process.stdout.write('::endgroup::\n')
  }
}
