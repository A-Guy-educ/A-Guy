/**
 * Pathname Builder
 * Builds Vercel Blob pathnames for chat assets
 */

import { sanitizeFilename } from './filename'

interface BuildPathnameParams {
  tenantId: string
  userId: string
  uploadSessionId: string
  filename: string
}

export function buildChatAssetPathname(params: BuildPathnameParams): string {
  const { tenantId, userId, uploadSessionId, filename } = params

  const sanitizedFilename = sanitizeFilename(filename)

  // Format: chat-assets/<tenantId>/<userId>/<uploadSessionId>/<sanitizedFilename>
  return `chat-assets/${tenantId}/${userId}/${uploadSessionId}/${sanitizedFilename}`
}

export function extractSessionIdFromPathname(pathname: string): string | null {
  const parts = pathname.split('/')
  // Expected format: chat-assets/<tenant>/<user>/<sessionId>/<filename>
  if (parts.length >= 4) {
    return parts[3] || null
  }
  return null
}

export function extractTenantIdFromPathname(pathname: string): string | null {
  const parts = pathname.split('/')
  if (parts.length >= 2) {
    return parts[1] || null
  }
  return null
}
