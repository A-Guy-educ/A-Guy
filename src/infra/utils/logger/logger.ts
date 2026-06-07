/**
 * @fileType utility
 * @domain infra
 * @pattern structured-logging
 * @ai-summary Pino logger instance with JSON output in production and pretty-print in development; transport is disabled to avoid worker.js thread-stream issues.
 *
 * All project logging should go through this module (logger, createRequestLogger), not console.log,
 * so that log level and format can be controlled from a single place.
 */

import pino from 'pino'

/**
 * Create a structured logger with Pino
 * Supports JSON output in production and pretty-print in development
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  // Keep transport disabled to avoid worker.js / thread-stream issues in dev
})

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId })
}

/**
 * Log levels:
 * - trace: Very detailed debugging information
 * - debug: Debugging information
 * - info: General informational messages
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal error messages
 */

/**
 * Example usage:
 *
 * import { logger, createRequestLogger } from '@/infra/utils/logger'
 *
 * // Basic logging
 * logger.info('Server started')
 * logger.error({ err }, 'Failed to process request')
 *
 * // With request context
 * const reqLogger = createRequestLogger('req-123')
 * reqLogger.info({ userId: '456' }, 'User authenticated')
 */
