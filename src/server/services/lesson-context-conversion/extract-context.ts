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
import type { Lesson, Media, Prompt } from '@/payload-types'
import type { UnifiedLLMProvider } from '@/infra/llm/providers/factory'
import type { AIModel } from '@/infra/llm/models'
import { getPdfBufferFromBlob, normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'
import { splitPdfIntoPages } from '@/server/utils/pdf-page-splitter'
import { validateExtractedLatex } from './validate-latex'
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

    // ========== Step 6: Create LLM adapter and model config ==========
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

    // ========== Step 7: Process based on media type ==========
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
          batch.map((pageBuffer) =>
            extractSinglePage(adapter, modelConfig, fullPrompt, pageBuffer, payload),
          ),
        )

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j]
          const pageIndex = i + j

          if (result.status === 'fulfilled') {
            results.push({ pageIndex, latex: result.value.latex, warning: result.value.warning })
            warnings.push(
              `Page ${pageIndex + 1}/${totalPages}: extracted successfully (${result.value.latex.length} chars)`,
            )
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

      // Report summary
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
          `Combined LaTeX is ${extractedText.length} chars (threshold: ${LATEX_SIZE_WARNING_THRESHOLD}). May approach size limit.`,
        )
      }
    } else {
      // ========== Non-PDF (image): Single call, existing behavior ==========
      const mimeType = mediaTyped.mimeType || 'image/png'
      const base64Data = fileBuffer.toString('base64')

      const response = await adapter.generateMultimodalCompletion(
        {
          prompt: fullPrompt,
          model: modelConfig,
          attachments: [{ data: base64Data, mimeType }],
        },
        payload,
      )

      const responseText = response.text?.trim()
      if (!responseText) {
        return { success: false, error: 'AI returned empty response', warnings }
      }

      const validation = validateExtractedLatex(responseText)
      warnings.push(...validation.warnings)
      extractedText = validation.sanitizedText
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

    if (existingExtraction.docs.length > 0) {
      await payload.update({
        collection: 'context-extractions',
        id: existingExtraction.docs[0].id,
        data: { text: updatedContextText },
        user,
        overrideAccess: false,
      })
    } else {
      await payload.create({
        collection: 'context-extractions',
        data: {
          lesson: lessonId,
          sourceMedia: mediaId,
          text: updatedContextText,
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

/**
 * Extract LaTeX content from a single PDF page.
 * Uses validateExtractedLatex for full validation (braces, environments, fonts, sanitization).
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
      attachments: [{ data: base64Data, mimeType: 'application/pdf' }],
    },
    payload,
  )

  const extractedText = response.text?.trim()

  if (!extractedText) {
    throw new Error('AI returned empty response')
  }

  const validation = validateExtractedLatex(extractedText)
  const allWarnings = [...validation.warnings, ...validation.errors]
  const warning = allWarnings.length > 0 ? allWarnings.join('; ') : undefined

  return { latex: validation.sanitizedText, warning }
}

/**
 * Stitch multiple LaTeX page results into a single valid LaTeX document.
 *
 * Strategy:
 * 1. Take the preamble (\documentclass through \begin{document}) from page 1
 * 2. Extract content between \begin{document} and \end{document} from ALL pages
 * 3. Strip per-page artifacts: outline comments, page headers, \begin{hebrew}/\end{hebrew}
 * 4. Separate exercise content from solution content
 * 5. Combine: preamble + all exercises + all solutions + \end{document}
 */
function stitchLatexPages(pages: string[]): string {
  if (pages.length === 0) return ''
  if (pages.length === 1) return pages[0]

  const preamble = extractPreamble(pages[0])
  const allContent = pages.map(extractDocumentContent)

  // Separate exercises from solutions across all pages
  const exerciseParts: string[] = []
  const solutionParts: string[] = []

  for (const content of allContent) {
    const { exercises, solutions } = splitExercisesAndSolutions(content)
    if (exercises.trim()) exerciseParts.push(exercises.trim())
    if (solutions.trim()) solutionParts.push(solutions.trim())
  }

  // Build final document
  const parts: string[] = []

  if (exerciseParts.length > 0) {
    parts.push(exerciseParts.join('\n\n'))
  }

  if (solutionParts.length > 0) {
    parts.push('\\newpage\n\\section*{פתרונות}\n\n' + solutionParts.join('\n\n'))
  }

  const body = parts.join('\n\n')

  if (preamble) {
    return `${preamble}\n\n${body}\n\n\\end{document}`
  }

  return body
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

/**
 * Extract content between \begin{document} and \end{document},
 * then clean up per-page artifacts.
 */
function extractDocumentContent(page: string): string {
  let content = page

  // Extract between \begin{document} and \end{document} if present
  const beginDoc = content.indexOf('\\begin{document}')
  const endDoc = content.indexOf('\\end{document}')
  if (beginDoc !== -1 && endDoc !== -1 && beginDoc < endDoc) {
    content = content.slice(beginDoc + '\\begin{document}'.length, endDoc)
  }

  // Strip preamble fragments that might appear without \begin{document}
  content = content.replace(/\\documentclass[\s\S]*?(?=\\begin\{|\\section|\\noindent|$)/m, '')

  // Strip \begin{hebrew} and \end{hebrew} — we'll handle language wrapping at document level
  content = content.replace(/\\begin\{hebrew\}/g, '')
  content = content.replace(/\\end\{hebrew\}/g, '')

  // Strip outline comment blocks (% OUTLINE: ... through next non-comment line)
  content = content.replace(/^%\s*(?:OUTLINE|\\begin\{comment\})[\s\S]*?(?=\n[^%\n])/gm, '')
  // Strip individual % comment lines at the start
  content = content.replace(/^%[^\n]*\n/gm, '')

  // Strip repeated page headers like "מתמטיקה, חורף תשפ"ה, מס' 35471 + נספח"
  content = content.replace(/^\\noindent\s*\n*מתמטיקה,.*$/gm, '')

  // Strip page number lines like "-3-", "- 5 -", "05"
  content = content.replace(/^\\noindent\s*\n*-\s*\d+\s*-\s*$/gm, '')
  content = content.replace(/^\s*0\d\s*$/gm, '')

  // Strip "המשך מעבר לדף" / "המשך בעמוד N" continuation lines
  content = content.replace(/^\\noindent\s*\n*\/המשך.*\/\s*$/gm, '')

  // Strip bare \section*{} with empty braces (stitching artifacts)
  content = content.replace(/\\section\*\{\s*\}/g, '')

  // Clean up excessive blank lines
  content = content.replace(/\n{4,}/g, '\n\n\n')

  return content.trim()
}

/**
 * Split page content into exercises part and solutions part.
 * Solutions are identified by \section*{פתרונות} or \subsection*{פתרון שאלה N} headers.
 */
function splitExercisesAndSolutions(content: string): {
  exercises: string
  solutions: string
} {
  // Find the first solutions section marker
  const solutionsMarkers = [/\\newpage\s*\\section\*\{פתרונות\}/, /\\section\*\{פתרונות\}/]

  let splitIndex = -1
  for (const marker of solutionsMarkers) {
    const match = content.match(marker)
    if (match && match.index !== undefined) {
      splitIndex = match.index
      break
    }
  }

  if (splitIndex === -1) {
    // No solutions section found — check for individual solution headers
    const solMatch = content.match(/\\subsection\*\{פתרון שאלה/)
    if (solMatch && solMatch.index !== undefined) {
      splitIndex = solMatch.index
    }
  }

  if (splitIndex === -1) {
    return { exercises: content, solutions: '' }
  }

  const exercises = content.slice(0, splitIndex).trim()
  let solutions = content.slice(splitIndex).trim()

  // Strip the \section*{פתרונות} header itself — we'll add one unified header during stitching
  solutions = solutions.replace(/^\\newpage\s*/, '')
  solutions = solutions.replace(/^\\section\*\{פתרונות\}\s*/, '')

  return { exercises, solutions }
}
