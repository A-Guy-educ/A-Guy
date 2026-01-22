/**
 * OAuth URL Sanitizer
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Sanitize returnTo URLs to prevent open redirect vulnerabilities
 */

export function sanitizeReturnTo(returnTo: string | undefined | null): string {
  const defaultRedirect = '/'
  if (!returnTo) return defaultRedirect

  const trimmed = returnTo.trim()

  if (
    trimmed.startsWith('//') ||
    trimmed.match(/^https?:\/\//i) ||
    trimmed.match(/^(data|javascript|mailto):/i)
  ) {
    return defaultRedirect
  }

  if (!trimmed.startsWith('/')) return defaultRedirect

  return trimmed
}
