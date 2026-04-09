/**
 * Lesson Context Extraction Service
 *
 * Extracts context text from lesson content files (PDF/images) using AI prompts.
 * The extracted text is stored in the lesson's lessonContextText field.
 *
 * PDFs are processed page-by-page with controlled concurrency (3 pages at a time)
 * for better extraction quality and to avoid truncation on longer documents.
 *
 * All Payload Local API calls use overrideAccess: false + user context for security.
 */
import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import { fetchBuffer } from '@/infra/utils/http'
import type { Lesson, Media, Prompt } from '@/payload-types'
import type { UnifiedLLMProvider } from '@/infra/llm/providers/factory'
import type { AIModel } from '@/infra/llm/models'
import { getPdfBufferFromBlob, normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'
import { splitPdfIntoPages } from '@/server/utils/pdf-page-splitter'
import type { Payload, User } from 'payload'

// Controlled concurrency for page-by-page PDF processing
const PAGE_CONCURRENCY = 3

// Warning threshold for combined LaTeX size
const LATEX_SIZE_WARNING_THRESHOLD = 80000

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
  error?: string
  warnings?: string[]
}

/**
 * Extract context text from a lesson content file and store in lessonContextText.
 *
 * Sends the entire file to the LLM in a single call, validates the LaTeX output,
 * and stores the result. Supports replace (default) and append modes.
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
  const { lessonId, promptId, mediaId, mode = 'append' } = input
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

    // ========== Step 5: Check PDF page count and warn if large ==========
    const warnings: string[] = []

    if (isPdf) {
      try {
        const pageCount = await getPageCount(fileBuffer)
        if (pageCount > PDF_PAGE_WARNING_THRESHOLD) {
          warnings.push(
            `This PDF has ${pageCount} pages. Extraction works best with up to ~${PDF_PAGE_WARNING_THRESHOLD} pages. Some content at the end may be missing — check the result and re-run if needed.`,
          )
        }
      } catch {
        // Page count is informational — don't fail if we can't read it
      }
    }

    // ========== Step 6: Build prompt with lesson metadata ==========
    const lessonTitle = lessonTyped.title || 'Untitled Lesson'
    const lessonDescription = lessonTyped.description || ''
    const metadataText = `Lesson: ${lessonTitle}\nDescription: ${lessonDescription}`
    const fullPrompt = `${promptTyped.template}\n\n${metadataText}`

    // ========== Step 7: Call LLM via adapter ==========
    const { createGenkitUnifiedAdapter } =
      await import('@/infra/llm/genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)

    const { getModelRegistryEntry, getProviderModelName } = await import('@/infra/llm/models')
    const { LLMProviderType } = await import('@/infra/llm/providers/types')
    const modelEntry = getModelRegistryEntry('PDF_TO_EXERCISE')
    const modelConfig = {
      name: getProviderModelName(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE'),
      ...modelEntry,
      modelKey: 'PDF_TO_EXERCISE' as const,
    }

    // ========== Process based on media type ==========
    let extractedText: string

    if (isPdf) {
      // ========== PDF: Process page-by-page with controlled concurrency ==========
      const pages = await splitPdfIntoPages(fileBuffer)
      const totalPages = pages.length

      warnings.push(`Processing ${totalPages} pages with concurrency ${PAGE_CONCURRENCY}`)

      // Process pages in batches
      const results: Array<{ pageIndex: number; latex: string | null; warning?: string }> = []

      for (let i = 0; i < pages.length; i += PAGE_CONCURRENCY) {
        const batch = pages.slice(i, i + PAGE_CONCURRENCY)
        const batchResults = await Promise.allSettled(
          batch.map((pageBuffer, _batchIdx) =>
            extractSinglePage(adapter, modelConfig, fullPrompt, pageBuffer, payload),
          ),
        )

        // Collect results
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j]
          const pageIndex = i + j

          if (result.status === 'fulfilled') {
            results.push({ pageIndex, latex: result.value.latex, warning: result.value.warning })
          } else {
            const errorMsg =
              result.reason instanceof Error ? result.reason.message : 'Unknown error'
            warnings.push(
              `Page ${pageIndex + 1}/${totalPages}: extraction failed — ${errorMsg}. Skipped.`,
            )
            results.push({ pageIndex, latex: null })
          }
        }
      }

      // Sort by page index to ensure correct order
      results.sort((a, b) => a.pageIndex - b.pageIndex)

      // Check if all pages failed
      const successfulResults = results.filter((r) => r.latex !== null)
      if (successfulResults.length === 0) {
        return {
          success: false,
          error: 'All pages failed extraction',
          warnings,
        }
      }

      // Report skipped pages
      const skippedCount = results.filter((r) => r.latex === null).length
      if (skippedCount > 0) {
        warnings.push(
          `Successfully extracted ${successfulResults.length}/${totalPages} pages. ${skippedCount} pages skipped.`,
        )
      } else {
        warnings.push(`Successfully extracted all ${totalPages} pages.`)
      }

      // Stitch results together
      extractedText = stitchLatexPages(successfulResults.map((r) => r.latex!))

      // Add size warning if needed
      if (extractedText.length > LATEX_SIZE_WARNING_THRESHOLD) {
        warnings.push(
          `Warning: Extracted LaTeX (${extractedText.length} chars) exceeds ${LATEX_SIZE_WARNING_THRESHOLD} char threshold. Consider splitting into multiple lessons.`,
        )
      }

      // Add per-page success messages
      for (const r of results) {
        if (r.latex !== null) {
          warnings.push(
            `Page ${r.pageIndex + 1}/${totalPages}: extracted successfully (${r.latex.length} chars)`,
          )
        }
        if (r.warning) {
          warnings.push(`Page ${r.pageIndex + 1}/${totalPages}: ${r.warning}`)
        }
      }
    } else {
      // ========== Non-PDF (image): Single call, existing behavior ==========
      const mimeType = mediaTyped.mimeType || 'image/png'
      const base64Data = fileBuffer.toString('base64')

      const response = await adapter.generateMultimodalCompletion(
        {
          prompt: fullPrompt,
          model: modelConfig,
          attachments: [
            {
              data: base64Data,
              mimeType,
            },
          ],
        },
        payload,
      )

      // Validate non-empty response
      extractedText = response.text?.trim()

      if (!extractedText) {
        return { success: false, error: 'AI returned empty response', warnings }
      }
    }

    // ========== Step 7: Update lessonContextText based on mode ==========
    let updatedContextText: string
    if (mode === 'append') {
      const existingContext = lessonTyped.lessonContextText || ''
      const delimiter = '\n\n---\n\n'
      updatedContextText = existingContext
        ? `${existingContext}${delimiter}${extractedText}`
        : extractedText
    } else {
      // replace mode
      updatedContextText = extractedText
    }

    // ========== Step 8: Update lesson ==========
    await payload.update({
      collection: 'lessons',
      id: lessonId,
      data: {
        lessonContextText: updatedContextText,
      },
      user,
      overrideAccess: false,
    })

    return {
      success: true,
      updatedContextText,
      extractedChunkLength: extractedText.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error('[extractLessonContext] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Provide user-friendly messages for common failures
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        success: false,
        error: 'The extraction timed out. The PDF may be too large — try a shorter document.',
      }
    }

    if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return {
        success: false,
        error: 'AI service rate limit reached. Please wait a minute and try again.',
      }
    }

    if (errorMessage.includes('too large') || errorMessage.includes('payload')) {
      return {
        success: false,
        error:
          'The PDF is too large for processing. Try splitting it into smaller parts (under 10 pages).',
      }
    }

    return { success: false, error: errorMessage }
  }
}

/**
 * Extract LaTeX content from a single PDF page.
 */
