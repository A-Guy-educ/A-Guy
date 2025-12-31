interface ErrorResult {
  success: false
  message: string
  errors?: Record<string, string>
}

export function handleDuplicateEmailError(): ErrorResult {
  return {
    success: false,
    message: 'An account with this email already exists. Would you like to log in instead?',
    errors: {
      email: 'This email is already registered',
    },
  }
}

export function handlePayloadValidationError(error: any): ErrorResult | null {
  if ('data' in error && error.data && typeof error.data === 'object') {
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
        message: 'Please fix the errors below.',
        errors,
      }
    }
  }

  return null
}

export function isDuplicateEmailError(errorMessage: string): boolean {
  return (
    errorMessage.includes('duplicate') ||
    errorMessage.includes('unique') ||
    errorMessage.includes('E11000')
  )
}
