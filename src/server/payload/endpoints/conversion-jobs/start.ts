/**
 * Start Conversion Job Handler
 *
 * Initiates a conversion job by:
 * 1. Validating job exists and is in draft status
 * 2. Snapshotting prompts
 * 3. Creating and queueing the Payload job
 * 4. Updating job status to queued
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'
import type { StartConversionInput } from '../../services/conversion-service'

export const startConversionHandler: PayloadHandler = async (req) => {
  const { id: jobId } = req.routeParams as { id?: string }

  if (!jobId) {
    throw new APIError('Job ID required', 400)
  }

  const payload = req.payload ?? (await getPayload({ config }))

  // Parse request body for overrides
  const body = await req.json?.().catch(() => ({}))
  const {
    config: conversionConfig,
    prompts: promptOverrides,
    additionalRounds,
  } = body as StartConversionInput

  // Fetch the conversion job
  const job = await payload.findByID({
    collection: 'conversion-jobs',
    id: jobId,
    depth: 1,
  })

  if (!job) {
    throw new APIError('Job not found', 404)
  }

  // Validate job is in draft status
  if (job.status !== 'draft') {
    throw new APIError(`Cannot start job in ${job.status} status`, 400)
  }

  try {
    // Step 1: Resolve prompts (from job or request overrides)
    const extractorPromptId =
      promptOverrides?.extractorPromptId || (job.prompts as any)?.extractor?.id
    const verifierPromptId = promptOverrides?.verifierPromptId || (job.prompts as any)?.verifier?.id

    if (!extractorPromptId || !verifierPromptId) {
      throw new APIError('Extractor and verifier prompts are required', 400)
    }

    const extractorPrompt = await payload.findByID({
      collection: 'prompts',
      id: extractorPromptId,
      depth: 0,
    })

    const verifierPrompt = await payload.findByID({
      collection: 'prompts',
      id: verifierPromptId,
      depth: 0,
    })

    // Get prompt content
    const extractorContent = (extractorPrompt as any).template || ''
    const verifierContent = (verifierPrompt as any).template || ''

    // Step 2: Snapshot prompts
    const now = new Date().toISOString()
    const extractorHash = hashString(extractorContent)
    const verifierHash = hashString(verifierContent)

    // Get tenant ID from job
    const tenantId = typeof job.tenant === 'object' ? job.tenant?.id : job.tenant

    // Step 3: Prepare job input
    const jobInput = {
      ctx: {
        lessonId: typeof job.lesson === 'object' ? job.lesson?.id : job.lesson,
        sourceDocId: typeof job.sourceMedia === 'object' ? job.sourceMedia?.id : job.sourceMedia,
        tenantId,
        jobId: job.id,
      },
      config: conversionConfig ||
        job.config || {
          pageRange: { start: 1, excludePages: [] },
          segmentation: { pagesPerSegment: 5 },
          extraction: { mode: 'standard', exerciseTypes: [] },
          reviewMode: 'segment',
        },
      prompts: {
        extractor: extractorContent,
        verifier: verifierContent,
        extractorHash,
        verifierHash,
      },
      rounds: additionalRounds || (job.additionalRounds as any[]) || [],
      templateId: job.template || undefined,
    }

    // Step 4: Queue the Payload job using existing task type
    const payloadJob = await payload.jobs.queue({
      task: 'pdf_to_exercises',
      input: jobInput,
      meta: {
        conversionJobId: job.id,
        tenantId,
        lessonId: typeof job.lesson === 'object' ? job.lesson?.id : job.lesson,
        sourceDocId: typeof job.sourceMedia === 'object' ? job.sourceMedia?.id : job.sourceMedia,
      },
    })

    // Step 5: Update job status to queued
    await payload.update({
      collection: 'conversion-jobs',
      id: job.id,
      data: {
        status: 'queued',
        payloadJobId: typeof payloadJob.id === 'string' ? payloadJob.id : undefined,
        startedAt: now,
        currentStage: 'INIT',
        currentStageMessage: 'Conversion job queued',
        prompts: {
          extractor: extractorPromptId,
          verifier: verifierPromptId,
          extractorSnapshot: {
            template: extractorContent,
            hash: extractorHash,
            capturedAt: now,
          },
          verifierSnapshot: {
            template: verifierContent,
            hash: verifierHash,
            capturedAt: now,
          },
        },
        additionalRounds: additionalRounds || [],
      },
      req,
    })

    return Response.json({
      success: true,
      message: 'Conversion job queued successfully',
      jobId: job.id,
      payloadJobId: payloadJob.id,
    })
  } catch (error) {
    console.error('[startConversion] Error:', error)

    // Update job to failed status with error
    await payload.update({
      collection: 'conversion-jobs',
      id: job.id,
      data: {
        status: 'failed',
        jobErrors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
        completedAt: new Date().toISOString(),
      },
      req,
    })

    throw error
  }
}

/**
 * Simple string hash for prompt versioning
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}
