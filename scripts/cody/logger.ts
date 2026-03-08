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

// ============================================================================
// Legacy structured logging functions (using console)
// These are kept for backward compatibility with existing code
// ============================================================================

/**
 * Stage context for structured logging
 */
export interface LogContext {
  stage?: string
  taskId?: string
  runId?: string
}

/**
 * Global context that gets merged with per-call context
 */
let globalContext: LogContext = {}

/**
 * Set global context (e.g., at pipeline start)
 * Per-call context values override global values
 */
export function setGlobalContext(context: LogContext): void {
  globalContext = { ...context }
}

/**
 * Get current global context
 */
export function getGlobalContext(): LogContext {
  return { ...globalContext }
}

/**
 * Clear global context (useful for testing)
 */
export function clearGlobalContext(): void {
  globalContext = {}
}

/**
 * Merge global and per-call context (per-call takes precedence)
 */
function mergeContext(context?: LogContext): LogContext {
  return { ...globalContext, ...context }
}

/**
 * Format a timestamp for log output
 */
function formatTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Format the log prefix with stage context
 */
function formatPrefix(context?: LogContext): string {
  const merged = mergeContext(context)
  const parts: string[] = []

  if (merged.stage) {
    parts.push(`[stage:${merged.stage}]`)
  }

  if (merged.taskId) {
    parts.push(`[task:${merged.taskId}]`)
  }

  if (merged.runId) {
    parts.push(`[run:${merged.runId}]`)
  }

  parts.push(`[${formatTimestamp()}]`)

  return parts.join(' ')
}

/**
 * Log a message with structured context
 */
export function logWithContext(message: string, context?: LogContext): void {
  const prefix = formatPrefix(context)
  console.log(`${prefix} ${message}`)
}

/**
 * Log a warning with structured context
 */
export function warnWithContext(message: string, context?: LogContext): void {
  const prefix = formatPrefix(context)
  console.log(`${prefix} ⚠️ ${message}`)
}

/**
 * Log an error with structured context
 * Accepts Error, unknown, or string
 */
export function errorWithContext(message: string, error?: unknown, context?: LogContext): void {
  const prefix = formatPrefix(context)
  console.error(`${prefix} ${message}`)

  if (error) {
    const errorMessage =
      typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)
    console.error(`${prefix} Error: ${errorMessage}`)

    const errorStack = error instanceof Error ? error.stack : null
    if (errorStack) {
      // Skip the first line of stack (the error message line)
      const stackLines = errorStack.split('\n').slice(1)
      for (const line of stackLines) {
        console.error(`${prefix}   ${line.trim()}`)
      }
    }
  }
}

/**
 * Log a debug message (only in development or when DEBUG is set)
 */
export function debugWithContext(message: string, context?: LogContext): void {
  const env = getEnv()
  if (env.NODE_ENV === 'development' || env.DEBUG) {
    const prefix = formatPrefix(context)
    console.log(`${prefix} DEBUG: ${message}`)
  }
}
