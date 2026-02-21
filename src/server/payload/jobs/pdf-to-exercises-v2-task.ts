/**
 * V2 PDF to Exercises Task Handler
 *
 * Orchestrates the V2 strip-based pipeline:
 * 1. Fetch PDF from Vercel Blob, render all pages
 * 2. Detect exercise start positions per page via text extraction
 * 3. Split pages into strips, stitch cross-page exercises
 * 4. Upload strip images as Media, create Exercise documents
 *
 * @fileType job-task
 * @domain conversion
 * @pattern job-handler, pipeline-orchestration
 */

import { PDF_MAX_BYTES, TASK_SLUGS } from '@/server/config/constants'
import { getPdfBufferFromBlob } from '@/server/services/pdf-fetcher'
import config from '@payload-config'
import { ObjectId } from 'mongodb'
import { getPayload } from 'payload'
import { nanoid } from 'nanoid'

import { loadAndRenderAllPages } from '@/server/services/exercise-conversion/v2/pdf-render-service'
import type { PageDetectionResult } from '@/server/services/exercise-conversion/v2/vision-detection-service'
import { detectExerciseStartsFromOCR } from '@/server/services/exercise-conversion/v2/ocr-detection-service'
import {
  detectExerciseStartsFromText,
  extractAllPagesTextLines,
} from '@/server/services/exercise-conversion/v2/text-detection-service'
import { detectExercisesVisionCombo } from '@/server/services/exercise-conversion/v2/vision-text-combo-service'
import {
  extractStrip,
  stitchVertical,
} from '@/server/services/exercise-conversion/v2/image-strip-service'
import type { PageImage } from '@/server/services/exercise-conversion/v2/pdf-render-service'
import type { PdfToExercisesV2Output } from '@/server/payload/jobs/types'

interface V2JobInput {
  ctx: {
    lessonId: string
    sourceDocId: string
    tenantId: string
    pipelineVersion: number
    conversionMode: string
  }
}

