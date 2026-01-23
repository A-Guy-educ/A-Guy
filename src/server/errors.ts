// Generic error handling utilities for the application

interface ErrorResult {
  success: false
  message: string
  errors?: Record<string, string>
}

/**
 * Generic Payload CMS error handler
 * Parses Payload validation errors and returns formatted error result
 *
 * @param error - The error object from Payload
 * @param fallbackMessage - Message to show if validation errors are found
 * @returns Formatted error result or null if not a Payload validation error
 */
export function handlePayloadError(error: unknown, fallbackMessage: string): ErrorResult | null {
  if (!error || typeof error !== 'object' || !('data' in error)) {
    return null
  }

  interface PayloadErrorData {
    errors?: Array<{ path?: string; message?: string }>
  }

  const payloadError = error.data as PayloadErrorData
  const errors: Record<string, string> = {}

  // Parse Payload field errors
  if (payloadError.errors && Array.isArray(payloadError.errors)) {
    payloadError.errors.forEach((err) => {
      if (err.path && err.message) {
        errors[err.path] = err.message
      }
    })
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: fallbackMessage,
      errors,
    }
  }

  return null
}
