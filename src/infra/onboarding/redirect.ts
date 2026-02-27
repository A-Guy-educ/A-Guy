/**
 * Onboarding Redirect Utility
 *
 * Constructs the onboarding redirect URL for new users,
 * with returnTo sanitization and loop prevention.
 */

import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'

const ONBOARDING_PERSONA_PATH = '/onboarding/persona'

/**
 * Returns the appropriate redirect destination after user registration.
 * Wraps the original returnTo in an onboarding URL unless already pointing to onboarding.
 */
export function getOnboardingRedirect(returnTo: string | undefined | null): string {
  const sanitized = sanitizeReturnTo(returnTo)

  if (sanitized.startsWith(ONBOARDING_PERSONA_PATH)) {
    return sanitized
  }

  return `${ONBOARDING_PERSONA_PATH}?returnTo=${encodeURIComponent(sanitized)}`
}
