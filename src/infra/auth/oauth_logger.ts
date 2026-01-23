/**
 * OAuth Structured Logger
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary PII-safe logging for OAuth events with email hashing
 */

import { logger } from '@/utilities/logger/logger'
import { createHash } from 'crypto'

async function hashEmail(email: string): Promise<string> {
  return createHash('sha256').update(email).digest('hex')
}

export async function logOAuthEvent(
  event:
    | 'collision'
    | 'user_created'
    | 'user_updated'
    | 'session_issued'
    | 'error'
    | 'user_created_race_recovery',
  data: Record<string, unknown>,
): Promise<void> {
  const safeData: Record<string, unknown> = {
    event: `oauth_${event}`,
    correlationId: data.correlationId,
    timestamp: new Date().toISOString(),
  }

  if (data.email) {
    safeData.emailHash = await hashEmail(data.email as string)
  }

  if (data.googleSub) safeData.googleSub = data.googleSub
  if (data.userId) safeData.userId = data.userId

  logger.info(safeData)
}

export function logOAuthError(errorType: string, error: unknown, correlationId: string): void {
  logger.error({
    event: `oauth_error_${errorType}`,
    correlationId,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  })
}
