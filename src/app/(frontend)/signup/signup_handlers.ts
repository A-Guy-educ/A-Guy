// Signup-specific error handlers (extends generic Payload error handling)

import { handlePayloadError } from '@/lib/errors'

interface ErrorResult {
  success: false
  message: string
  errors?: Record<string, string>
}

// Re-export generic handler for convenience
export { handlePayloadError }

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
