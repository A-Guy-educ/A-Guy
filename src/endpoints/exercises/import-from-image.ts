/**
 * POST /api/exercises/import
 * Import exercise from uploaded image using AI extraction
 *
 * Access: Authenticated users only
 */
import { PayloadRequest, addDataAndFileToRequest } from 'payload'
import { extractFromImage } from '@/lib/ai/services/data-extractor-service'
import { RequestTiming } from '@/utilities/perf/request-timing'
import { logger } from '@/utilities/logger'

interface UploadedFileLike {
  data?: Buffer
  buffer?: Buffer
  mimetype: string
  size?: number
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export async function importExerciseFromImage(
  req: PayloadRequest & { requestId?: string; timing?: RequestTiming },
) {
  const requestId = req.requestId ?? crypto.randomUUID()
  const reqLogger = logger.child({ requestId })
  const timing =
    req.timing ??
    new RequestTiming({ requestId, endpoint: '/api/exercises/import', logger: reqLogger })
  const ownsTiming = !req.timing
  if (ownsTiming) {
    timing.markPoint('handler_entry')
  }
  // 1) Auth - endpoints not authenticated by default
  if (!req.user) {
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: 'Authentication required' }, { status: 401 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }

  // 2) Parse multipart (Payload doesn't auto-attach data/file)
  await addDataAndFileToRequest(req)

  // Access file from req - addDataAndFileToRequest attaches it
  const file = req.file as UploadedFileLike | undefined

  if (!file) {
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: 'Image file is required' }, { status: 400 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }

  const mimeType = file.mimetype
  const fileSize = file.size ?? 0
  const imageBuffer = file.data ?? file.buffer

  if (!imageBuffer || !mimeType) {
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: 'Invalid uploaded file' }, { status: 400 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }

  // 3) Validate
  if (fileSize > MAX_FILE_SIZE) {
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: 'File size must be under 10MB' }, { status: 400 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: 'Invalid file type. Allowed: PNG, JPG, WEBP' }, { status: 400 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }

  // 4) Call AI service (image only, no additional text)
  const { result } = await timing.time('external_call:extract_from_image', () =>
    extractFromImage({
      imageBuffer,
      mimeType,
    }),
  )

  if (!result.success) {
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: result.error || 'Failed to process image' }, { status: 500 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }

  const { result: response } = timing.timeSync('serialization', () =>
    Response.json({
      success: true,
      data: result.data,
      metadata: result.metadata,
    }),
  )
  if (ownsTiming) {
    timing.markPoint('handler_exit')
    timing.logIfSlow()
  }
  return response
}
