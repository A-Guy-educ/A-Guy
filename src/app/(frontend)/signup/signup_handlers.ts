// Generic error handlers for signup flow

interface ErrorResult {
  success: false
  message: string
  errors?: Record<string, string>
}

/**
 * Generic Payload CMS error handler
 * Parses Payload validation errors and returns formatted error result
 */
export function handlePayloadError(error: unknown, fallbackMessage: string): ErrorResult | null {
  if (!error || typeof error !== 'object' || !('data' in error)) {
    return null
  }

  const payloadError = error.data as any
  const errors: Record<string, string> = {}

  // Parse Payload field errors
  if (payloadError.errors && Array.isArray(payloadError.errors)) {
    payloadError.errors.forEach((err: any) => {
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

/**
 * Checks if error is a duplicate email error (MongoDB E11000)
 */
export function isDuplicateEmailError(errorMessage: string): boolean {
  return (
    errorMessage.includes('duplicate') ||
    errorMessage.includes('unique') ||
    errorMessage.includes('E11000')
  )
}

/**
 * Handles duplicate email error - extends generic Payload error handling
 */
export function handleDuplicateEmailError(): ErrorResult {
  return {
    success: false,
    message: 'An account with this email already exists. Would you like to log in instead?',
    errors: {
      email: 'This email is already registered',
    },
  }
}
