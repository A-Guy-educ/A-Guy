/**
 * Lesson Context Extraction Service
 *
 * Extracts context text from lesson content files (PDF/images) using AI prompts.
 * The extracted text is stored in the ContextExtractions collection.
 *
 * PDFs are processed page-by-page: each page is split into a single-page PDF,
 * sent to the LLM independently, validated, then stitched into one LaTeX document.
 *
 * All Payload Local API calls use overrideAccess: false + user context for security.
 */
import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import { fetchBuffer } from '@/infra/utils/http'
import type { ContextExtraction, Lesson, Media, Prompt } from '@/payload-types'
import { getPdfBufferFromBlob, normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'
import { splitPdfIntoPages } from '@/server/utils/pdf-page-splitter'
import { validateExtractedLatex } from './validate-latex'
import {
  extractStructuredExercisesFromPage,
  mergeExercisesAcrossPages,
  renderExercisesAsLatexText,
  type ExtractPageResult,
} from './structured-extraction'
import type { ExtractedExercise } from './structured-extraction-schema'
import type { Payload, User } from 'payload'

// Controlled concurrency for page-by-page PDF processing
const PAGE_CONCURRENCY = 3

// Warning threshold for combined LaTeX size
const LATEX_SIZE_WARNING_THRESHOLD = 160000

export interface ExtractContextInput {
  lessonId: string
  promptId: string
  mediaId: string
  mode?: 'replace' | 'append'
}

export interface ExtractContextResult {
  success: boolean
  updatedContextText?: string
  extractedChunkLength?: number
  exercisesExtracted?: number
  error?: string
  warnings?: string[]
}

/**
 * Extract context text from a lesson content file and store in ContextExtractions.
 *
 * For PDFs: splits into individual pages, processes each page independently,
 * validates LaTeX output, then stitches results into one document.
 * For images: single LLM call with the full image.
 *
 * @param payload - Payload instance
 * @param user - Authenticated user for access control
 * @param input - Extraction parameters
 * @returns Result with updated context text or error message
 */
export async function extractLessonContext(
  payload: Payload,
  user: User,
  input: ExtractContextInput,
): Promise<ExtractContextResult> {
  const { lessonId, promptId, mediaId, mode = 'replace' } = input
  const warnings: string[] = []

  try {
    // ========== Step 1: Fetch lesson and validate tenant ==========
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 1,
      user,
      overrideAccess: false,
    })

    if (!lesson) {
      return { success: false, error: 'Lesson not found' }
    }

    const lessonTyped = lesson as unknown as Lesson
    const lessonTenant =
      typeof lessonTyped.tenant === 'object' ? lessonTyped.tenant?.id : lessonTyped.tenant

    if (!lessonTenant) {
      return { success: false, error: 'Lesson has no tenant' }
    }

    // ========== Step 2: Validate mediaId is in lesson's contentFiles ==========
    const contentFiles = lessonTyped.contentFiles || []
    const contentFileIds = contentFiles.map((cf) =>
      typeof cf === 'string' ? cf : (cf as unknown as { id: string }).id,
    )

    if (!contentFileIds.includes(mediaId)) {
      return { success: false, error: 'Media file is not attached to this lesson' }
    }

    // ========== Step 3: Fetch prompt and validate ==========
    const prompt = await payload.findByID({
      collection: 'prompts',
      id: promptId,
      depth: 0,
      user,
      overrideAccess: false,
    })

    if (!prompt) {
      return { success: false, error: 'Prompt not found' }
    }

    const promptTyped = prompt as unknown as Prompt

    if (promptTyped.usage !== 'context_extractor') {
      return { success: false, error: 'Prompt is not a context_extractor' }
    }

    if (promptTyped.status !== 'published') {
      return { success: false, error: 'Prompt is not published' }
    }

    const promptTenant =
      typeof promptTyped.tenant === 'object' ? promptTyped.tenant?.id : promptTyped.tenant

    if (promptTenant !== lessonTenant) {
      return { success: false, error: 'Prompt tenant does not match lesson tenant' }
    }

    if (!promptTyped.template) {
      return { success: false, error: 'Prompt template is empty' }
    }

    // ========== Step 4: Fetch media file ==========
    const media = await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      user,
      overrideAccess: false,
    })

    if (!media) {
      return { success: false, error: 'Media file not found' }
    }

    const mediaTyped = media as unknown as Media

    if (!mediaTyped.url) {
      return { success: false, error: 'Media file has no URL' }
    }

    // Determine if PDF or image and fetch buffer
    const isPdf = mediaTyped.mimeType === 'application/pdf'
    let fileBuffer: Buffer

    if (isPdf) {
      fileBuffer = await getPdfBufferFromBlob(mediaId, payload)
    } else {
      let fetchUrl = mediaTyped.url

      if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
        fetchUrl = await normalizeToAbsoluteUrl(fetchUrl)
      }

      if (isVercelBlobUrl(fetchUrl)) {
        const { getPdfBufferFromUrl } = await import('@/infra/blob/vercel-blob-adapter')
        fileBuffer = await getPdfBufferFromUrl(fetchUrl)
      } else {
        fileBuffer = await fetchBuffer(fetchUrl, 30000)
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return { success: false, error: 'Failed to download media file' }
    }

    // ========== Step 5: Build prompt with lesson metadata ==========
    const lessonTitle = lessonTyped.title || 'Untitled Lesson'
    const lessonDescription = lessonTyped.description || ''
    const metadataText = `Lesson: ${lessonTitle}\nDescription: ${lessonDescription}`
    const fullPrompt = `${promptTyped.template}\n\n${metadataText}`

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server',
        warnings,
      }
    }

    // ========== Step 6: Schema-mode extraction per page ==========
    // Each page returns a structured { exercises: [...] } payload that we
    // merge across pages, then render to a parser-compatible LaTeX `text`
    // for the existing viewer. The structured array is what Stage 2 reads.
    let pageBuffers: Buffer[]
    if (isPdf) {
      pageBuffers = await splitPdfIntoPages(fileBuffer)
      warnings.push(`Processing ${pageBuffers.length} pages with concurrency ${PAGE_CONCURRENCY}`)
    } else {
      // Treat the entire image as a single "page" for the schema call.
      pageBuffers = [fileBuffer]
    }

    const totalPages = pageBuffers.length
    const pageResults: ExtractPageResult[] = []

    for (let i = 0; i < pageBuffers.length; i += PAGE_CONCURRENCY) {
      const batch = pageBuffers.slice(i, i + PAGE_CONCURRENCY)
      const settled = await Promise.allSettled(
        batch.map((buf, j) =>
          extractStructuredExercisesFromPage({
            apiKey,
            promptTemplate: fullPrompt,
            pageBuffer: buf,
            pageIndex: i + j,
          }),
        ),
      )

      for (let j = 0; j < settled.length; j++) {
        const pageIndex = i + j
        const result = settled[j]
        if (result.status === 'fulfilled') {
          pageResults.push(result.value)
          warnings.push(
            `Page ${pageIndex + 1}/${totalPages}: extracted ${result.value.exercises.length} exercise(s)${result.value.warning ? ' — ' + result.value.warning : ''}`,
          )
        } else {
          const errorMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error'
          warnings.push(
            `Page ${pageIndex + 1}/${totalPages}: extraction failed — ${errorMsg}. Skipped.`,
          )
          pageResults.push({ pageIndex, exercises: [] })
        }
      }
    }

    const successfulPages = pageResults.filter((p) => p.exercises.length > 0).length
    if (successfulPages === 0 && totalPages > 0) {
      return {
        success: false,
        error: 'No exercises extracted from any page',
        warnings,
      }
    }

    const mergedExercises: ExtractedExercise[] = mergeExercisesAcrossPages(pageResults)
    warnings.push(`Merged ${mergedExercises.length} exercise(s) across ${totalPages} page(s).`)

    // Render structured exercises into a parser-compatible LaTeX text view
    // so the existing ContextExerciseViewer keeps working unchanged. Run it
    // through the same sanitizer/validator we've always used.
    const renderedText = renderExercisesAsLatexText(mergedExercises)
    const validation = validateExtractedLatex(renderedText || ' ')
    warnings.push(...validation.warnings)
    let extractedText = validation.sanitizedText

    if (extractedText.length > LATEX_SIZE_WARNING_THRESHOLD) {
      warnings.push(
        `Combined LaTeX is ${extractedText.length} chars (threshold: ${LATEX_SIZE_WARNING_THRESHOLD}). May approach size limit.`,
      )
    }

    // ========== Step 8: Build final text based on mode ==========
    let updatedContextText: string
    if (mode === 'append') {
      // Fetch existing extraction for this lesson+media (if any) to append to
      const existing = await payload.find({
        collection: 'context-extractions',
        where: {
          lesson: { equals: lessonId },
          sourceMedia: { equals: mediaId },
        },
        sort: '-updatedAt',
        limit: 1,
        depth: 0,
      })
      const existingText =
        existing.docs.length > 0 ? (existing.docs[0] as unknown as { text: string }).text : ''
      const delimiter = '\n\n---\n\n'
      updatedContextText = existingText
        ? `${existingText}${delimiter}${extractedText}`
        : extractedText
    } else {
      updatedContextText = extractedText
    }

    // ========== Step 9: Upsert context extraction ==========
    const existingExtraction = await payload.find({
      collection: 'context-extractions',
      where: {
        lesson: { equals: lessonId },
        sourceMedia: { equals: mediaId },
      },
      limit: 1,
      depth: 0,
    })

    // Persist both the structured exercises array AND the rendered text view.
    // Stage 2 prefers `exercises` when present; the viewer reads `text` and
    // remains backward compatible.
    const extractionUpdate: Pick<ContextExtraction, 'text' | 'exercises'> = {
      text: updatedContextText,
      exercises: mergedExercises,
    }

    if (existingExtraction.docs.length > 0) {
      await payload.update({
        collection: 'context-extractions',
        id: existingExtraction.docs[0].id,
        data: extractionUpdate,
        user,
        overrideAccess: false,
      })
    } else {
      await payload.create({
        collection: 'context-extractions',
        data: {
          lesson: lessonId,
          sourceMedia: mediaId,
          ...extractionUpdate,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user: user as any,
        overrideAccess: false,
      })
    }

    return {
      success: true,
      updatedContextText,
      extractedChunkLength: extractedText.length,
      exercisesExtracted: mergedExercises.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error('[extractLessonContext] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        success: false,
        error: 'The extraction timed out. The PDF may be too large — try a shorter document.',
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return {
        success: false,
        error: 'AI service rate limit reached. Please wait a minute and try again.',
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    if (errorMessage.includes('too large') || errorMessage.includes('payload')) {
      return {
        success: false,
        error:
          'The PDF is too large for processing. Try splitting it into smaller parts (under 10 pages).',
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    return {
      success: false,
      error: errorMessage,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }
}
