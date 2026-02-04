import { requireAdminOrTestSecret } from '@/server/api/auth'
import { apiError, apiSuccess } from '@/server/api/responses'
import { TASK_SLUGS } from '@/server/payload/jobs/constants'
import type { JobStatus } from '@/server/payload/jobs/types'
import { JobService } from '@/server/payload/services/job-service'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

interface CountQuery {
  lessonId?: string
  status?: string
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const authHeader = request.headers.get('authorization')

    // Auth check
    try {
      const { user } = await payload.auth({ headers: request.headers })
      requireAdminOrTestSecret(user as any, authHeader)
    } catch {
      return apiError('UNAUTHORIZED', 'Admin access required', 401)
    }

    const { searchParams } = new URL(request.url)
    const query: CountQuery = {
      lessonId: searchParams.get('lessonId') || undefined,
      status: searchParams.get('status') || undefined,
    }

    const jobService = JobService.fromPayload(payload)

    // Build query filter
    const filter: Record<string, unknown> = { taskSlug: TASK_SLUGS.PDF_TO_EXERCISES }

    if (query.lessonId) {
      filter['input.ctx.lessonId'] = query.lessonId
    }

    // Status filter
    if (query.status) {
      const statuses = (query.status || '').split(',').filter(Boolean) as JobStatus[]
      if (statuses.length > 0) {
        const statusFilter: Record<string, unknown>[] = []
        for (const status of statuses) {
          switch (status) {
            case 'queued':
              statusFilter.push({
                processing: false,
                hasError: false,
                completedAt: { $exists: false },
              })
              break
            case 'running':
              statusFilter.push({ processing: true })
              break
            case 'completed':
              statusFilter.push({
                processing: false,
                hasError: false,
                completedAt: { $exists: true },
              })
              break
            case 'failed':
              statusFilter.push({ hasError: true })
              break
          }
        }
        if (statusFilter.length > 0) {
          filter.$or = statusFilter
        }
      }
    }

    const count = (await jobService.collection?.countDocuments(filter)) || 0

    return apiSuccess({ count })
  } catch (error) {
    console.error('[jobs/count] Error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to count jobs', 500)
  }
}
