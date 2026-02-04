import { requireAdminOrTestSecret } from '@/server/api/auth'
import { apiError, apiSuccess } from '@/server/api/responses'
import { TASK_SLUGS } from '@/server/payload/jobs/constants'
import { JobService } from '@/server/payload/services/job-service'
import config from '@payload-config'
import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

interface RetryRequest {
  jobId: string
}

export async function POST(request: NextRequest): Promise<Response> {
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

    const body: RetryRequest = await request.json()

    if (!body.jobId) {
      return apiError('VALIDATION_ERROR', 'jobId is required', 400)
    }

    if (!ObjectId.isValid(body.jobId)) {
      return apiError('VALIDATION_ERROR', 'Invalid job ID format', 400)
    }

    const jobService = JobService.fromPayload(payload)
    const originalJob = await jobService.getById(body.jobId)

    if (!originalJob) {
      return apiError('NOT_FOUND', 'Job not found', 404)
    }

    // Create a new job with the same input
    const newJob = await payload.jobs.queue({
      task: TASK_SLUGS.PDF_TO_EXERCISES,
      input: originalJob.input,
    })

    // Note: The queue method returns the job ID
    const newJobId =
      typeof newJob === 'string' ? newJob : (newJob as any).id || (newJob as any)._id?.toString()

    return apiSuccess(
      { success: true, originalJobId: body.jobId, newJobId },
      'Job retry queued successfully',
    )
  } catch (error) {
    console.error('[jobs/retry] Error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to retry job', 500)
  }
}
