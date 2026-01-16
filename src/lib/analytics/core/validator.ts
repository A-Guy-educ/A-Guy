/**
 * Event Validation
 *
 * Validates events against their Zod schemas
 * Enforces strict contracts and prevents invalid data
 */

import { ZodError, type ZodIssue } from 'zod'
import { isValidEvent, type ProductEvent } from '../contracts/events'
import { eventSchemas } from '../contracts/schemas'
import type { ValidationResult } from '../types'

/**
 * Validate an event and its properties
 *
 * Behavior:
 * - Development/Staging: Block unknown/invalid events (throw error)
 * - Production: Log warning and return best-effort validation
 *
 * @param event - Event name to validate
 * @param properties - Event properties to validate
 * @returns Validation result with parsed data or error
 */
export function validateEvent(
  event: string,
  properties?: Record<string, unknown>,
): ValidationResult {
  // Check if event name is valid
  if (!isValidEvent(event)) {
    const error = {
      message: `Unknown event: ${event}. Only canonical events are allowed.`,
      issues: [
        {
          path: ['event'],
          message: `Event "${event}" is not in the canonical event list`,
        },
      ],
    }

    // In production: log warning and continue best-effort
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Analytics] Invalid event (production mode - continuing):', error.message)
      return {
        success: false,
        error,
      }
    }

    // In dev/staging: throw error to catch issues early
    throw new Error(error.message)
  }

  // Get schema for this event
  const schema = eventSchemas[event as ProductEvent]

  if (!schema) {
    // This should never happen if isValidEvent passed
    throw new Error(`Schema not found for event: ${event}`)
  }

  try {
    // Validate properties against schema
    const validatedData = schema.parse(properties || {})

    return {
      success: true,
      data: validatedData as unknown as Record<string, unknown>,
    }
  } catch (err) {
    if (err instanceof ZodError) {
      const zodIssues: ZodIssue[] = err.issues || []
      const error = {
        message: `Invalid properties for event "${event}"`,
        issues: zodIssues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
      }

      // In production: log warning and continue best-effort
      if (process.env.NODE_ENV === 'production') {
        console.warn('[Analytics] Validation failed (production mode - continuing):', {
          event,
          error: error.message,
          issues: error.issues,
        })
        return {
          success: false,
          error,
        }
      }

      // In dev/staging: throw error with detailed info
      const errorMessage = `${error.message}\n${error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`
      throw new Error(errorMessage)
    }

    // Unexpected error
    throw err
  }
}

/**
 * Safe validation that never throws
 * Always returns a ValidationResult
 */
export function safeValidateEvent(
  event: string,
  properties?: Record<string, unknown>,
): ValidationResult {
  try {
    return validateEvent(event, properties)
  } catch (err) {
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Unknown validation error',
      },
    }
  }
}
