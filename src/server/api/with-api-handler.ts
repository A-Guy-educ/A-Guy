import * as Sentry from '@sentry/nextjs'
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import type { User } from 'payload'
import { getPayload } from 'payload'
import type { ZodSchema } from 'zod'
import { requireAdmin, requireAdminOrTestSecret, requireAuthenticated } from './auth'
import { createApiLogger } from './logger'
import { apiError, ApiErrors, parseAndValidate, parseQueryParams } from './responses'

export type AuthLevel = 'admin' | 'adminOrTest' | 'authenticated' | 'public'

export interface ApiContext<TBody = unknown, TQuery = unknown> {
  request: NextRequest
  payload: Awaited<ReturnType<typeof getPayload>>
  user: User | null
  body: TBody
  query: TQuery
  logger: ReturnType<typeof createApiLogger>
}

export interface HandlerOptions<TBody, TQuery> {
  auth?: AuthLevel
  bodySchema?: ZodSchema<TBody>
  querySchema?: ZodSchema<TQuery>
}

export function withApiHandler<TBody = unknown, TQuery = unknown>(
  options: HandlerOptions<TBody, TQuery>,
  handler: (ctx: ApiContext<TBody, TQuery>) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

    try {
      const payload = await getPayload({ config: configPromise })
      const { user } = await payload.auth({ headers: request.headers })
      const authHeader = request.headers.get('authorization')

      // Auth check
      if (options.auth === 'admin') {
        try {
          requireAdmin(user as User | null)
        } catch {
          return ApiErrors.unauthorized('Admin access required')
        }
      } else if (options.auth === 'adminOrTest') {
        try {
          requireAdminOrTestSecret(user as User | null, authHeader)
        } catch {
          return ApiErrors.unauthorized('Admin access required')
        }
      } else if (options.auth === 'authenticated') {
        try {
          requireAuthenticated(user as User | null)
        } catch {
          return ApiErrors.unauthorized()
        }
      }

      // Parse body
      let body: TBody = undefined as TBody
      if (options.bodySchema) {
        const parsed = await parseAndValidate(request, options.bodySchema)
        if ('error' in parsed) return parsed.error
        body = parsed.data
      }

      // Parse query params
      let query: TQuery = undefined as TQuery
      if (options.querySchema) {
        const parsed = parseQueryParams(request, options.querySchema)
        if ('error' in parsed) return parsed.error
        query = parsed.data
      }

      const logger = createApiLogger(request, 'api-handler')

      // Cast user to bypass Payload User type mismatch with sessions
      return await handler({ request, payload, user: user as User | null, body, query, logger })
    } catch (error) {
      const logger = createApiLogger(request, 'api-handler')

      // Distinguish between operational and system errors
      const isOperational =
        error instanceof Error &&
        (error.name === 'ValidationError' ||
          error.message.includes('not found') ||
          error.message.includes('already exists'))

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          requestId,
          isOperational,
        },
        'API handler error',
      )

      Sentry.captureException(error, {
        tags: { route: request.nextUrl.pathname, isOperational },
        extra: { requestId },
      })

      if (isOperational) {
        return apiError(
          'VALIDATION_ERROR',
          error instanceof Error ? error.message : 'Operation failed',
          400,
        )
      }

      return apiError('INTERNAL_ERROR', 'Internal server error', 500)
    }
  }
}
