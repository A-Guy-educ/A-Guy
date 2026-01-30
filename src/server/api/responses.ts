import { formatZodErrors } from '@/infra/utils/validation'
import { NextResponse, type NextRequest } from 'next/server'
import type { ZodError } from 'zod'

// Standardized error codes (extensible)
export type ApiErrorCode =
  // Auth errors
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  // Validation errors
  | 'VALIDATION_ERROR'
  | 'MISSING_REQUIRED_FIELD'
  // Resource errors
  | 'NOT_FOUND'
  | 'LESSON_NOT_FOUND'
  | 'PROMPT_NOT_FOUND'
  | 'MEDIA_NOT_ATTACHED'
  // Job errors
  | 'JOB_NOT_FOUND'
  | 'JOB_ALREADY_RUNNING'
  | 'JOB_ALREADY_COMPLETED'
  // System errors
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode
    message: string
    details?: Record<string, string[]>
  }
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
  message?: string
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, string[]>,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: { code, message, ...(details && { details }) } }, { status })
}

export function apiSuccess<T>(
  data?: T,
  message?: string,
  status = 200,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { success: true, ...(data !== undefined && { data }), ...(message && { message }) },
    { status },
  )
}

export function apiValidationError(error: ZodError): NextResponse<ApiErrorResponse> {
  return apiError('VALIDATION_ERROR', 'Validation failed', 400, formatZodErrors(error))
}

export const ApiErrors = {
  unauthorized: (message = 'Authentication required') => apiError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Access denied') => apiError('FORBIDDEN', message, 403),
  notFound: (resource: string) => apiError('NOT_FOUND', `${resource} not found`, 404),
  internal: (message = 'Internal server error') => apiError('INTERNAL_ERROR', message, 500),
} as const

import { safeValidate } from '@/infra/utils/validation'
import type { ZodSchema } from 'zod'

export async function parseAndValidate<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { error: NextResponse<ApiErrorResponse> }> {
  try {
    const body = await request.json()
    const result = safeValidate(schema, body)
    if (!result.success) return { error: apiValidationError(result.error) }
    return { data: result.data }
  } catch {
    return { error: apiError('VALIDATION_ERROR', 'Invalid JSON body', 400) }
  }
}

export function parseQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): { data: T } | { error: NextResponse<ApiErrorResponse> } {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())
  const result = safeValidate(schema, params)
  if (!result.success) return { error: apiValidationError(result.error) }
  return { data: result.data }
}
