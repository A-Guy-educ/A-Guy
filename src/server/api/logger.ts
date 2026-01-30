import { createRequestLogger, logger } from '@/infra/utils/logger'
import type { NextRequest } from 'next/server'

export function createApiLogger(request: NextRequest, routeName: string) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  return createRequestLogger(requestId).child({
    route: routeName,
    method: request.method,
    url: request.url,
    // OpenTelemetry trace context
    traceId: request.headers.get('x-trace-id') || undefined,
    spanId: request.headers.get('x-span-id') || undefined,
  })
}

// Singleton for non-request contexts
export const apiLogger = logger.child({ component: 'api' })
