/**
 * Resume Conversion Job Handler
 *
 * Resumes a paused conversion job by:
 * 1. Validating job exists and is in paused status
 * 2. Re-queuing the Payload job if needed
 * 3. Updating job status to running
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const resumeConversionHandler: PayloadHandler = async (req) => {
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

  // Validate job can be resumed
  if (job.status !== 'paused') {
    throw new APIError(`Cannot resume job in ${job.status} status. Job must be paused.`, 400)
  }

  // Get tenant ID
  const tenantId = typeof job.tenant === 'object' ? job.tenant?.id : job.tenant

  // Re-queue the Payload job if there's a payloadJobId
  if (job.payloadJobId) {
    // For v2, we need to resume the existing job or create a continuation
    // This is a simplified approach - in production you'd want more robust job continuation
    await payload.jobs.queue({
      task: 'pdf_to_exercises',
      input: {},
      meta: {
        conversionJobId: job.id,
        tenantId,
        isResume: true,
        lessonId: typeof job.lesson === 'object' ? job.lesson?.id : job.lesson,
        sourceDocId: typeof job.sourceMedia === 'object' ? job.sourceMedia?.id : job.sourceMedia,
      },
    })
  }

  // Update job status to running
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      status: 'running',
      currentStageMessage: 'Conversion resumed',
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Conversion job resumed',
    jobId: job.id,
  })
}