async function extractSinglePage(
  adapter: UnifiedLLMProvider,
  modelConfig: AIModel,
  prompt: string,
  pageBuffer: Buffer,
  payload: Payload,
): Promise<{ latex: string; warning?: string }> {
  const base64Data = pageBuffer.toString('base64')

  const response = await adapter.generateMultimodalCompletion(
    {
      prompt,
      model: modelConfig,
      attachments: [
        {
          data: base64Data,
          mimeType: 'application/pdf',
        },
      ],
    },
    payload,
  )

  const extractedText = response.text?.trim()

  if (!extractedText) {
    throw new Error('AI returned empty response')
  }

  // LaTeX validation - check for balanced braces (ignoring escaped braces like \{ \})
  let braceBalance = 0
  for (let i = 0; i < extractedText.length; i++) {
    if (extractedText[i] === '\\') {
      i++ // skip escaped character
      continue
    }
    if (extractedText[i] === '{') braceBalance++
    if (extractedText[i] === '}') braceBalance--
  }

  if (braceBalance !== 0) {
    const warning =
      braceBalance > 0
        ? `LaTeX validation warning — ${braceBalance} unclosed {`
        : `LaTeX validation warning — ${Math.abs(braceBalance)} extra }`
    // Still return the text, but include a warning
    return { latex: extractedText, warning }
  }

  return { latex: extractedText }
}

/**
 * Stitch multiple LaTeX page results into a single valid LaTeX document.
 *
 * - Keeps the preamble (\documentclass through \begin{document}) from the first page only
 * - Extracts content from BETWEEN \begin{document} and \end{document} for all pages
 * - Joins content in page order
 * - Ensures one \end{document} at the end
 */
function stitchLatexPages(pages: string[]): string {
  if (pages.length === 0) return ''
  if (pages.length === 1) return pages[0]

  /**
   * Extract content between \begin{document} and \end{document}.
   * Returns the content INSIDE the document environment, or the whole page if no environment found.
   */
  function extractContent(page: string): string {
    const beginDoc = page.indexOf('\\begin{document}')
    const endDoc = page.indexOf('\\end{document}')

    if (beginDoc !== -1 && endDoc !== -1 && beginDoc < endDoc) {
      // Extract content between \begin{document} and \end{document}
      return page.slice(beginDoc + '\\begin{document}'.length, endDoc).trim()
    }

    // Fallback: return the whole page (no standard preamble found)
    return page.trim()
  }

  /**
   * Extract the preamble (everything up to and including \begin{document}).
   */
  function extractPreamble(page: string): string {
    const beginDoc = page.indexOf('\\begin{document}')

    if (beginDoc !== -1) {
      return page.slice(0, beginDoc + '\\begin{document}'.length)
    }

    return ''
  }

  const preamble = extractPreamble(pages[0])
  const allContent = pages
    .map(extractContent)
    .filter((c) => c.length > 0)
    .join('\n\n')

  if (preamble) {
    return `${preamble}\n\n${allContent}\n\n\\end{document}`
  }

  // No preamble found - just join content
  return allContent
}
