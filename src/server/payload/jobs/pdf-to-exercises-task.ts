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
import { getPayload, type Payload } from 'payload'

import type { MediaPartWithPath } from '@/infra/llm/multimodal/types'
import {
  getLLMProvider,
  getProviderModelConfig,
  getProviderTypeFromEnv,
} from '@/infra/llm/providers/factory'
import {
  enrichBlockIds,
  normalizeExerciseInput,
  parseExtractorResponseText,
  toPayloadContent,
} from '@/server/services/exercise-conversion/helpers'
import {
  createIdempotencyKeyFn,
  deduplicateByIdempotencyKey,
  SPEC_VERSION,
} from '@/server/services/exercise-conversion/idempotency'
import { z } from 'zod'

export const pdfToExercisesTask = {
  slug: 'pdf_to_exercises',
  input: {},
  output: {},

  async handler({ job, req }: { job: any; req: any }) {
    // v2.1 Fix 1: Use req.payload when available (testability), fallback to getPayload
    const payload = req.payload ?? (await getPayload({ config }))
    const input = job.input as any
    const { lessonId, sourceDocId, tenantId } = input.ctx

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
      verifierDisabled: true,
    }

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

      if (pdfBuffer.length > PDF_MAX_BYTES) {
        throw { stage: 'PASS0_EXTRACT', code: 'PDF_TOO_LARGE', message: 'PDF too large' }
      }

      // PASS 1: Segment Indexing (using buffer)
      const maxSegmentPages = await getPdfConversionMaxSegmentPages(tenantId)
      const segments = await segmentPdf(pdfBuffer, maxSegmentPages)
      output.segmentsTotal = segments.length

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

      // Convert PDF to base64 attachments for Genkit (provider-agnostic)
      const attachments = await convertMediaToAttachments([mediaPartWithPath], payload)

      // PASS 2: Extract + Verify + Persist
      // Idempotency-based upsert is always enabled (no feature flag)

      for (let i = 0; i < segments.length; i++) {
        output.currentSegmentIndex = i
        const segment = segments[i]

        try {
          const exercises = await processSegmentWithMultimodal(payload, req, {
            attachments, // Provider-agnostic attachment format
            segment,
            extractorPrompt: input.promptSnapshot.extractor,
            output, // v2.1: Pass output for exercisesSkipped tracking
            tenantId, // For SystemParams access
          })

          // ========== Stage 2: In-Memory Dedup ==========
          // Deduplicate by idempotency key before DB writes
          const computeIdempotencyKeyForExercise = createIdempotencyKeyFn({
            tenantId,
            lessonId,
            sourceDocId,
            pageStart: segment.pageStart,
            pageEnd: segment.pageEnd,
            specVersion: SPEC_VERSION,
          })

          // Perform in-memory dedup using system ordinal (loop index)
          const dedupResult = deduplicateByIdempotencyKey(exercises, (exercise, systemIndex) =>
            computeIdempotencyKeyForExercise(exercise, systemIndex),
          )
          const deduplicatedExercises = dedupResult.exercises

          // Log dedup metrics
          if (dedupResult.droppedCount > 0) {
            console.log(
              `[PDF→Exercises] Segment ${i}: in-memory dedup dropped ${dedupResult.droppedCount} duplicate exercises`,
            )
          }

          // Track idempotency keys for observability using system ordinal
          const proposedIdempotencyKeys: string[] = []
          let created = 0
          let deduped = 0

          for (let exIndex = 0; exIndex < deduplicatedExercises.length; exIndex++) {
            const exercise = deduplicatedExercises[exIndex]
            // Stage 4: Compute idempotency key for upsert using system ordinal (loop index)
            const idempotencyKey = computeIdempotencyKeyForExercise(exercise, exIndex)
            proposedIdempotencyKeys.push(idempotencyKey)

            // Log idempotency key with content hash for correlation (observability)
            const normalizedInput = normalizeExerciseInput(exercise)
            const contentHash = computeContentHash(normalizedInput)
            console.log(
              `[PDF→Exercises] Exercise idempotencyKey=${idempotencyKey}, contentHash=${contentHash}, title="${exercise.title}", orderInSegment=${exercise.orderInSegment}`,
            )

            // Stage 4: Upsert by idempotencyKey (Last Wins Semantics)
            // Find existing exercise by idempotencyKey (source-based identity)
            const existing = await payload.find({
              collection: 'exercises',
              where: {
                idempotencyKey: { equals: idempotencyKey },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
              req,
            })

            const payloadContent = toPayloadContent(exercise)

            if (existing.docs.length > 0) {
              // Exercise exists with same idempotencyKey - Last Wins: always update
              const existingDoc = existing.docs[0]
              await payload.update({
                collection: 'exercises',
                id: existingDoc.id,
                data: {
                  title: exercise.title,
                  content: payloadContent,
                  sourcePageStart: segment.pageStart,
                  sourcePageEnd: segment.pageEnd,
                  sourceOrderInSegment: exercise.orderInSegment,
                  conversionJobId: job.id,
                  updatedAt: new Date(),
                  // Keep idempotency fields updated
                  idempotencyKey,
                  specVersion: SPEC_VERSION,
                  extractionMeta: {
                    segmentIndex: i,
                    itemOrdinal: exercise.orderInSegment,
                  },
                },
                overrideAccess: true,
                req,
              })
              deduped++
            } else {
              // New exercise - create with enriched content
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
                    // Stage 3 & 4: Populate idempotency fields
                    idempotencyKey,
                    specVersion: SPEC_VERSION,
                    extractionMeta: {
                      segmentIndex: i,
                      itemOrdinal: exercise.orderInSegment,
                    },
                  },
                  overrideAccess: true,
                  req,
                })
                created++
              } catch (createError: any) {
                // Handle duplicate key error (concurrency scenario - race condition)
                if (createError.code === 11000 || createError.message?.includes('duplicate key')) {
                  // Someone else created it first - find and update (Last Wins)
                  const retryFind = await payload.find({
                    collection: 'exercises',
                    where: {
                      idempotencyKey: { equals: idempotencyKey },
                    },
                    limit: 1,
                    depth: 0,
                    overrideAccess: true,
                    req,
                  })
                  if (retryFind.docs.length > 0) {
                    await payload.update({
                      collection: 'exercises',
                      id: retryFind.docs[0].id,
                      data: {
                        title: exercise.title,
                        content: payloadContent,
                        sourcePageStart: segment.pageStart,
                        sourcePageEnd: segment.pageEnd,
                        sourceOrderInSegment: exercise.orderInSegment,
                        conversionJobId: job.id,
                        updatedAt: new Date(),
                        idempotencyKey,
                        specVersion: SPEC_VERSION,
                        extractionMeta: {
                          segmentIndex: i,
                          itemOrdinal: exercise.orderInSegment,
                        },
                      },
                      overrideAccess: true,
                      req,
                    })
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

          output.segments?.push({
            index: i,
            pageStart: segment.pageStart,
            pageEnd: segment.pageEnd,
            status: 'done',
            exercisesCreated: created,
            exercisesSkipped: output.exercisesSkipped || 0,
            debug: {
              proposedIdempotencyKeys,
            },
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
          })
          throw segmentError
        }
      }

      // Mark job as completed
      await updateJobStatus(payload, job.id, 'completed', output)

      console.info(
        `[PDF→Exercises] Job complete: extracted=${output.segmentsDone}, schemaSkipped=${output.exercisesSkipped}, persisted=${output.exercisesCreated}, verifierDisabled=true`,
      )

      return output
    } catch (error: any) {
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
    output: any // For tracking exercisesSkipped
    tenantId: string // For SystemParams access
  },
) {
  const { attachments, segment, extractorPrompt, output, tenantId } = context

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
  // Lenient validation: skips invalid exercises and logs errors (mirrors verifier pattern)
  const maxExercisesPerSegment = await getPdfConversionMaxExercisesPerSegment(tenantId)
  const extracted = validateExtractedExercises(
    rawExtracted,
    segment,
    maxExercisesPerSegment,
    output,
  )

  // ========== Enrich with block IDs if missing ==========
  const enrichedExercises = extracted.map((exercise) => enrichBlockIds(exercise))

  console.info(
    '[PDF→Exercises] Verifier step disabled; exercises pass through after schema validation only',
  )

  return enrichedExercises
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
 * Lenient validation: skips invalid exercises and logs errors instead of failing the entire segment
 * This mirrors the verifier pattern where invalid exercises are skipped rather than failing the job
 */
function validateExtractedExercises(
  raw: any[],
  segment: { pageStart: number; pageEnd: number },
  maxExercisesPerSegment: number,
  output?: {
    errors: Array<{
      stage: string
      pageRange: any
      code: string
      message: string
      skipped?: boolean
    }>
    exercisesSkipped?: number
  },
): any[] {
  const validated: any[] = []
  const validationErrors: string[] = []
  let skippedCount = 0

  for (let i = 0; i < raw.length; i++) {
    const result = ExerciseExtractedSchema.safeParse(raw[i])
    if (result.success) {
      validated.push(result.data)
    } else {
      const errorMsg = `Exercise ${i + 1}: ${result.error.message}`
      validationErrors.push(errorMsg)
      skippedCount++

      // Log the validation error
      console.warn(`[PDF→Exercises] Skipping invalid exercise ${i + 1}: ${result.error.message}`)

      // Track in output.errors if output object is provided (mirrors verifier pattern)
      if (output?.errors) {
        output.errors.push({
          stage: 'PASS2_EXTRACT_VALIDATION',
          pageRange: { start: segment.pageStart, end: segment.pageEnd },
          code: 'VALIDATION_FAILED',
          message: `Exercise ${i + 1}: ${result.error.message}`,
          skipped: true,
        })
      }
    }
  }

  // Update skipped count in output
  if (output && skippedCount > 0) {
    output.exercisesSkipped = (output.exercisesSkipped || 0) + skippedCount
  }

  // Log summary of validation failures instead of throwing
  if (validationErrors.length > 0) {
    console.warn(
      `[PDF→Exercises] Segment ${segment.pageStart}-${segment.pageEnd}: ${validationErrors.length}/${raw.length} exercises failed validation, proceeding with ${validated.length} valid exercises`,
    )
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

/**
 * Convert MediaPartWithPath items to Genkit-compatible attachments
 * Fetches media and converts to base64 format
 */
async function convertMediaToAttachments(
  mediaParts: MediaPartWithPath[],
  payload: Payload,
): Promise<Array<{ data: string; mimeType: string }>> {
  const attachments: Array<{ data: string; mimeType: string }> = []

  for (const mediaPart of mediaParts) {
    if (!mediaPart.mediaId) continue

    try {
      const mediaDoc = await payload.findByID({
        collection: 'media',
        id: mediaPart.mediaId,
        depth: 0,
      })

      if (mediaDoc && 'url' in mediaDoc && mediaDoc.url) {
        const imageUrl = mediaDoc.url.startsWith('/')
          ? `${process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'}${mediaDoc.url}`
          : mediaDoc.url

        const response = await fetch(imageUrl)
        const arrayBuffer = await response.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')

        attachments.push({
          data: base64,
          mimeType: mediaDoc.mimeType || mediaPart.mimeType || 'application/octet-stream',
        })
      }
    } catch (fetchError) {
      console.warn(
        { err: fetchError, mediaId: mediaPart.mediaId },
        '[PDF→Exercises] Failed to fetch media',
      )
    }
  }

  return attachments
}
