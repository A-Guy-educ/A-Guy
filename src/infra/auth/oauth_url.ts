/**
 * OAuth URL Builder
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Build canonical public base URLs for OAuth callbacks
 */

import type { NextRequest } from 'next/server'

export function getPublicBaseUrl(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return req.nextUrl.origin
}
