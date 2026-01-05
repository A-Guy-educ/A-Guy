/**
 * POST /api/exercises/import
 * Import exercise from uploaded image using AI extraction
 *
 * Access: Authenticated users only
 */
import { PayloadRequest, addDataAndFileToRequest } from 'payload'
import { extractFromImage } from '@/lib/ai/services/data-extractor-service'

interface UploadedFileLike {
  data?: Buffer
  buffer?: Buffer
  mimetype: string
  size?: number
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export async function importExerciseFromImage(req: PayloadRequest) {
  // 1) Auth - endpoints not authenticated by default
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Parse multipart (Payload doesn't auto-attach data/file)
  await addDataAndFileToRequest(req)

  const file = (req as any).file as UploadedFileLike | undefined

  if (!file) {
    return Response.json({ error: 'Image file is required' }, { status: 400 })
  }

  const mimeType = file.mimetype
  const fileSize = file.size ?? 0
  const imageBuffer = file.data ?? file.buffer

  if (!imageBuffer || !mimeType) {
    return Response.json({ error: 'Invalid uploaded file' }, { status: 400 })
  }

  // 3) Validate
  if (fileSize > MAX_FILE_SIZE) {
    return Response.json({ error: 'File size must be under 10MB' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return Response.json({ error: 'Invalid file type. Allowed: PNG, JPG, WEBP' }, { status: 400 })
  }

  // 4) Call AI service (image only, no additional text)
  const result = await extractFromImage({
    imageBuffer,
    mimeType,
  })

  if (!result.success) {
    return Response.json({ error: result.error || 'Failed to process image' }, { status: 500 })
  }

  return Response.json({
    success: true,
    data: result.data,
    metadata: result.metadata,
  })
}
