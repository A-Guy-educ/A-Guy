import { requireAdminOrTestSecret } from '@/server/api/auth'
import { apiError, apiSuccess } from '@/server/api/responses'
import type { JobLogEntry } from '@/server/payload/jobs/types'
import { JobService } from '@/server/payload/services/job-service'
import config from '@payload-config'
import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

interface CancelRequest {
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

    const body: CancelRequest = await request.json()

    if (!body.jobId) {
      return apiError('VALIDATION_ERROR', 'jobId is required', 400)
    }

    if (!ObjectId.isValid(body.jobId)) {
      return apiError('VALIDATION_ERROR', 'Invalid job ID format', 400)
    }

    const jobService = JobService.fromPayload(payload)
    const job = await jobService.getById(body.jobId)

    if (!job) {
      return apiError('NOT_FOUND', 'Job not found', 404)
    }

    // Only queued jobs can be cancelled
    if (job.processing) {
      return apiError('JOB_ALREADY_RUNNING', 'Cannot cancel a running job', 400)
    }

    if (job.completedAt || job.hasError) {
      return apiError('JOB_ALREADY_COMPLETED', 'Cannot cancel a completed or failed job', 400)
    }

    const now = new Date().toISOString()
    const cancelLogEntry: JobLogEntry = {
      timestamp: now,
      level: 'info',
      stage: 'CANCELLED',
      message: 'Job cancelled by user',
    }

    // Update job to cancelled state
    await jobService.collection?.updateOne(
      { _id: new ObjectId(body.jobId) },
      {
        $set: {
          processing: false,
          hasError: true,
          completedAt: new Date(),
          'output.currentStage': 'CANCELLED',
          'output.currentStageMessage': 'Job cancelled by user',
        },
        $push: { 'output.logs': cancelLogEntry } as any,
      },
    )

    return apiSuccess({ success: true, jobId: body.jobId }, 'Job cancelled successfully')
  } catch (error) {
    console.error('[jobs/cancel] Error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to cancel job', 500)
  }
}
