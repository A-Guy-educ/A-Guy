/**
 * @fileType utility
 * @domain shared
 * @pattern path-normalization
 * @ai-summary Normalizes URL paths for consistent matching; does not collapse // or resolve ../, so paths like //evil.com or /a/../b are passed through unchanged.
 */

export function normalizePath(input: string): string {
  let path = input.trim()

  // Empty after trim → root
  if (path.length === 0) {
    return '/'
  }

  // Strip query string
  const queryIndex = path.indexOf('?')
  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex)
  }

  // Strip hash
  const hashIndex = path.indexOf('#')
  if (hashIndex !== -1) {
    path = path.slice(0, hashIndex)
  }

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = '/' + path
  }

  // Remove trailing slash (except for root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  return path
}

/**
 * Check if a URL is an internal path (starts with / and not external).
 * Rules:
 * - Allow only internal paths starting with /
 * - Reject http://, https://, //, or empty strings
 */
export function isInternalPath(url: string): boolean {
  const trimmed = url?.trim()
  if (!trimmed || trimmed.length === 0) return false
  if (trimmed.startsWith('//')) return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  return trimmed.startsWith('/')
}