interface HandlerParams {
  job: { input: V2JobInput; id: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: { payload?: any }
}

/**
 * An exercise strip ready for upload. May span one or two pages.
 */
interface ExerciseStrip {
  label: string
  imageBuffer: Buffer
  sourcePageIndex: number
}

export const pdfToExercisesV2Task = {
  slug: TASK_SLUGS.PDF_TO_EXERCISES_V2,
  input: {},
  output: {},

  async handler({ job, req }: HandlerParams) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = req.payload ?? (await getPayload({ config }))
    const input = job.input as V2JobInput
    const { lessonId, sourceDocId, tenantId } = input.ctx

    const output: PdfToExercisesV2Output = {
      pagesTotal: 0,
      pagesProcessed: 0,
      exercisesCreated: 0,
      errors: [],
      warnings: [],
    }

    try {
      // Validate source media
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

      // PASS 0: Load PDF, render all pages, get page proxies for text extraction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfBuffer = await getPdfBufferFromBlob(sourceDocId, payload, req as any)

      if (pdfBuffer.length > PDF_MAX_BYTES) {
        throw { stage: 'PASS0_EXTRACT', code: 'PDF_TOO_LARGE', message: 'PDF too large' }
      }

      console.log('[V2] Loading and rendering all pages...')
      const pageDataList = await loadAndRenderAllPages(pdfBuffer)
      output.pagesTotal = pageDataList.length
      console.log(`[V2] Rendered ${pageDataList.length} pages`)

      // Extract text lines from all pages (needed for header/footer detection + text-based detection)
      const pdfPages = pageDataList.map((pd) => pd.pdfPage)
      const allPagesTextLines = await extractAllPagesTextLines(pdfPages)

      // PASS 1: Detect exercise start positions per page
      // Hybrid: try text extraction first, fall back to vision for scanned pages
      const detections: PageDetectionResult[] = []

      for (let i = 0; i < pageDataList.length; i++) {
        try {
          // Try text-based detection first
          const textDetection = await detectExerciseStartsFromText(
            pageDataList[i].pdfPage,
            i,
            allPagesTextLines,
          )

          const pageHasText = allPagesTextLines[i] && allPagesTextLines[i].length > 0
          const textFoundExercises = textDetection.exercises.length > 0

          if (textFoundExercises) {
            // Text detection found exercises — use it (deterministic, reliable)
            console.log(
              `[V2] Page ${i + 1}/${pageDataList.length} [TEXT]: ${textDetection.exercises.length} exercise(s), continues=${textDetection.continuesFromPrevious}`,
            )
            detections.push(textDetection)
          } else if (!pageHasText) {
            // Scanned page — fall back to OCR (Tesseract)
            console.log(
              `[V2] Page ${i + 1}/${pageDataList.length}: no text found, using OCR detection`,
            )
            const ocrDetection = await detectExerciseStartsFromOCR(
              pageDataList[i].image.buffer,
              i,
              pageDataList[i].image.width,
              pageDataList[i].image.height,
            )
            console.log(
              `[V2] Page ${i + 1}/${pageDataList.length} [OCR]: ${ocrDetection.exercises.length} exercise(s), continues=${ocrDetection.continuesFromPrevious}`,
            )
            detections.push(ocrDetection)
          } else {
            // Has text but regex didn't match — use Vision LLM + snap to text lines
            console.log(
              `[V2] Page ${i + 1}/${pageDataList.length} [TEXT]: text found but no pattern match, trying Vision+Snap combo`,
            )
            const comboDetection = await detectExercisesVisionCombo(
              pageDataList[i].image.buffer,
              i,
              allPagesTextLines[i],
              allPagesTextLines,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              payload as any,
            )
            console.log(
              `[V2] Page ${i + 1}/${pageDataList.length} [COMBO]: ${comboDetection.exercises.length} exercise(s), continues=${comboDetection.continuesFromPrevious}`,
            )
            detections.push(comboDetection)
          }

          output.pagesProcessed++
        } catch (pageError: unknown) {
          const pageErrorMessage =
            pageError instanceof Error ? pageError.message : 'Detection failed'
          console.error(`[V2] Failed to detect on page ${i}:`, pageErrorMessage)
          detections.push({
            contentStartY: 0,
            contentEndY: 1,
            continuesFromPrevious: false,
            exercises: [],
          })
          output.errors.push({
            pageIndex: i,
            reason: pageErrorMessage,
          })
        }
      }

      // PASS 2: Build exercise strips from detections
      const pages = pageDataList.map((pd) => pd.image)
      const strips = await buildExerciseStrips(pages, detections)
      console.log(`[V2] Built ${strips.length} exercise strips`)

      // PASS 3: Upload images and create exercises
      for (let i = 0; i < strips.length; i++) {
        const strip = strips[i]
        try {
          const uniqueSuffix = nanoid(6)
          const filename = `exercise-${strip.label}-p${strip.sourcePageIndex + 1}-${uniqueSuffix}.png`
          const mediaDoc = await payload.create({
            collection: 'media',
            data: {
              tenant: tenantId,
              type: 'image',
              alt: `Exercise ${strip.label} crop`,
              filename,
            },
            file: {
              data: strip.imageBuffer,
              mimetype: 'image/png',
              name: filename,
              size: strip.imageBuffer.length,
            },
            overrideAccess: true,
            draft: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            req: req as any,
          })

          const title = `Exercise ${strip.label}`

          await payload.create({
            collection: 'exercises',
            data: {
              title,
              lesson: lessonId,
              tenant: tenantId,
              origin: 'conversion',
              sourceDoc: sourceDocId,
              conversionJobId: job.id,
              sourcePageIndex: strip.sourcePageIndex,
              pipelineVersion: 2,
              content: {
                blocks: [
                  {
                    id: nanoid(),
                    type: 'rich_text',
                    format: 'md-math-v1',
                    value: '',
                    mediaIds: [mediaDoc.id],
                  },
                ],
              },
            },
            overrideAccess: true,
            draft: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            req: req as any,
          })

          output.exercisesCreated++
        } catch (uploadError: unknown) {
          const uploadErrorMessage =
            uploadError instanceof Error ? uploadError.message : 'Upload/create failed'
          console.warn(`[V2] Failed to create exercise ${strip.label}:`, uploadErrorMessage)
          output.errors.push({
            pageIndex: strip.sourcePageIndex,
            reason: uploadErrorMessage,
          })
        }
      }

      if (output.exercisesCreated === 0) {
        if (output.errors.length > 0) {
          output.warnings.push(
            `All ${output.errors.length} page(s) failed. See errors for details.`,
          )
        } else {
          output.warnings.push('No exercises detected across all pages.')
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateJobStatus(payload as any, job.id, 'completed', output)
      return output
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[V2] Job ${job.id} failed:`, error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateJobStatus(payload as any, job.id, 'failed', {
        ...output,
        error: errorMessage,
      })
      throw error
    }
  },
}

/**
 * Padding applied to strip boundaries to compensate for vision LLM Y-position inaccuracy.
 * - Top padding: moved UP to avoid cutting the first line of an exercise
 * - Bottom padding: moved UP to avoid including the start of the next exercise
 * Values are in normalized 0-1 coordinates (~2% of page height).
 */
const STRIP_TOP_PADDING = 0.02
const STRIP_BOTTOM_PADDING = 0.01

/**
 * Build exercise strips from page images and detection results.
 *
 * For each exercise:
 * - Strip = from its startY to the next exercise's startY (or contentEndY if last on page)
 * - Top is padded upward to capture the exercise label/first line
 * - Bottom is padded upward to avoid including the next exercise's label
 * - Cross-page: if an exercise is last on a page and the next page has
 *   continuesFromPrevious=true, stitch the bottom strip with the next page's
 *   top portion (up to the first exercise on that page, or contentEndY).
 */
async function buildExerciseStrips(
  pages: PageImage[],
  detections: PageDetectionResult[],
): Promise<ExerciseStrip[]> {
  const strips: ExerciseStrip[] = []

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx]
    const det = detections[pageIdx]

    // If page continues from previous and has no new exercises,
    // the entire content region belongs to the previous exercise (handled via stitching)
    if (det.exercises.length === 0) continue

    for (let exIdx = 0; exIdx < det.exercises.length; exIdx++) {
      const exercise = det.exercises[exIdx]
      const isLast = exIdx === det.exercises.length - 1

      // Strip top: exercise startY with upward padding, but not above contentStartY
      const stripTop = Math.max(exercise.startY - STRIP_TOP_PADDING, det.contentStartY)

      // Strip bottom: next exercise's startY (with upward padding to exclude its label),
      // or contentEndY if last on page
      const rawBottom = isLast ? det.contentEndY : det.exercises[exIdx + 1].startY
      const stripBottom = isLast
        ? rawBottom
        : Math.max(stripTop + 0.01, rawBottom - STRIP_BOTTOM_PADDING)

      let imageBuffer = await extractStrip(page, stripTop, stripBottom)

      // Cross-page stitching: if this is the last exercise on this page
      // and the next page continues from previous
      if (isLast && pageIdx + 1 < pages.length) {
        const nextDet = detections[pageIdx + 1]
        if (nextDet.continuesFromPrevious) {
          // Continuation region on next page:
          // from contentStartY to first exercise's startY (or contentEndY if no exercises)
          const nextPage = pages[pageIdx + 1]
          const rawContinuationEnd =
            nextDet.exercises.length > 0 ? nextDet.exercises[0].startY : nextDet.contentEndY
          const continuationEnd =
            nextDet.exercises.length > 0
              ? Math.max(nextDet.contentStartY + 0.01, rawContinuationEnd - STRIP_BOTTOM_PADDING)
              : rawContinuationEnd

          const continuationStrip = await extractStrip(
            nextPage,
            nextDet.contentStartY,
            continuationEnd,
          )

          imageBuffer = await stitchVertical(imageBuffer, continuationStrip, page.width)
        }
      }

      strips.push({
        label: exercise.label || String(strips.length + 1),
        imageBuffer,
        sourcePageIndex: pageIdx,
      })
    }
  }

  return strips
}

/**
 * Update job status in MongoDB
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateJobStatus(
  payload: any,
  jobId: string,
  status: 'completed' | 'failed',
  output?: unknown,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = payload.db as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coll = db?.connection?.collection?.('payload-jobs') as any
  if (!coll) {
    console.warn('[V2] Cannot update job status - jobs collection not accessible')
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
    console.error(`[V2] Failed to update job status:`, err)
  }
}
