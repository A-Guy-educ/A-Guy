/**
 * V3 Extract Single Exercise Orchestrator
 *
 * Orchestrates single exercise extraction from document:
 * 1. Fetch lesson and resolve tenant
 * 2. Fetch and validate media
 * 3. Resolve extractor prompt
 * 4. Download media buffer
 * 5. Extract with LLM
 * 6. Transform to preview
 * 7. Create extraction log
 *
 * @fileType service
 * @domain conversion
 * @pattern orchestrator
 */

import type { Payload } from 'payload'

import type { Lesson } from '@/payload-types'
import type { Media } from '@/payload-types'
import {
  extractFromImage,
  type ImageToExerciseResponse,
} from '@/infra/llm/services/data-extractor-service'
import { normalizeToAbsoluteUrl, getPdfBufferFromBlob } from '@/server/services/pdf-fetcher'
import { loadAndRenderAllPages } from '@/server/services/exercise-conversion/v2/pdf-render-service'
import { fetchBuffer } from '@/infra/utils/http'
import { resolveExtractorPrompt } from './prompt-resolver'
import {
  toPreviewDraft,
  toExerciseContent,
  type PreviewDraft,
  type TransformResult,
} from './transform'

// Supported image mime types for V3
const SUPPORTED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp']
const SUPPORTED_DOCUMENT_MIMES = ['application/pdf', ...SUPPORTED_IMAGE_MIMES]

// ---------------------------------
// Input/Output Types
// ---------------------------------

export interface ExtractSingleInput {
  lessonId: string
  mediaId: string
  promptId?: string // optional override
}

export interface ExtractSingleResult {
  success: boolean
  preview?: {
    title: string
    draft: PreviewDraft
    content: TransformResult['content']
    metadata: {
      model: string
      processingTimeMs: number
      promptId?: string
      promptVersion?: string
    }
  }
  extractionLogId: string
  error?: string
}

// ---------------------------------
// Main: Extract Single Exercise
// ---------------------------------

/**
 * Extract a single exercise from a document (PDF or image).
 * Returns preview data for admin review.
 */
