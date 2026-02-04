import {
  getPdfConversionMaxExercisesPerSegment,
  getPdfConversionMaxSegmentPages,
} from '@/infra/config/system-params'
import { PDF_MAX_BYTES } from '@/server/config/constants'
import { getPdfBufferFromBlob } from '@/server/services/pdf-fetcher'
import { computeContentHash } from '@/server/utils/hash'
import config from '@payload-config'
// JobTask type is not exported from payload, define inline
import { ObjectId } from 'mongodb'
import { getPayload } from 'payload'

import type { MediaPartWithPath } from '@/infra/llm/multimodal/types'
import {
  getLLMProvider,
  getProviderModelConfig,
  getProviderTypeFromEnv,
  LLMProviderType,
} from '@/infra/llm/providers/factory'
import { mapMultimodalToGemini } from '@/infra/llm/providers/gemini/multimodal-mapper'
import { mapMultimodalToOpenAI } from '@/infra/llm/providers/openai-compatible/multimodal-mapper'
import {
  enrichBlockIds,
  isContentRicher,
  normalizeExerciseInput,
  parseExtractorResponseText,
  parseVerifierResponseText,
  toPayloadContent,
} from '@/server/services/exercise-conversion/helpers'
import { z } from 'zod'
import { createJobLogger } from './job-logger'

