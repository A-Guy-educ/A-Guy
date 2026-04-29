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
} from '@/infra/llm/providers/factory'
import {
  enrichBlockIds,
  normalizeExerciseInput,
  parseExtractorResponseText,
  parseVerifierResponseText,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handler({ job, req }: any) {
    // v2.1 Fix 1: Use req.payload when available (testability), fallback to getPayload
    const payload = req.payload ?? (await getPayload({ config }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = job.input as any
    const { lessonId, sourceDocId, tenantId } = input.ctx

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = {
      segmentsTotal: 0,
      segmentsDone: 0,
      segmentsFailed: 0,
      currentSegmentIndex: 0,
      exercisesCreated: 0,
      exercisesDeduped: 0,
      exercisesSkipped: 0, // v2.1: Track skipped exercises
      errors: [] as unknown[],
      segments: [] as unknown[],
    }

    // Collect every exercise id we touch (create + upsert) so we can
    // reconcile the lesson.blocks playlist once all segments finish.
    const upsertedExerciseIds = new Set<string>()

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfBuffer = await getPdfBufferFromBlob(sourceDocId, payload, req as any)

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attachments = await convertMediaToAttachments([mediaPartWithPath], payload as any)

      // PASS 2: Extract + Verify + Persist
      // Idempotency-based upsert is always enabled (no feature flag)

      for (let i = 0; i < segments.length; i++) {
        output.currentSegmentIndex = i
        const segment = segments[i]

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const exercises = await processSegmentWithMultimodal(payload as any, req as any, {
            attachments, // Provider-agnostic attachment format
            segment,
            extractorPrompt: input.promptSnapshot.extractor,
            verifierPrompt: input.promptSnapshot.verifier,
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
          // exercises is ValidatedExercise[] which is compatible with EnrichedExercise[]
          const dedupResult = deduplicateByIdempotencyKey(
            exercises as import('@/server/services/exercise-conversion/idempotency').EnrichedExercise[],
            (exercise, systemIndex) => computeIdempotencyKeyForExercise(exercise, systemIndex),
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              req: req as any,
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
                  updatedAt: new Date().toISOString(),
                  // Keep idempotency fields updated
                  idempotencyKey,
                  specVersion: SPEC_VERSION,
                  extractionMeta: {
                    segmentIndex: i,
                    itemOrdinal: exercise.orderInSegment,
                  },
                },
                overrideAccess: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                req: req as any,
              })
              upsertedExerciseIds.add(String(existingDoc.id))
              deduped++
            } else {
              // New exercise - create with enriched content
              try {
                const createdDoc = await payload.create({
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  req: req as any,
                })
                upsertedExerciseIds.add(String(createdDoc.id))
                created++
              } catch (createError: unknown) {
                // Handle duplicate key error (concurrency scenario - race condition)
                const err = createError as { code?: number; message?: string }
                if (err.code === 11000 || err.message?.includes('duplicate key')) {
                  // Someone else created it first - find and update (Last Wins)
                  const retryFind = await payload.find({
                    collection: 'exercises',
                    where: {
                      idempotencyKey: { equals: idempotencyKey },
                    },
                    limit: 1,
                    depth: 0,
                    overrideAccess: true,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    req: req as any,
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
                        updatedAt: new Date().toISOString(),
                        idempotencyKey,
                        specVersion: SPEC_VERSION,
                        extractionMeta: {
                          segmentIndex: i,
                          itemOrdinal: exercise.orderInSegment,
                        },
                      },
                      overrideAccess: true,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      req: req as any,
                    })
                    upsertedExerciseIds.add(String(retryFind.docs[0].id))
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

          output.exercisesCreated = ((output.exercisesCreated as number) || 0) + created
          output.exercisesDeduped = ((output.exercisesDeduped as number) || 0) + deduped
          output.segmentsDone = ((output.segmentsDone as number) || 0) + 1
          ;(output.segments as unknown[]).push({
            index: i,
            pageStart: segment.pageStart,
            pageEnd: segment.pageEnd,
            status: 'done',
            exercisesCreated: created,
            exercisesSkipped: (output.exercisesSkipped as number) || 0,
            debug: {
              proposedIdempotencyKeys,
            },
          })
        } catch (segmentError: unknown) {
          output.segmentsFailed = ((output.segmentsFailed as number) || 0) + 1
          const err = segmentError as {
            code?: string
            message?: string
            provider?: string
            retryable?: boolean
            cause?: { message?: string }
            name?: string
          }
          ;(output.errors as unknown[]).push({
            stage: 'PASS2_EXTRACT',
            pageRange: { start: segment.pageStart, end: segment.pageEnd },
            code: err.code || err.name || 'SEGMENT_FAILED',
            message: err.message || 'Segment processing failed',
            provider: err.provider,
            retryable: err.retryable,
            cause: err.cause?.message,
          })
          ;(output.segments as unknown[]).push({
            index: i,
            pageStart: segment.pageStart,
            pageEnd: segment.pageEnd,
            status: 'failed',
            exercisesCreated: 0,
          })
          throw segmentError
        }
      }

      // Reconcile lesson.blocks: ensure every upserted exercise appears as an
      // exerciseRef in the lesson playlist. Existing entries are preserved;
      // we only append refs that are missing. Failure here is logged but does
      // not fail the job — exercises are still queryable via exercise.lesson.
      if (upsertedExerciseIds.size > 0) {
        try {
          const lesson = await payload.findByID({
            collection: 'lessons',
            id: lessonId,
            depth: 0,
            overrideAccess: true,
          })

          const rawBlocks = (lesson as { blocks?: unknown }).blocks
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let existingBlocks: any[] = []
          if (Array.isArray(rawBlocks)) {
            existingBlocks = rawBlocks
          } else if (typeof rawBlocks === 'string' && rawBlocks.trim()) {
            try {
              const parsed = JSON.parse(rawBlocks)
              if (Array.isArray(parsed)) existingBlocks = parsed
            } catch {
              // ignore, treat as empty
            }
          }

          const referencedIds = new Set<string>()
          for (const block of existingBlocks) {
            if (block?.blockType === 'exerciseRef') {
              const ref = block.exercise
              if (typeof ref === 'string') referencedIds.add(ref)
              else if (ref && typeof ref === 'object' && 'id' in ref)
                referencedIds.add(String(ref.id))
            }
          }

          const missing = Array.from(upsertedExerciseIds).filter(
            (exerciseId) => !referencedIds.has(exerciseId),
          )

          if (missing.length > 0) {
            const appended = missing.map((exerciseId) => ({
              id: Math.random().toString(36).slice(2, 14),
              blockType: 'exerciseRef',
              exercise: exerciseId,
            }))

            await payload.update({
              collection: 'lessons',
              id: lessonId,
              data: { blocks: JSON.stringify([...existingBlocks, ...appended]) } as Record<
                string,
                unknown
              >,
              overrideAccess: true,
            })
            console.log(
              `[PDF→Exercises] Lesson ${lessonId}: appended ${missing.length} exerciseRef block(s) to playlist`,
            )
          }
        } catch (blocksError) {
          const message = blocksError instanceof Error ? blocksError.message : 'Unknown error'
          console.error(
            `[PDF→Exercises] Failed to reconcile lesson.blocks for ${lessonId}:`,
            blocksError,
          )
          // Surface in output.errors so the conversion panel doesn't show a
          // green "completed" status while the playlist is silently stale.
          ;(output.errors as unknown[]).push({
            stage: 'POST_LESSON_BLOCKS_RECONCILE',
            code: 'LESSON_BLOCKS_RECONCILE_FAILED',
            message,
            lessonId,
            retryable: true,
          })
        }
      }

      // Mark job as completed
      await updateJobStatus(payload as unknown as { db: unknown }, job.id, 'completed', output)
      return output
    } catch (error: unknown) {
      const err = error as {
        message?: string
        code?: string
        provider?: string
        retryable?: boolean
        cause?: { message?: string }
        name?: string
      }
      console.error(`[PDF→Exercises] Job ${job.id} failed:`, error)
      await updateJobStatus(payload as unknown as { db: unknown }, job.id, 'failed', {
        ...output,
        error: err.message,
        errorCode: err.code || err.name,
        errorProvider: err.provider,
        errorRetryable: err.retryable,
        errorCause: err.cause?.message,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  jobId: string,
  status: 'completed' | 'failed',
  output?: Record<string, unknown>,
): Promise<void> {
  const db = payload.db
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coll = db?.connection?.collection?.('payload-jobs') as any
  if (!coll) {
    console.warn('[PDF→Exercises] Cannot update job status - jobs collection not accessible')
    return
  }

  const update: Record<string, unknown> = {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  context: {
    attachments: Array<{ data: string; mimeType: string }> // Provider-agnostic format
    segment: { pageStart: number; pageEnd: number }
    extractorPrompt: string
    verifierPrompt: string
    output: { exercisesSkipped?: number; errors: unknown[] }
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

  let rawExtracted = parseExtractorResponseText(extractorResult.text)

  // ========== Exercise Count Check with Auto-Retry ==========
  // If the extraction returned suspiciously few exercises (e.g., 2 instead of 8),
  // retry once — run-to-run variance is a known issue with LLM extraction.
  const minExpectedPerPage = 1 // At least 1 exercise per page on average
  const minExpected = Math.max(1, segment.pageEnd - segment.pageStart + 1) * minExpectedPerPage
  if (Array.isArray(rawExtracted) && rawExtracted.length < minExpected) {
    console.warn(
      `[PDF→Exercises] Segment pages ${segment.pageStart}-${segment.pageEnd}: ` +
        `extracted only ${rawExtracted.length} exercises (expected ≥${minExpected}), retrying...`,
    )
    const retryResult = await provider.generateMultimodalCompletion(
      {
        prompt: extractorPromptWithContext,
        model: modelConfig,
        attachments,
      },
      payload,
    )
    const retryExtracted = parseExtractorResponseText(retryResult.text)
    // Use whichever extraction returned more exercises
    if (Array.isArray(retryExtracted) && retryExtracted.length > rawExtracted.length) {
      rawExtracted = retryExtracted
    }
  }

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedExercises = extracted.map((exercise: any) => enrichBlockIds(exercise))

  // ========== Call Verifier with RETRY-ONCE-THEN-SKIP logic ==========
  const validExercises: Array<{ title: string; blocks: unknown[]; orderInSegment: number }> = []

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Type for validated exercises returned from the extractor
 */
type ValidatedExercise = z.infer<typeof ExerciseExtractedSchema>

/**
 * Validate extractor output against ExerciseExtracted schema
 * Lenient validation: skips invalid exercises and logs errors instead of failing the entire segment
 * This mirrors the verifier pattern where invalid exercises are skipped rather than failing the job
 */
function validateExtractedExercises(
  raw: unknown[],
  segment: { pageStart: number; pageEnd: number },
  maxExercisesPerSegment: number,
  output?: {
    errors: unknown[]
    exercisesSkipped?: number
  },
): ValidatedExercise[] {
  const validated: ValidatedExercise[] = []
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
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
          ? `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}${mediaDoc.url}`
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
