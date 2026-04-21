/**
 * Payload endpoint handler for interactive lesson generation.
 * Takes an uploaded image and generates structured step-by-step
 * HTML animation data using the LLM pipeline.
 */
import type { PayloadRequest } from 'payload'
import { logger } from '@/infra/utils/logger/logger'
import { generateInteractiveLesson } from '@/infra/llm/services/interactive-lesson/interactive-lesson-generation-service'

interface GenerateRequestBody {
  mediaId: string
  locale?: 'he' | 'en'
}

export async function agentGenerateInteractiveLesson(
  req: PayloadRequest & { json: () => Promise<GenerateRequestBody> },
) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId, endpoint: 'generate-interactive-lesson' })

  try {
    if (!req.user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { mediaId, locale = 'he' } = body

    if (!mediaId) {
      return Response.json({ success: false, error: 'mediaId is required' }, { status: 400 })
    }

    reqLogger.info({ mediaId, locale, userId: req.user.id }, 'Generating interactive lesson')

    // Fetch the uploaded media file
    const { imageBuffer, mimeType } = await fetchMediaImage(req, mediaId)

    const result = await generateInteractiveLesson({ imageBuffer, mimeType, locale }, req.payload)

    if (!result.success) {
      reqLogger.warn({ error: result.error, mediaId }, 'Generation failed')
      return Response.json(result, { status: 422 })
    }

    // TTS skipped — GuidedExplanationRunner uses browser speechSynthesis
    // for narration; OpenAI TTS output was never consumed by the client.

    reqLogger.info(
      {
        mediaId,
        stepCount: result.data?.steps.length,
        processingTimeMs: result.metadata.processingTimeMs,
      },
      'Interactive lesson generated successfully',
    )

    return Response.json(result)
  } catch (error) {
    // Log full detail server-side, return a generic message to the client
    // so Gemini/Payload/OpenAI internals don't leak to users.
    reqLogger.error({ err: error }, 'Interactive lesson generation error')
    return Response.json(
      {
        success: false,
        error: 'Failed to generate lesson. Please try again.',
      },
      { status: 500 },
    )
  }
}

/**
 * Fetch the image buffer from an uploaded media document.
 * Uses internal HTTP fetch with cookie forwarding for auth.
 */
async function fetchMediaImage(
  req: PayloadRequest,
  mediaId: string,
): Promise<{ imageBuffer: Buffer; mimeType: string }> {
  const media = await req.payload.findByID({
    collection: 'media',
    id: mediaId,
  })

  if (!media) {
    throw new Error(`Media document ${mediaId} not found`)
  }

  const url = media.url as string
  if (!url) {
    throw new Error(`Media ${mediaId} has no URL`)
  }

  // Build absolute URL for serverless fetch
  const requestUrl = new URL(req.url || 'http://localhost:3000')
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const absoluteUrl = url.startsWith('http') ? url : `${origin}${url}`

  const cookieHeader = req.headers.get('cookie')
  const fetchOptions: RequestInit = cookieHeader ? { headers: { cookie: cookieHeader } } : {}

  const response = await fetch(absoluteUrl, fetchOptions)
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const mimeType = (media.mimeType as string) || 'image/jpeg'

  return {
    imageBuffer: Buffer.from(arrayBuffer),
    mimeType,
  }
}
