import { requireAdminOrTestSecret } from '@/server/api/auth'
import { apiError, apiSuccess } from '@/server/api/responses'
import { TASK_SLUGS } from '@/server/payload/jobs/constants'
import type { JobDocument, JobStatus } from '@/server/payload/jobs/types'
import { JobService } from '@/server/payload/services/job-service'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import type { User } from 'payload'
import { getPayload } from 'payload'

interface JobListQuery {
  page?: string
  limit?: string
  status?: string
  lessonId?: string
  dateFrom?: string
  dateTo?: string
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const authHeader = request.headers.get('authorization')

    // Auth check
    try {
      const { user } = await payload.auth({ headers: request.headers })
      requireAdminOrTestSecret(user as User | null, authHeader)
    } catch {
      return apiError('UNAUTHORIZED', 'Admin access required', 401)
    }

    const { searchParams } = new URL(request.url)
    const query: JobListQuery = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      status: searchParams.get('status') || undefined,
      lessonId: searchParams.get('lessonId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    }

    const page = parseInt(query.page || '1', 10) || 1
    const limit = Math.min(parseInt(query.limit || '20', 10) || 20, 100)
    const skip = (page - 1) * limit

    const jobService = JobService.fromPayload(payload)

    // Build query filter
    const filter: Record<string, unknown> = { taskSlug: TASK_SLUGS.PDF_TO_EXERCISES }

    if (query.lessonId) {
      filter['input.ctx.lessonId'] = query.lessonId
    }

    // Status filter (compute from processing/hasError/completedAt)
    if (query.status) {
      const statuses = query.status.split(',') as JobStatus[]
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

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {}
      if (query.dateFrom) {
        ;(filter.createdAt as Record<string, unknown>).$gte = new Date(query.dateFrom)
      }
      if (query.dateTo) {
        ;(filter.createdAt as Record<string, unknown>).$lte = new Date(query.dateTo)
      }
    }

    // Get total count
    const totalDocs = (await jobService.collection?.countDocuments(filter)) || 0

    // Get paginated results
    const jobs =
      (await jobService.collection
        ?.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()) || []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsWithStatus = jobs.map((doc: any) => ({
      id: doc._id.toString(),
      taskSlug: doc.taskSlug,
      processing: doc.processing,
      hasError: doc.hasError,
      completedAt: doc.completedAt,
      startedAt: doc.startedAt,
      createdAt: doc.createdAt,
      input: doc.input,
      output: doc.jobOutput || doc.output,
      status: jobService.computeStatus(doc as unknown as JobDocument),
    }))

    return apiSuccess({
      docs: jobsWithStatus,
      totalDocs,
      totalPages: Math.ceil(totalDocs / limit),
      page,
      limit,
    })
  } catch (error) {
    console.error('[jobs/list] Error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to fetch jobs', 500)
  }
}
