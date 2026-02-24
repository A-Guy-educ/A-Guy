/**
 * @fileType utility
 * @domain ci | cody | observability
 * @pattern structured-logging
 * @ai-summary Structured logging helpers with stage context for the Cody pipeline
 */

import process from 'process'

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
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    const prefix = formatPrefix(context)
    console.log(`${prefix} DEBUG: ${message}`)
  }
}
