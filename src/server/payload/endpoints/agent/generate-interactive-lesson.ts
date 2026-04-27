/**
 * Payload endpoint handler for interactive lesson generation.
 *
 * Takes an uploaded image, returns structured step-by-step animation data.
 *
 * Caching: a successful generation is persisted to the `interactive_lessons`
 * collection keyed on `(user, media, locale)`. Re-requests for the same image
 * in the same locale return the cached payload instead of re-hitting Gemini.
 */
import type { Payload, PayloadRequest } from 'payload'
import type { InteractiveLesson as CachedLessonDoc } from '@/payload-types'
import { logger } from '@/infra/utils/logger/logger'
import { generateInteractiveLesson } from '@/infra/llm/services/interactive-lesson/interactive-lesson-generation-service'
import type {
  InteractiveLesson,
  InteractiveLessonResponse,
} from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

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

    // Cache hit? Return immediately without regenerating.
    const cached = await findCachedLesson(req.payload, {
      userId: req.user.id,
      mediaId,
      locale,
    })
    if (cached) {
      // Sanity-check the cached payload shape before returning. If it has
      // drifted (e.g. missing steps[] after a schema change), evict and
      // fall through to a fresh generation rather than crash the client.
      if (isWellFormedLesson(cached.lesson)) {
        reqLogger.info({ cacheId: cached.id, mediaId }, 'Returning cached interactive lesson')
        return Response.json({
          success: true,
          data: cached.lesson as unknown as InteractiveLesson,
          metadata: (cached.generationMetadata ?? {
            model: 'cache',
            processingTimeMs: 0,
            imageSizeBytes: 0,
          }) as InteractiveLessonResponse['metadata'],
          fromCache: true,
        })
      }
      reqLogger.warn(
        { cacheId: cached.id, mediaId },
        'Cached lesson has malformed shape, evicting and regenerating',
      )
      await req.payload
        .delete({ collection: 'interactive_lessons', id: cached.id, overrideAccess: true })
        .catch((err) => {
          reqLogger.warn({ err, cacheId: cached.id }, 'Failed to evict malformed cache row')
        })
    }

    // Fetch the uploaded media file
    const { imageBuffer, mimeType } = await fetchMediaImage(req, mediaId)

    const result = await generateInteractiveLesson({ imageBuffer, mimeType, locale }, req.payload)

    if (!result.success) {
      reqLogger.warn({ error: result.error, mediaId }, 'Generation failed')
      return Response.json(result, { status: 422 })
    }

    // Persist the primitive payload. Failure to cache is non-fatal — the
    // client still gets a working lesson; we just pay the Gemini cost again
    // next time.
    await persistLesson(req.payload, {
      userId: req.user.id,
      mediaId,
      locale,
      lesson: result.data!,
      metadata: result.metadata,
    }).catch((err) => {
      reqLogger.warn({ err, mediaId }, 'Failed to persist interactive lesson cache')
    })

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

interface CacheLookupArgs {
  userId: string | number
  mediaId: string
  locale: 'he' | 'en'
}

async function findCachedLesson(
  payload: Payload,
  { userId, mediaId, locale }: CacheLookupArgs,
): Promise<CachedLessonDoc | null> {
  const result = await payload.find({
    collection: 'interactive_lessons',
    where: {
      and: [
        { user: { equals: userId } },
        { media: { equals: mediaId } },
        { locale: { equals: locale } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

interface PersistArgs {
  userId: string | number
  mediaId: string
  locale: 'he' | 'en'
  lesson: InteractiveLesson
  metadata: InteractiveLessonResponse['metadata']
}

async function persistLesson(
  payload: Payload,
  { userId, mediaId, locale, lesson, metadata }: PersistArgs,
): Promise<void> {
  try {
    await payload.create({
      collection: 'interactive_lessons',
      data: {
        user: userId as CachedLessonDoc['user'],
        media: mediaId as unknown as CachedLessonDoc['media'],
        locale,
        lesson: lesson as unknown as CachedLessonDoc['lesson'],
        generationMetadata: metadata as unknown as CachedLessonDoc['generationMetadata'],
      },
      overrideAccess: true,
    })
  } catch (err) {
    // Two concurrent generations for the same (user, media, locale) can both
    // miss the cache, both call Gemini, and both try to insert — the unique
    // index on the collection ensures only one wins. The loser hits a
    // duplicate-key error here, which we silently absorb: the winner's row
    // is already in place, and the next read for either request will be a
    // cache hit. Other errors (e.g. validation) still surface.
    if (isDuplicateKeyError(err)) return
    throw err
  }
}

/**
 * Mongo's duplicate-key error code is 11000. Payload wraps the driver error,
 * but the original surfaces on `err.code` or in the message string.
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: number; message?: string; name?: string }
  if (e.code === 11000) return true
  return /E11000|duplicate key/i.test(e.message ?? '')
}

/**
 * Light structural sanity check on a cached lesson payload. Catches schema
 * drift (e.g. older row missing a field that's now expected) so a stale
 * cached row evicts itself rather than crashing the client. Not a full
 * validation — Gemini's freshly-validated output goes through `validateLesson`
 * before persist, so anything that lands in cache passed once already.
 */
function isWellFormedLesson(lesson: unknown): boolean {
  if (!lesson || typeof lesson !== 'object') return false
  const l = lesson as { title?: unknown; steps?: unknown; geometry?: unknown }
  if (typeof l.title !== 'string') return false
  if (!Array.isArray(l.steps) || l.steps.length === 0) return false
  if (!l.geometry || typeof l.geometry !== 'object') return false
  return true
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