export const pdfToExercisesTask = {
  slug: 'pdf_to_exercises',
  input: {},
  output: {},

  async handler({ job, req }: { job: any; req: any }) {
    // v2.1 Fix 1: Use req.payload when available (testability), fallback to getPayload
    const payload = req.payload ?? (await getPayload({ config }))
    const input = job.input as any
    const { lessonId, sourceDocId, tenantId } = input.ctx

    // Initialize structured logging
    const jobLogger = await createJobLogger(job.id, payload)

    const output: any = {
      segmentsTotal: 0,
      segmentsDone: 0,
      segmentsFailed: 0,
      currentSegmentIndex: 0,
      exercisesCreated: 0,
      exercisesDeduped: 0,
      exercisesSkipped: 0, // v2.1: Track skipped exercises
      errors: [],
      segments: [],
      logs: [],
      currentStage: 'INIT',
      currentStageMessage: 'Starting PDF to exercises conversion',
    }

    // Log job start
    await jobLogger?.info('INIT', 'Starting PDF to exercises conversion', {
      lessonId,
      sourceDocId,
      tenantId,
    })

    try {
      // Fetch media document to get URL for multimodal mapper
      const media = await payload.findByID({
        collection: 'media',
        id: sourceDocId,
        depth: 0,
        overrideAccess: true,
      })

      if (!media || !media.url) {
        throw {
          stage: 'PASS0_EXTRACT',
          code: 'MEDIA_NOT_FOUND',
          message: 'Media document has no URL',
        }
      }

      // PASS 0: Load and Validate PDF from Vercel Blob
      const pdfBuffer = await getPdfBufferFromBlob(sourceDocId, payload, req)

      await jobLogger?.info('PDF_LOAD', 'Loading PDF from blob storage', {
        url: media.url,
        size: pdfBuffer.length,
      })

      if (pdfBuffer.length > PDF_MAX_BYTES) {
        await jobLogger?.error('PDF_LOAD', 'PDF too large', {
          size: pdfBuffer.length,
          maxSize: PDF_MAX_BYTES,
        })
        throw { stage: 'PASS0_EXTRACT', code: 'PDF_TOO_LARGE', message: 'PDF too large' }
      }

      // PASS 1: Segment Indexing (using buffer)
      const maxSegmentPages = await getPdfConversionMaxSegmentPages(tenantId)
      const segments = await segmentPdf(pdfBuffer, maxSegmentPages)
      output.segmentsTotal = segments.length

      await jobLogger?.info('PDF_SEGMENT', 'Segmented PDF', {
        totalPages: pdfBuffer.length > 0 ? 'unknown' : 0, // page count would need pdf-lib
        segmentCount: segments.length,
        maxPagesPerSegment: maxSegmentPages,
      })

      // ========== Prepare Multimodal PDF Parts (v2.1: Use EXISTING infrastructure) ==========
      // Create MediaPartWithPath for the PDF (same format as Chat Media Upload)
      // Use publicUrl from media document (Vercel Blob URL)
      const mediaPartWithPath: MediaPartWithPath = {
        mediaId: sourceDocId,
        type: 'pdf',
        absoluteFilePath: '', // Not used for Blob storage
        publicUrl: media.url, // Vercel Blob URL
        mimeType: 'application/pdf',
      }

      // Use provider-appropriate multimodal mapper
      const providerType = await getProviderTypeFromEnv(payload)
      let attachments: Array<{ data: string; mimeType: string }>

      if (providerType === LLMProviderType.OPENAI_COMPATIBLE) {
        attachments = await mapMultimodalToOpenAI([mediaPartWithPath], payload, req)
      } else {
        // Convert to Gemini format, then extract attachments
        const geminiParts = await mapMultimodalToGemini([mediaPartWithPath], payload, req)
        attachments = geminiParts.currentMessage
          .filter((part: any) => part.inlineData)
          .map((part: any) => ({
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          }))
      }

      // PASS 2: Extract + Verify + Persist
      for (let i = 0; i < segments.length; i++) {
        output.currentSegmentIndex = i
        const segment = segments[i]

        await jobLogger?.info('SEGMENT_EXTRACT', 'Processing segment', {
          index: i,
          pageStart: segment.pageStart,
          pageEnd: segment.pageEnd,
          segmentNumber: i + 1,
          totalSegments: segments.length,
        })

        try {
          const exercises = await processSegmentWithMultimodal(payload, req, {
            attachments, // Provider-agnostic attachment format
            segment,
            extractorPrompt: input.promptSnapshot.extractor,
            verifierPrompt: input.promptSnapshot.verifier,
            output, // v2.1: Pass output for exercisesSkipped tracking
            tenantId, // For SystemParams access
          })

          let created = 0
          let deduped = 0

          for (const exercise of exercises) {
            // Compute contentKey BEFORE enrichment for stable identity
            const normalizedInput = normalizeExerciseInput(exercise)
            const contentHash = computeContentHash(normalizedInput)

            // Use Payload API to maintain hooks/tenant/ACL/validation
            // Find existing exercise by (lessonId, sourceDocId, contentHash)
            const existing = await payload.find({
              collection: 'exercises',
              where: {
                and: [
                  { lesson: { equals: lessonId } },
                  { sourceDoc: { equals: sourceDocId } },
                  { contentHash: { equals: contentHash } },
                ],
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
              req,
            })

            if (existing.docs.length > 0) {
              // Exercise exists - prefer richer content
              const existingDoc = existing.docs[0]
              const newPayloadContent = toPayloadContent(exercise)

              // Only update if new content is strictly richer
              if (isContentRicher(existingDoc.content, newPayloadContent)) {
                await payload.update({
                  collection: 'exercises',
                  id: existingDoc.id,
                  data: {
                    content: newPayloadContent,
                    sourcePageStart: segment.pageStart,
                    sourcePageEnd: segment.pageEnd,
                    sourceOrderInSegment: exercise.orderInSegment,
                    conversionJobId: job.id,
                    updatedAt: new Date(),
                  },
                  overrideAccess: true,
                  req,
                })
              }
              deduped++
            } else {
              // New exercise - create with enriched content
              const payloadContent = toPayloadContent(exercise)
              try {
                await payload.create({
                  collection: 'exercises',
                  data: {
                    title: exercise.title,
                    content: payloadContent,
                    status: 'draft',
                    origin: 'conversion',
                    tenant: tenantId,
                    lesson: lessonId,
                    sourceDoc: sourceDocId,
                    conversionJobId: job.id,
                    sourcePageStart: segment.pageStart,
                    sourcePageEnd: segment.pageEnd,
                    sourceOrderInSegment: exercise.orderInSegment,
                    contentHash,
                  },
                  overrideAccess: true,
                  req,
                })
                created++
              } catch (createError: any) {
                // Handle duplicate key error (concurrency scenario)
                if (createError.code === 11000 || createError.message?.includes('duplicate key')) {
                  // Re-find and treat as deduped
                  const retryFind = await payload.find({
                    collection: 'exercises',
                    where: {
                      and: [
                        { lesson: { equals: lessonId } },
                        { sourceDoc: { equals: sourceDocId } },
                        { contentHash: { equals: contentHash } },
                      ],
                    },
                    limit: 1,
                    depth: 0,
                    overrideAccess: true,
                    req,
                  })
                  if (retryFind.docs.length > 0) {
                    deduped++
                  } else {
                    // Index exists but document not found - rethrow
                    throw createError
                  }
                } else {
                  throw createError
                }
              }
            }
          }

          output.exercisesCreated += created
          output.exercisesDeduped += deduped
          output.segmentsDone++

          await jobLogger?.info('SEGMENT_VERIFY', 'Verifying exercises', {
            count: exercises.length,
          })

          output.segments?.push({
            index: i,
            pageStart: segment.pageStart,
            pageEnd: segment.pageEnd,
            status: 'done',
            exercisesCreated: created,
            exercisesDeduped: deduped,
            exercisesSkipped: output.exercisesSkipped || 0,
          })

          await jobLogger?.info('SEGMENT_PERSIST', 'Saved exercises', {
            created,
            deduped,
            skipped: output.exercisesSkipped || 0,
          })
        } catch (segmentError: any) {
          output.segmentsFailed++
          output.errors.push({
            stage: 'PASS2_EXTRACT',
            pageRange: { start: segment.pageStart, end: segment.pageEnd },
            code: segmentError.code || 'SEGMENT_FAILED',
            message: segmentError.message || 'Segment processing failed',
          })
          output.segments?.push({
            index: i,
            pageStart: segment.pageStart,
            pageEnd: segment.pageEnd,
            status: 'failed',
            exercisesCreated: 0,
            error: segmentError.message,
          })

          await jobLogger?.error('SEGMENT_EXTRACT', 'Segment processing failed', {
            index: i,
            pageStart: segment.pageStart,
            pageEnd: segment.pageEnd,
            error: segmentError.message,
            code: segmentError.code,
          })
          throw segmentError
        }
      }

      // Mark job as completed
      await jobLogger?.info('COMPLETE', 'Conversion completed successfully', {
        totalExercises: output.exercisesCreated,
        totalSegments: segments.length,
        segmentsCompleted: output.segmentsDone,
        segmentsFailed: output.segmentsFailed,
        deduped: output.exercisesDeduped,
        skipped: output.exercisesSkipped,
      })
      await updateJobStatus(payload, job.id, 'completed', output)
      return output
    } catch (error: any) {
      await jobLogger?.error('FAILED', 'Conversion failed', {
        error: error.message,
        stage: error.stage || 'UNKNOWN',
        code: error.code,
      })
      console.error(`[PDF→Exercises] Job ${job.id} failed:`, error)
      await updateJobStatus(payload, job.id, 'failed', {
        ...output,
        error: error.message,
      })
      throw error
    }
  },
}

/**
 * Explicitly update job status in MongoDB to ensure proper status tracking
 * This fixes the issue where jobs get stuck with "processing: true"
 */
async function updateJobStatus(
  payload: any,
  jobId: string,
  status: 'completed' | 'failed',
  output?: any,
): Promise<void> {
  const db = payload.db as any
  const coll = db.connection?.collection?.('payload-jobs')
  if (!coll) {
    console.warn('[PDF→Exercises] Cannot update job status - jobs collection not accessible')
    return
  }

  const update: any = {
    processing: false,
    completedAt: new Date(),
    hasError: status === 'failed',
  }

  if (output) {
    update.jobOutput = output
  }

  try {
    await coll.updateOne({ _id: new ObjectId(jobId) }, { $set: update })
  } catch (err) {
    console.error(`[PDF→Exercises] Failed to update job status:`, err)
  }
}

/**
 * Segment PDF into page ranges for batch processing
 * Uses pdf-lib for serverless-compatible page counting
 */
async function segmentPdf(pdfBuffer: Buffer, maxPagesPerSegment: number) {
  // Use pdf-lib for serverless-compatible page counting
  // pdf-lib has no worker thread issues on Vercel
  const { getPageCount } = await import('@/server/utils/pdf-metadata')
  const pageCount = await getPageCount(pdfBuffer)

  const segments = []
  for (let start = 1; start <= pageCount; start += maxPagesPerSegment) {
    const end = Math.min(start + maxPagesPerSegment - 1, pageCount)
    segments.push({ pageStart: start, pageEnd: end, pageCount: end - start + 1 })
  }

  return segments
}

/**
 * Process segment with REAL multimodal PDF attachment
 * Uses Gemini provider for API calls with retry and timeout handling
 */
async function processSegmentWithMultimodal(
  payload: any,
  req: any,
  context: {
    attachments: Array<{ data: string; mimeType: string }> // Provider-agnostic format
    segment: { pageStart: number; pageEnd: number }
    extractorPrompt: string
    verifierPrompt: string
    output: any // For tracking exercisesSkipped
    tenantId: string // For SystemParams access
  },
) {
  const { attachments, segment, extractorPrompt, verifierPrompt, output, tenantId } = context

  // ========== Call Extractor with MULTIMODAL PDF Attachment ==========
  const extractorPromptWithContext = `${extractorPrompt}

Process pages ${segment.pageStart}-${segment.pageEnd} of the attached PDF.

Return a JSON array of exercises with this schema:
[
  {
    "title": "Exercise title",
    "blocks": [
      { "type": "rich_text", "id": "optional-id", "format": "md-math-v1", "value": "..." },
      { "type": "latex", "id": "optional-id", "latex": "\\\\frac{1}{2}", "renderMode": "block" }
    ],
    "orderInSegment": 1
  }
]`

  // Use factory provider with AI_MODELS configuration
  const provider = await getLLMProvider(payload)
  const providerType = await getProviderTypeFromEnv(payload)
  const modelConfig = getProviderModelConfig(providerType, 'PDF_TO_EXERCISE')

  const extractorResult = await provider.generateMultimodalCompletion(
    {
      prompt: extractorPromptWithContext,
      model: modelConfig,
      attachments,
    },
    payload,
  )

  const rawExtracted = parseExtractorResponseText(extractorResult.text)

  // ========== Schema Validation for Extractor Output ==========
  const maxExercisesPerSegment = await getPdfConversionMaxExercisesPerSegment(tenantId)
  const extracted = validateExtractedExercises(rawExtracted, segment, maxExercisesPerSegment)

  // ========== Enrich with block IDs if missing ==========
  const enrichedExercises = extracted.map((exercise) => enrichBlockIds(exercise))

  // ========== Call Verifier with RETRY-ONCE-THEN-SKIP logic ==========
  const validExercises: any[] = []

  for (const exercise of enrichedExercises) {
    const verifierPromptWithContext = `${verifierPrompt}

Exercise to verify:
${JSON.stringify(exercise, null, 2)}

Source PDF pages: ${segment.pageStart}-${segment.pageEnd}

Return JSON: { "valid": boolean, "reason": "..." }`

    // First verification attempt
    let verification = await callVerifier(payload, attachments, verifierPromptWithContext)

    // Retry once if verification fails
    if (!verification.valid) {
      verification = await callVerifier(payload, attachments, verifierPromptWithContext)
    }

    // Skip invalid exercises instead of failing the job
    if (!verification.valid) {
      console.warn(
        `[PDF→Exercises] Skipping exercise "${exercise.title}" after retry: ${verification.reason}`,
      )
      output.errors.push({
        stage: 'PASS2_VERIFY',
        pageRange: { start: segment.pageStart, end: segment.pageEnd },
        code: 'VERIFICATION_FAILED',
        message: verification.reason || 'Verification failed after retry',
        exerciseTitle: exercise.title,
        skipped: true,
      })
      output.exercisesSkipped = (output.exercisesSkipped || 0) + 1
      continue // Skip this exercise, continue with others
    }

    validExercises.push(exercise)
  }

  return validExercises
}

/**
 * Helper to call verifier using factory provider
 */
async function callVerifier(
  payload: any,
  attachments: Array<{ data: string; mimeType: string }>,
  prompt: string,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const provider = await getLLMProvider(payload)
    const providerType = await getProviderTypeFromEnv(payload)
    const modelConfig = getProviderModelConfig(providerType, 'PDF_TO_EXERCISE')

    const result = await provider.generateMultimodalCompletion(
      {
        prompt,
        model: modelConfig,
        attachments,
      },
      payload,
    )
    return parseVerifierResponseText(result.text)
  } catch (error) {
    return { valid: false, reason: `Verifier call failed: ${error}` }
  }
}

