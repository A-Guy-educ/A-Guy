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
 * Format a timestamp for log output
 */
function formatTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Format the log prefix with stage context
 */
function formatPrefix(context?: LogContext): string {
  const parts: string[] = []

  if (context?.stage) {
    parts.push(`[stage:${context.stage}]`)
  }

  if (context?.taskId) {
    parts.push(`[task:${context.taskId}]`)
  }

  if (context?.runId) {
    parts.push(`[run:${context.runId}]`)
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
 * Log an error with structured context
 */
export function errorWithContext(message: string, error?: Error, context?: LogContext): void {
  const prefix = formatPrefix(context)
  console.error(`${prefix} ${message}`)

  if (error) {
    console.error(`${prefix} Error: ${error.message}`)
    if (error.stack) {
      // Skip the first line of stack (the error message line)
      const stackLines = error.stack.split('\n').slice(1)
      for (const line of stackLines) {
        console.error(`${prefix}   ${line.trim()}`)
      }
    }
  }
}

/**
 * Log a debug message (only in development)
 */
export function debugWithContext(message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    const prefix = formatPrefix(context)
    console.log(`${prefix} DEBUG: ${message}`)
  }
}
