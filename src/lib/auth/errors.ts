export const AUTH_ERROR_CODES = {
  account_exists: 'account_exists',
  oauth_already_linked: 'oauth_already_linked',
  email_in_use: 'email_in_use',
  oauth_failed: 'oauth_failed',
  email_not_verified: 'email_not_verified',
  invalid_state: 'invalid_state',
  invalid_request: 'invalid_request',
} as const

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  account_exists: 'An account already exists for this email. Please log in to link Google.',
  oauth_already_linked: 'This Google account is already linked to another user.',
  email_in_use: 'An account with this email already exists.',
  oauth_failed: 'Authentication failed. Please try again.',
  email_not_verified: 'Please verify your email with Google first.',
  invalid_state: 'Invalid request. Please try again.',
  invalid_request: 'Invalid request. Please try again.',
}

export function getAuthErrorMessage(code: string): string {
  return AUTH_ERROR_MESSAGES[code as AuthErrorCode] ?? 'An unexpected error occurred.'
}