/**
 * Zod schema for ExerciseExtracted validation
 * v2.1 Fix 1: Block `id` is OPTIONAL in extractor output - we generate with nanoid() after validation
 */
const RichTextBlockSchema = z.object({
  type: z.literal('rich_text'),
  id: z.string().min(1).optional(), // v2.1: Optional - generated post-validation if missing
  format: z.literal('md-math-v1'),
  value: z.string(),
})

const LatexBlockSchema = z.object({
  type: z.literal('latex'),
  id: z.string().min(1).optional(), // v2.1: Optional - generated post-validation if missing
  latex: z.string().min(1),
  renderMode: z.enum(['block', 'inline']).default('block'),
})

const ExerciseExtractedSchema = z.object({
  title: z.string().min(1),
  blocks: z.array(z.union([RichTextBlockSchema, LatexBlockSchema])),
  orderInSegment: z.number().int().positive(),
})

/**
 * Validate extractor output against ExerciseExtracted schema
 * Returns validated array or throws INVALID_EXTRACTOR_OUTPUT error
 */
function validateExtractedExercises(
  raw: any[],
  segment: { pageStart: number; pageEnd: number },
  maxExercisesPerSegment: number,
): any[] {
  const validated: any[] = []
  const errors: string[] = []

  for (let i = 0; i < raw.length; i++) {
    const result = ExerciseExtractedSchema.safeParse(raw[i])
    if (result.success) {
      validated.push(result.data)
    } else {
      errors.push(`Exercise ${i + 1}: ${result.error.message}`)
    }
  }

  if (errors.length > 0) {
    throw {
      code: 'INVALID_EXTRACTOR_OUTPUT',
      message: `Schema validation failed: ${errors.join('; ')}`,
      pageRange: { start: segment.pageStart, end: segment.pageEnd },
    }
  }

  // Enforce max exercises per segment limit
  if (validated.length > maxExercisesPerSegment) {
    console.warn(
      `[PDF→Exercises] Truncated exercises from ${validated.length} to ${maxExercisesPerSegment}`,
    )
    validated.length = maxExercisesPerSegment
  }

  return validated
}
