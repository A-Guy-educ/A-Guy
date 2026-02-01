import {
  MAX_EXERCISES_PER_SEGMENT,
  MAX_SEGMENT_PAGES,
  PDF_MAX_BYTES,
} from '@/server/config/constants'
import { getPdfBufferFromBlob } from '@/server/services/pdf-fetcher'
import { computeContentHash } from '@/server/utils/hash'
import config from '@payload-config'
// JobTask type is not exported from payload, define inline
import { ObjectId } from 'mongodb'
import { getPayload } from 'payload'

import { AI_MODELS } from '@/infra/llm/models'
import type { MediaPartWithPath } from '@/infra/llm/multimodal/types'
import { generateMultimodalCompletion } from '@/infra/llm/providers/gemini'
import { mapMultimodalToGemini } from '@/infra/llm/providers/gemini/multimodal-mapper'
import { getPdfWorkerUrl } from '@/infra/pdfjs/config'
import {
  enrichBlockIds,
  parseExtractorResponseText,
  parseVerifierResponseText,
  toExerciseInput,
  toPayloadContent,
} from '@/server/services/exercise-conversion/helpers'
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
      const segments = await segmentPdf(pdfBuffer, MAX_SEGMENT_PAGES)
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

      // Convert PDF to Gemini parts using existing multimodal mapper
      const geminiParts = await mapMultimodalToGemini([mediaPartWithPath], payload, req)

      // PASS 2: Extract + Verify + Persist
      for (let i = 0; i < segments.length; i++) {
        output.currentSegmentIndex = i
        const segment = segments[i]

        try {
          const exercises = await processSegmentWithMultimodal(payload, req, {
            geminiParts, // v2.1: Use existing infrastructure output
            segment,
            extractorPrompt: input.promptSnapshot.extractor,
            verifierPrompt: input.promptSnapshot.verifier,
            output, // v2.1: Pass output for exercisesSkipped tracking
          })

          let created = 0
          let deduped = 0

          for (const exercise of exercises) {
            // Apply canonical shape adapter for hashing
            const exerciseInput = toExerciseInput(exercise)
            const contentHash = computeContentHash(exerciseInput)

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
            })

            if (existing.docs.length > 0) {
              deduped++
            } else {
              // Apply canonical shape adapter for persistence
              const payloadContent = toPayloadContent(exercise)
              await payload.create({
                collection: 'exercises',
                data: {
                  title: exercise.title,
                  content: payloadContent, // Match Exercise.content JSON schema
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
                req,
              })
              created++
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

async function segmentPdf(pdfBuffer: Buffer, maxPagesPerSegment: number) {
  const pdfjs = await import('pdfjs-dist')

  // Configure worker URL from Vercel Blob CDN (fixes serverless environment issue)
  pdfjs.GlobalWorkerOptions.workerSrc = await getPdfWorkerUrl()

  // Use buffer data - cast to Uint8Array for pdfjs-dist compatibility
  const pdf = await pdfjs.getDocument({ data: Uint8Array.from(pdfBuffer) }).promise
  const pageCount = pdf.numPages

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
    geminiParts: { currentMessage: any[] } // Output from mapMultimodalToGemini
    segment: { pageStart: number; pageEnd: number }
    extractorPrompt: string
    verifierPrompt: string
    output: any // For tracking exercisesSkipped
  },
) {
  const { geminiParts, segment, extractorPrompt, verifierPrompt, output } = context

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

  // Use Gemini provider with AI_MODELS configuration
  const extractorResult = await generateMultimodalCompletion(
    {
      prompt: extractorPromptWithContext,
      model: AI_MODELS.PDF_TO_EXERCISE,
      attachments: geminiParts.currentMessage
        .filter((part: any) => part.inlineData)
        .map((part: any) => ({
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        })),
    },
    payload,
  )

  const rawExtracted = parseExtractorResponseText(extractorResult.text)

  // ========== Schema Validation for Extractor Output ==========
  const extracted = validateExtractedExercises(rawExtracted, segment)

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
    let verification = await callVerifier(payload, geminiParts, verifierPromptWithContext)

    // Retry once if verification fails
    if (!verification.valid) {
      verification = await callVerifier(payload, geminiParts, verifierPromptWithContext)
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
 * Helper to call verifier using Gemini provider
 */
async function callVerifier(
  payload: any,
  geminiParts: { currentMessage: any[] },
  prompt: string,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const result = await generateMultimodalCompletion(
      {
        prompt,
        model: AI_MODELS.PDF_TO_EXERCISE,
        attachments: geminiParts.currentMessage
          .filter((part: any) => part.inlineData)
          .map((part: any) => ({
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          })),
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

  // Enforce MAX_EXERCISES_PER_SEGMENT limit
  if (validated.length > MAX_EXERCISES_PER_SEGMENT) {
    console.warn(
      `[PDF→Exercises] Truncated exercises from ${validated.length} to ${MAX_EXERCISES_PER_SEGMENT}`,
    )
    validated.length = MAX_EXERCISES_PER_SEGMENT
  }

  return validated
}
