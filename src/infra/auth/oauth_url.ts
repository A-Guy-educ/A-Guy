/**
 * OAuth URL Builder
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Build canonical public base URLs for OAuth callbacks
 */

import type { NextRequest } from 'next/server'
import { logger } from '@/infra/utils/logger/logger'

// Forwarded headers become comma-separated lists when a request passes
// through more than one proxy (CDN -> LB -> app). The client-facing value
// is always the first entry; using the raw header yields a malformed
// redirect_uri that won't match Google's registered URI.
function firstForwardedValue(header: string | null): string | null {
  if (!header) return null
  const first = header.split(',')[0]?.trim()
  return first ? first : null
}

export function getPublicBaseUrl(req: NextRequest): string {
  // When a canonical public URL is configured, it is authoritative: the
  // OAuth redirect_uri must be deterministic and match what is registered
  // in Google. Trusting client-supplied forwarded headers here would be an
  // open-redirect / phishing vector.
  const configured = process.env.NEXT_PUBLIC_SERVER_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  const forwardedProto = firstForwardedValue(req.headers.get('x-forwarded-proto'))
  const forwardedHost = firstForwardedValue(req.headers.get('x-forwarded-host'))

  let baseUrl: string

  if (forwardedProto && forwardedHost) {
    baseUrl = `${forwardedProto}://${forwardedHost}`
  } else {
    baseUrl = req.nextUrl.origin
    // Log when falling back to origin (helps debug redirect_uri_mismatch)
    logger.warn({
      event: 'oauth_url_fallback',
      baseUrl,
      forwardedProto,
      forwardedHost,
      origin: req.nextUrl.origin,
      userAgent: req.headers.get('user-agent'),
    })
  }

  return baseUrl
}
