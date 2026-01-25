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

export function getPublicBaseUrl(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host')

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
