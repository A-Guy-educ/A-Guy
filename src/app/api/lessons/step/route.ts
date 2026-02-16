import { apiError, apiSuccess, parseAndValidate } from '@/server/api/responses'
import { StepRequestSchema } from '@/server/payload/endpoints/interactive-demo/schemas'
import { handleStep } from '@/server/payload/endpoints/interactive-demo/step-handler'
import config from '@payload-config'
import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = await parseAndValidate(request, StepRequestSchema as any)
    if ('error' in parsed) {
      return parsed.error
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await handleStep(payload, user as any, parsed.data as any)
    return apiSuccess(response)
  } catch (error) {
    console.error('Interactive demo step error:', error)
    return apiError('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
