/**
 * Lesson Context Extraction Service
 *
 * Extracts context text from lesson content files (PDF/images) using AI prompts.
 * The extracted text is stored in the lesson's lessonContextText field.
 *
 * All Payload Local API calls use overrideAccess: false + user context for security.
 */
import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import { fetchBuffer } from '@/infra/utils/http'
import type { Lesson, Media, Prompt } from '@/payload-types'
import { getPdfBufferFromBlob, normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'
import { getPageCount } from '@/server/utils/pdf-metadata'
import type { Payload, User } from 'payload'

import { validateExtractedLatex } from './validate-latex'

/**
 * PDFs longer than this will show a warning that output may be incomplete.
 * Based on observed behavior: ~10 pages of exercises + solutions fits in 16384 output tokens.
 */
const PDF_PAGE_WARNING_THRESHOLD = 12

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
  const { lessonId, promptId, mediaId, mode = 'replace' } = input

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

    const mimeType = isPdf ? 'application/pdf' : mediaTyped.mimeType || 'image/png'
    const base64Data = fileBuffer.toString('base64')

    const response = await adapter.generateMultimodalCompletion(
      {
        prompt: fullPrompt,
        model: modelConfig,
        attachments: [{ data: base64Data, mimeType }],
      },
      payload,
    )

    // ========== Step 8: Validate response ==========
    const responseText = response.text?.trim()

    if (!responseText) {
      return {
        success: false,
        error:
          'AI returned empty response. The PDF may be unreadable or contain only images without text.',
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    const validation = validateExtractedLatex(responseText)
    warnings.push(...validation.warnings)

    if (!validation.valid) {
      warnings.push(...validation.errors)
    }

    let extractedText = validation.sanitizedText

    // ========== Step 8b: If truncated, retry with solutions-only pass ==========
    if (validation.isTruncated) {
      warnings.push('First pass was truncated — running a second pass for solutions only.')

      const solutionsPrompt = `You are given LaTeX code of math exercises that was extracted from a PDF. The extraction was cut off before the solutions could be completed.

Your task: Generate ONLY the solutions section for these exercises. Output valid LaTeX starting from \\newpage and the solutions sections.

Rules:
- Start with \\newpage
- Use \\section*{פתרון תרגיל X} for each solution
- Solutions must be highly detailed, showing formulas, derivatives, and logical steps
- Match the solution list format: \\begin{enumerate}[label=\\textbf{\\alph*.}]
- Do NOT repeat the exercises — only output the solutions
- Do NOT include \\documentclass, \\usepackage, \\begin{document}, or \\end{document}

Here are the exercises that need solutions:

${extractedText}`

      try {
        const solutionsResponse = await adapter.generateMultimodalCompletion(
          {
            prompt: solutionsPrompt,
            model: modelConfig,
            attachments: [{ data: base64Data, mimeType }],
          },
          payload,
        )

        const solutionsText = solutionsResponse.text?.trim()

        if (solutionsText) {
          // Remove any duplicate preamble/document tags the LLM might add
          const cleanedSolutions = solutionsText
            .replace(/\\documentclass[\s\S]*?\\begin\{document\}/g, '')
            .replace(/\\end\{document\}/g, '')
            .trim()

          if (cleanedSolutions) {
            // Remove empty solution stubs from the first pass before appending real solutions
            const textWithoutEmptyStubs = extractedText.replace(/\\newpage[\s\S]*$/, '').trim()

            extractedText = `${textWithoutEmptyStubs}\n\n${cleanedSolutions}`
            warnings.push('Solutions were extracted in a second pass and appended successfully.')
          }
        }
      } catch (solutionsError) {
        const msg = solutionsError instanceof Error ? solutionsError.message : 'Unknown error'
        warnings.push(
          `Second pass for solutions failed: ${msg}. Exercises were saved without full solutions.`,
        )
      }
    }

    // ========== Step 8c: Verify solution accuracy ==========
    // Ask the LLM to check if solutions are mathematically correct.
    // If errors are found, flag them as warnings so they can be reviewed.
    try {
      const solutionVerifyPrompt = `You are a math teacher verifying student solutions. Check the following LaTeX document for mathematical errors in the SOLUTIONS section only.

For each solution that contains a mathematical error (wrong calculation, incorrect formula application, wrong final answer), report it in this exact JSON format:
{ "errors": [{ "exercise": "exercise number or title", "description": "what is wrong and what the correct answer should be" }] }

If all solutions are correct, return: { "errors": [] }

IMPORTANT: Only report clear mathematical errors, not stylistic issues.

Document to verify:
${extractedText}`

      const verifyResponse = await adapter.generateChatCompletion(
        {
          system: 'You are a precise math verification assistant. Return only valid JSON.',
          messages: [{ role: 'user', content: solutionVerifyPrompt }],
          model: modelConfig,
          acknowledgment: 'Verifying solutions...',
        },
        payload,
      )

      const verifyText = verifyResponse.text?.trim()
      if (verifyText) {
        try {
          const jsonMatch = verifyText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
              for (const err of parsed.errors) {
                warnings.push(`Solution accuracy issue in ${err.exercise}: ${err.description}`)
              }
            }
          }
        } catch {
          // JSON parse failure is non-fatal — skip verification
        }
      }
    } catch {
      // Verification is best-effort — don't fail extraction if it errors
      warnings.push('Solution verification step was skipped due to an error.')
    }

    // ========== Step 9: Store result based on mode ==========
    let updatedContextText: string

    if (mode === 'append') {
      const existingContext = lessonTyped.lessonContextText || ''
      const delimiter = '\n\n---\n\n'
      updatedContextText = existingContext
        ? `${existingContext}${delimiter}${extractedText}`
        : extractedText
    } else {
      updatedContextText = extractedText
    }

    // ========== Step 10: Update lesson ==========
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