export async function extractSingle(
  payload: Payload,
  input: ExtractSingleInput,
): Promise<ExtractSingleResult> {
  const startTime = Date.now()
  const { lessonId, mediaId, promptId } = input

  // Step 1: Fetch lesson and resolve tenant
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
  })

  if (!lesson) {
    return {
      success: false,
      extractionLogId: '',
      error: 'Lesson not found',
    }
  }

  const typedLesson = lesson as unknown as Lesson
  const lessonTenantId =
    typeof typedLesson.tenant === 'object' ? typedLesson.tenant?.id : typedLesson.tenant
  if (!lessonTenantId) {
    return {
      success: false,
      extractionLogId: '',
      error: 'Lesson has no tenant',
    }
  }

  // Step 2: Fetch media document and validate attachment
  const media = await payload.findByID({
    collection: 'media',
    id: mediaId,
    depth: 0,
  })

  if (!media) {
    return {
      success: false,
      extractionLogId: '',
      error: 'Media not found',
    }
  }

  const typedMedia = media as unknown as Media

  // Validate media is attached to lesson's contentFiles
  const contentFiles = typedLesson.contentFiles || []
  const contentFileIds = contentFiles.map((m) => (typeof m === 'string' ? m : m.id))
  if (!contentFileIds.includes(mediaId)) {
    return {
      success: false,
      extractionLogId: '',
      error:
        'Media is not attached to this lesson. Save the lesson after attaching media and try again.',
    }
  }

  // Validate mime type
  if (!SUPPORTED_DOCUMENT_MIMES.includes(typedMedia.mimeType || '')) {
    return {
      success: false,
      extractionLogId: '',
      error: `Unsupported mime type: ${typedMedia.mimeType}. Supported: ${SUPPORTED_DOCUMENT_MIMES.join(', ')}`,
    }
  }

  // Step 3: Resolve extractor prompt
  let resolvedPrompt: Awaited<ReturnType<typeof resolveExtractorPrompt>> | null = null
  try {
    resolvedPrompt = await resolveExtractorPrompt(payload, lessonTenantId, promptId)
  } catch (promptError) {
    return {
      success: false,
      extractionLogId: '',
      error: promptError instanceof Error ? promptError.message : 'Failed to resolve prompt',
    }
  }

  // Step 4: Download media buffer
  let imageBuffer: Buffer
  let mimeType = typedMedia.mimeType || 'application/pdf'

  try {
    if (mimeType === 'application/pdf') {
      // PDF: render first page to image
      const pdfBuffer = await getPdfBufferFromBlob(mediaId, payload)
      const pages = await loadAndRenderAllPages(pdfBuffer)
      if (pages.length === 0) {
        return {
          success: false,
          extractionLogId: '',
          error: 'PDF has no pages',
        }
      }
      // Use first page
      imageBuffer = pages[0].image.buffer
      mimeType = 'image/png'
    } else if (SUPPORTED_IMAGE_MIMES.includes(mimeType)) {
      // Image: fetch directly
      if (!typedMedia.url) {
        return {
          success: false,
          extractionLogId: '',
          error: 'Media has no URL',
        }
      }
      const imageUrl = typedMedia.url.startsWith('/')
        ? await normalizeToAbsoluteUrl(typedMedia.url)
        : typedMedia.url
      imageBuffer = await fetchBuffer(imageUrl, 30000)
    } else {
      return {
        success: false,
        extractionLogId: '',
        error: `Unsupported document type: ${mimeType}`,
      }
    }
  } catch (downloadError) {
    return {
      success: false,
      extractionLogId: '',
      error: downloadError instanceof Error ? downloadError.message : 'Failed to download media',
    }
  }

  // Step 5: Extract with LLM
  let llmResult: ImageToExerciseResponse
  try {
    llmResult = await extractFromImage(
      {
        imageBuffer,
        mimeType,
      },
      payload,
    )
  } catch (llmError) {
    // Log failed extraction
    const logId = await createExtractionLog(payload, {
      tenant: lessonTenantId,
      lesson: lessonId,
      media: mediaId,
      prompt: resolvedPrompt?.prompt.id,
      promptVersion: resolvedPrompt?.version,
      status: 'failed',
      stage: 'extract',
      errorMessage: llmError instanceof Error ? llmError.message : 'LLM extraction failed',
      processingTimeMs: Date.now() - startTime,
      model: '',
    })

    return {
      success: false,
      extractionLogId: logId,
      error: llmError instanceof Error ? llmError.message : 'LLM extraction failed',
    }
  }

  // Step 6: Transform to preview
  let previewDraft: PreviewDraft
  let exerciseContent: TransformResult['content']

  if (llmResult.success && llmResult.data) {
    // Handle multiple questions - take first silently
    const extractionData = llmResult.data

    // Transform to preview draft (preserves null correctAnswer)
    previewDraft = toPreviewDraft(extractionData)

    // Transform to exercise content (uses deterministic fallback for null)
    const transformResult = toExerciseContent(extractionData)
    exerciseContent = transformResult.content

    // Log successful extraction
    const logId = await createExtractionLog(payload, {
      tenant: lessonTenantId,
      lesson: lessonId,
      media: mediaId,
      prompt: resolvedPrompt?.prompt.id,
      promptVersion: resolvedPrompt?.version,
      status: 'success',
      stage: 'extract',
      rawResponse: JSON.stringify(extractionData),
      parsedPayload: extractionData as unknown as Record<string, unknown>,
      processingTimeMs: llmResult.metadata.processingTimeMs,
      model: llmResult.metadata.model,
    })

    return {
      success: true,
      preview: {
        title: previewDraft.title,
        draft: previewDraft,
        content: exerciseContent,
        metadata: {
          model: llmResult.metadata.model,
          processingTimeMs: llmResult.metadata.processingTimeMs,
          promptId: resolvedPrompt?.prompt.id,
          promptVersion: resolvedPrompt?.version,
        },
      },
      extractionLogId: logId,
    }
  } else {
    // Log failed extraction
    const logId = await createExtractionLog(payload, {
      tenant: lessonTenantId,
      lesson: lessonId,
      media: mediaId,
      prompt: resolvedPrompt?.prompt.id,
      promptVersion: resolvedPrompt?.version,
      status: 'failed',
      stage: 'extract',
      errorMessage: llmResult.error || 'LLM extraction returned no data',
      processingTimeMs: llmResult.metadata.processingTimeMs,
      model: llmResult.metadata.model,
    })

    return {
      success: false,
      extractionLogId: logId,
      error: llmResult.error || 'LLM extraction returned no data',
    }
  }
}

// ---------------------------------
// Helper: Create Extraction Log
// ---------------------------------

async function createExtractionLog(
  payload: Payload,
  data: {
    tenant: string
    lesson: string
    media: string
    prompt?: string
    promptVersion?: string
    status: 'success' | 'failed'
    stage: 'extract' | 'create'
    rawResponse?: string
    parsedPayload?: Record<string, unknown>
    errorMessage?: string
    processingTimeMs: number
    model: string
  },
): Promise<string> {
  // Cast to any to bypass type check - extraction-logs collection exists but types not yet generated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload as any).create({
    collection: 'extraction-logs',
    data: {
      tenant: data.tenant,
      lesson: data.lesson,
      media: data.media,
      prompt: data.prompt,
      promptVersion: data.promptVersion,
      status: data.status,
      stage: data.stage,
      rawResponse: data.rawResponse,
      parsedPayload: data.parsedPayload,
      errorMessage: data.errorMessage,
      pipelineVersion: 3,
      processingTimeMs: data.processingTimeMs,
      model: data.model,
    },
    overrideAccess: true, // Bypass create: () => false
  })

  return result.id
}
