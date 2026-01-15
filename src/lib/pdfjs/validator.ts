import { VALIDATION_CONFIG } from './config'

/**
 * Validation error types
 */
export type ValidationError =
  | { type: 'missing'; message: string }
  | { type: 'too_long'; message: string; length: number }
  | { type: 'invalid_scheme'; message: string; scheme: string }
  | { type: 'disallowed_origin'; message: string; origin: string }

/**
 * Validation result
 */
export type ValidationResult =
  | { valid: true; url: string }
  | { valid: false; error: ValidationError }

/**
 * Redact sensitive URL for safe logging
 * Returns origin + pathname, strips query/hash
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    // If URL parsing fails, return a safe prefix
    return url.slice(0, 50) + '...'
  }
}

/**
 * Validate file URL parameter
 *
 * Accepts:
 * - Same-origin absolute URLs (http/https)
 * - Relative paths starting with /
 * - Vercel Blob storage URLs (our CDN)
 *
 * Rejects:
 * - Dangerous schemes (javascript:, data:, file:, blob:)
 * - Empty or missing URLs
 * - Overly long URLs
 * - External origins (except allowed blob storage)
 */
export function validateFileUrl(fileParam: string | null, requestOrigin: string): ValidationResult {
  // Check if file parameter exists
  if (!fileParam) {
    return {
      valid: false,
      error: {
        type: 'missing',
        message: 'Missing file parameter',
      },
    }
  }

  // Check length
  if (fileParam.length > VALIDATION_CONFIG.maxUrlLength) {
    return {
      valid: false,
      error: {
        type: 'too_long',
        message: `File URL exceeds maximum length of ${VALIDATION_CONFIG.maxUrlLength}`,
        length: fileParam.length,
      },
    }
  }

  // Check for dangerous schemes BEFORE treating as relative URL
  // This prevents "javascript:alert(1)" from being treated as a relative path
  const lowerParam = fileParam.toLowerCase()
  for (const blockedScheme of VALIDATION_CONFIG.blockedSchemes) {
    if (lowerParam.startsWith(blockedScheme)) {
      return {
        valid: false,
        error: {
          type: 'invalid_scheme',
          message: `Blocked URL scheme: ${blockedScheme}`,
          scheme: blockedScheme,
        },
      }
    }
  }

  // Normalize request origin (remove trailing slash)
  const normalizedOrigin = requestOrigin.replace(/\/$/, '')

  // Convert relative URLs to absolute
  let absoluteUrl: string
  if (fileParam.startsWith('/')) {
    // Relative path - convert to absolute same-origin URL
    absoluteUrl = `${normalizedOrigin}${fileParam}`
  } else if (fileParam.startsWith('http://') || fileParam.startsWith('https://')) {
    // Already absolute
    absoluteUrl = fileParam
  } else {
    // Relative path without leading slash - add it
    absoluteUrl = `${normalizedOrigin}/${fileParam}`
  }

  // Parse URL to validate scheme and origin
  let parsed: URL
  try {
    parsed = new URL(absoluteUrl)
  } catch {
    return {
      valid: false,
      error: {
        type: 'invalid_scheme',
        message: 'Invalid URL format',
        scheme: 'unknown',
      },
    }
  }

  // Check for blocked schemes
  if (
    VALIDATION_CONFIG.blockedSchemes.includes(
      parsed.protocol as (typeof VALIDATION_CONFIG.blockedSchemes)[number],
    )
  ) {
    return {
      valid: false,
      error: {
        type: 'invalid_scheme',
        message: `Blocked URL scheme: ${parsed.protocol}`,
        scheme: parsed.protocol,
      },
    }
  }

  // Check for allowed schemes
  if (
    !VALIDATION_CONFIG.allowedSchemes.includes(
      parsed.protocol as (typeof VALIDATION_CONFIG.allowedSchemes)[number],
    )
  ) {
    return {
      valid: false,
      error: {
        type: 'invalid_scheme',
        message: `Only http and https URLs are allowed`,
        scheme: parsed.protocol,
      },
    }
  }

  // Check origin - allow same-origin or Vercel Blob storage
  const requestOriginNormalized = requestOrigin.replace(/\/$/, '')
  const fileOrigin = parsed.origin

  const isSameOrigin = fileOrigin === requestOriginNormalized
  const isVercelBlob = fileOrigin.includes('.blob.vercel-storage.com')

  if (!isSameOrigin && !isVercelBlob) {
    return {
      valid: false,
      error: {
        type: 'disallowed_origin',
        message: 'Only same-origin or Vercel Blob URLs are allowed',
        origin: fileOrigin,
      },
    }
  }

  return {
    valid: true,
    url: absoluteUrl,
  }
}
