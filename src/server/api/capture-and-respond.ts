import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { apiLogger } from './logger'

/**
 * Centralized error handler that logs, captures to Sentry, and returns a consistent response.
 * Use in API route catch blocks that don't use withApiHandler.
 */
export function captureAndRespond(
  error: unknown,
  context: { route: string; requestId?: string },
): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'

  apiLogger.error(
    {
      err: error,
      route: context.route,
      requestId: context.requestId,
    },
    `API error in ${context.route}`,
  )

  Sentry.captureException(error, {
    tags: { route: context.route },
    extra: { requestId: context.requestId },
  })

  return NextResponse.json({ error: 'Internal server error', message }, { status: 500 })
}
