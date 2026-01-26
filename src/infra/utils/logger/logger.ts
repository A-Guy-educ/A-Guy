import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
import pino from 'pino'

/**
 * Create a structured logger with Pino
 * Supports JSON output in production and pretty-print in development
 */
export const logger = pino({
  level: getConfigValue('LOG_LEVEL', { defaultValue: 'info' }),
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
