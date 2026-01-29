import type { JobTask } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { nanoid } from 'nanoid'
import {
  PDF_MAX_BYTES,
  MAX_SEGMENT_PAGES,
  MAX_EXERCISES_PER_SEGMENT,
} from '@/server/config/constants'
import { getPdfBufferFromBlob } from '@/server/services/pdf-fetcher'
import { computeContentHash } from '@/server/utils/hash'

// v2.1: Use EXISTING LLM infrastructure
import { mapMultimodalToGemini } from '@/infra/llm/providers/gemini/multimodal-mapper'
import { getGeminiClient } from '@/server/llm/gemini.client'
import type { MediaPartWithPath } from '@/infra/llm/multimodal/types'
import { toExerciseInput, toPayloadContent, enrichBlockIds, parseExtractorResponseText, parseVerifierResponseText } from '@/lib/exercise-conversion/helpers'
import { z } from 'zod'

export const pdfToExercisesTask: JobTask = {
  slug: 'pdf_to_exercises',
  input: {},
  output: {},

  async handler({ job, req }) {
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
      // PASS 0: Load and Validate PDF from Vercel Blob
      const pdfBuffer = await getPdfBufferFromBlob(sourceDocId, payload, req)

      if (pdfBuffer.length > PDF_MAX_BYTES) {
        throw { stage: 'PASS0_EXTRACT', code: 'PDF_TOO_LARGE', message: 'PDF too large' }
      }

      // Fetch media document to get URL for multimodal mapper
      const media = await payload.findByID({
        collection: 'media',
        id: sourceDocId,
        depth: 0,
        overrideAccess: true,
      })

      if (!media || !media.url) {
        throw { stage: 'PASS0_EXTRACT', code: 'MEDIA_NOT_FOUND', message: 'Media document has no URL' }
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

      return output
    } catch (error: any) {
      console.error(`[PDF→Exercises] Job ${job.id} failed:`, error)
      throw error
    }
  },
}

async function segmentPdf(pdfBuffer: Buffer, maxPagesPerSegment: number) {
  const pdfjs = await import('pdfjs-dist')
  // Use buffer data instead of file path
  const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise
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
 * v2.1: Updated to use existing infrastructure and retry-once-then-skip verification
 */
async function processSegmentWithMultimodal(
  payload: any,
  req: any,
  context: {
    geminiParts: { currentMessage: any[] } // v2.1: Output from mapMultimodalToGemini
    segment: { pageStart: number; pageEnd: number }
    extractorPrompt: string
    verifierPrompt: string
    output: any // v2.1: For tracking exercisesSkipped
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

  // v2.1: Use existing Gemini client infrastructure
  const geminiClient = await getGeminiClient(payload)
  const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-pro' })

  const extractorResult = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: extractorPromptWithContext },
        ...geminiParts.currentMessage,
      ],
    }],
  })

  const extractorResponse = extractorResult.response.text()
  const rawExtracted = parseExtractorResponseText(extractorResponse)

  // ========== Schema Validation for Extractor Output ==========
  const extracted = validateExtractedExercises(rawExtracted, segment)

  // ========== v2.1: Enrich with block IDs if missing ==========
  const enrichedExercises = extracted.map(exercise => enrichBlockIds(exercise))

  // ========== v2.1: Call Verifier with RETRY-ONCE-THEN-SKIP logic ==========
  const validExercises: any[] = []

  for (const exercise of enrichedExercises) {
    const verifierPromptWithContext = `${verifierPrompt}

Exercise to verify:
${JSON.stringify(exercise, null, 2)}

Source PDF pages: ${segment.pageStart}-${segment.pageEnd}

Return JSON: { "valid": boolean, "reason": "..." }`

    // First verification attempt
    let verification = await callVerifier(model, geminiParts, verifierPromptWithContext)

    // v2.1: Retry once if verification fails
    if (!verification.valid) {
      console.log(`[PDF→Exercises] Verification failed for "${exercise.title}", retrying...`)
      verification = await callVerifier(model, geminiParts, verifierPromptWithContext)
    }

    // v2.1: Skip invalid exercises instead of failing the job
    if (!verification.valid) {
      console.warn(`[PDF→Exercises] Skipping exercise "${exercise.title}" after retry: ${verification.reason}`)
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
 * v2.1: Helper to call verifier (extracted for retry logic)
 */
async function callVerifier(
  model: any,
  geminiParts: { currentMessage: any[] },
  prompt: string,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          ...geminiParts.currentMessage,
        ],
      }],
    })
    return parseVerifierResponseText(result.response.text())
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
