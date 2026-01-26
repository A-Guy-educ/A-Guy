/**
 * Event Validation
 *
 * Validates events against their Zod schemas
 * Enforces strict contracts and prevents invalid data
 */

import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
import { ZodError, type ZodIssue } from 'zod'
import { isValidEvent, type ProductEvent } from '../contracts/events'
import { eventSchemas } from '../contracts/schemas'
import type { ValidationResult } from '../types'

/**
 * Validate an event and its properties
 *
 * Behavior:
 * - Development/Staging: Block unknown/invalid events (throw error)
 * - Production: Log warning and continue best-effort (return success with raw data)
 *
 * @param event - Event name to validate
 * @param properties - Event properties to validate
 * @returns Validation result with parsed data or error
 */
export function validateEvent(
  event: string,
  properties?: Record<string, unknown>,
): ValidationResult {
  const rawData = properties || {}

  // Check if event name is valid
  if (!isValidEvent(event)) {
    const errorMsg = `Unknown event: ${event}. Only canonical events are allowed.`

    // In production: log warning and continue best-effort with raw data
    if (getConfigValue('NODE_ENV') === 'production') {
      console.warn('[Analytics] Invalid event (production mode - continuing):', errorMsg)
      return {
        success: true,
        data: rawData,
      }
    }

    // In dev/staging: throw error to catch issues early
    throw new Error(errorMsg)
  }

  // Get schema for this event
  const schema = eventSchemas[event as ProductEvent]

  if (!schema) {
    // This should never happen if isValidEvent passed
    throw new Error(`Schema not found for event: ${event}`)
  }

  try {
    // Validate properties against schema
    const validatedData = schema.parse(rawData)

    return {
      success: true,
      data: validatedData as unknown as Record<string, unknown>,
    }
  } catch (err) {
    if (err instanceof ZodError) {
      const zodIssues: ZodIssue[] = err.issues || []
      const errorDetails = zodIssues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      }))

      // In production: log warning and continue best-effort with raw data
      if (getConfigValue('NODE_ENV') === 'production') {
        console.warn('[Analytics] Validation failed (production mode - continuing):', {
          event,
          issues: errorDetails,
        })
        return {
          success: true,
          data: rawData,
        }
      }

      // In dev/staging: throw error with detailed info
      const errorMessage = `Invalid properties for event "${event}"\n${errorDetails.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`
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
