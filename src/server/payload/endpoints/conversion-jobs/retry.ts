/**
 * Retry Conversion Job Handler
 *
 * Retries a failed or cancelled conversion job by:
 * 1. Validating job exists and is in failed/cancelled status
 * 2. Resetting job state
 * 3. Re-queuing the Payload job
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const retryConversionHandler: PayloadHandler = async (req) => {
  const { id: jobId } = req.routeParams as { id?: string }

  if (!jobId) {
    throw new APIError('Job ID required', 400)
  }

  const payload = req.payload ?? (await getPayload({ config }))

  // Fetch the conversion job
  const job = await payload.findByID({
    collection: 'conversion-jobs',
    id: jobId,
    depth: 1,
  })

  if (!job) {
    throw new APIError('Job not found', 404)
  }

  // Validate job can be retried
  const retriableStatuses = ['failed', 'cancelled', 'paused']
  if (!retriableStatuses.includes(job.status)) {
    throw new APIError(
      `Cannot retry job in ${job.status} status. Job must be failed, cancelled, or paused.`,
      400,
    )
  }

  // Get tenant ID
  const tenantId = typeof job.tenant === 'object' ? job.tenant?.id : job.tenant

  // Queue new Payload job
  const payloadJob = await payload.jobs.queue({
    task: 'pdf_to_exercises',
    input: {},
    meta: {
      conversionJobId: job.id,
      tenantId,
      isRetry: true,
      lessonId: typeof job.lesson === 'object' ? job.lesson?.id : job.lesson,
      sourceDocId: typeof job.sourceMedia === 'object' ? job.sourceMedia?.id : job.sourceMedia,
    },
  })

  // Reset job state and queue
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      status: 'queued',
      payloadJobId: typeof payloadJob.id === 'string' ? payloadJob.id : undefined,
      startedAt: new Date().toISOString(),
      currentStage: 'INIT',
      currentStageMessage: 'Conversion queued for retry',
      progress: {
        totalSegments: 0,
        completedSegments: 0,
        failedSegments: 0,
        totalExercises: 0,
        approvedExercises: 0,
        rejectedExercises: 0,
        skippedExercises: 0,
        dedupedExercises: 0,
      },
      segments: [],
      pendingExercises: [],
      completedExercises: [],
      errors: [],
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Conversion job queued for retry',
    jobId: job.id,
    payloadJobId: payloadJob.id,
  })
}
