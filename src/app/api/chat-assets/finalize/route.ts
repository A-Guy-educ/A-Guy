/**
 * Finalize Chat Asset Route
 * Creates a chat-assets document after successful blob upload
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'
import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_BYTES,
  CHAT_ASSET_MIN_IMAGE_HEIGHT,
  CHAT_ASSET_MIN_IMAGE_WIDTH,
  CHAT_ASSET_RETENTION_DAYS,
} from '@/server/chat-assets/constants'
import { head } from '@vercel/blob'
import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import sharp from 'sharp'

/**
 * Get image dimensions from a URL using sharp
 * Returns null if the file is not an image or cannot be read
 */
async function getImageDimensionsFromUrl(
  url: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const buffer = await response.arrayBuffer()
    const metadata = await sharp(Buffer.from(buffer)).metadata()
    if (!metadata.width || !metadata.height) {
      return null
    }
    return { width: metadata.width, height: metadata.height }
  } catch {
    return null
  }
}

const finalizeSchema = z
  .object({
    uploadSessionId: z.string().min(1).optional(),
    blobUrl: z.string().url().optional(),
    originalFilename: z.string().optional(),
  })
  .refine((data) => data.uploadSessionId || data.blobUrl, {
    message: 'Either uploadSessionId or blobUrl is required',
  })

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || !('id' in user)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = 'id' in user ? user.id : null
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = finalizeSchema.safeParse(body)

    if (!validated.success) {
      return Response.json(
        { error: 'Invalid request', details: validated.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { uploadSessionId, blobUrl, originalFilename } = validated.data

    let session
    if (uploadSessionId) {
      session = await payload.findByID({
        collection: 'upload-sessions',
        id: uploadSessionId,
        depth: 0,
        overrideAccess: true,
      })
    } else if (blobUrl) {
      // Strategy 1: by blobUrl (set by onUploadCompleted callback)
      const byUrl = await payload.find({
        collection: 'upload-sessions',
        where: { blobUrl: { equals: blobUrl } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      session = byUrl.docs[0] || null

      // Strategy 2: by pathname extracted from blobUrl
      if (!session) {
        try {
          const url = new URL(blobUrl)
          const blobPathname = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
          if (blobPathname) {
            const byPath = await payload.find({
              collection: 'upload-sessions',
              where: {
                pathname: { equals: blobPathname },
                createdBy: { equals: userId },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            session = byPath.docs[0] || null
          }
        } catch {
          // Invalid URL, skip pathname lookup
        }
      }

      // Strategy 3: most recent unfinalized session for this user
      if (!session) {
        const byUser = await payload.find({
          collection: 'upload-sessions',
          where: {
            createdBy: { equals: userId },
            status: { in: ['initiated', 'uploaded'] },
            ...(originalFilename ? { originalFilename: { equals: originalFilename } } : {}),
          },
          sort: '-createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        session = byUser.docs[0] || null
      }
    }

    if (!session) {
      return Response.json({ error: 'Upload session not found' }, { status: 404 })
    }

    if (session.createdBy !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (session.status === 'finalized') {
      if (session.chatAssetId) {
        const chatAssetId =
          typeof session.chatAssetId === 'string' ? session.chatAssetId : session.chatAssetId?.id
        if (chatAssetId) {
          const chatAsset = await payload.findByID({
            collection: 'chat-assets',
            id: chatAssetId,
            depth: 0,
            overrideAccess: true,
          })
          if (chatAsset) {
            return Response.json({
              chatAssetId: chatAsset.id,
              chatAsset: {
                id: chatAsset.id,
                url: chatAsset.url,
                pathname: chatAsset.pathname,
                originalFilename: chatAsset.originalFilename,
                mimeType: chatAsset.mimeType,
                filesize: chatAsset.filesize,
                expiresAt: chatAsset.expiresAt,
              },
            })
          }
        }
      }
      return Response.json({ error: 'Session already finalized' }, { status: 409 })
    }

    if (!['initiated', 'uploaded'].includes(session.status)) {
      return Response.json({ error: 'Invalid session status' }, { status: 409 })
    }

    // If onUploadCompleted didn't fire, use the blobUrl from the client
    const resolvedBlobUrl = session.blobUrl || blobUrl
    if (!resolvedBlobUrl) {
      return Response.json({ error: 'Upload not completed' }, { status: 409 })
    }

    if (!isVercelBlobUrl(resolvedBlobUrl)) {
      return Response.json({ error: 'Invalid blob URL' }, { status: 400 })
    }

    // Update session with blobUrl if it wasn't set by onUploadCompleted
    if (!session.blobUrl && resolvedBlobUrl) {
      await payload.update({
        collection: 'upload-sessions',
        id: session.id,
        data: { blobUrl: resolvedBlobUrl, status: 'uploaded' },
        overrideAccess: true,
      })
    }

    // Verify blob exists using head() directly (not through media adapter,
    // since chat assets are stored under chat-assets/, not media/)
    let blobSize = session.expectedSize || 0
    let blobContentType = session.mimeType
    try {
      const blobHead = await head(resolvedBlobUrl)
      blobSize = blobHead.size || blobSize
      blobContentType = blobHead.contentType || blobContentType
    } catch {
      // Blob might not be immediately available; trust the session data
    }

    if (blobSize && blobSize > CHAT_ASSET_MAX_BYTES) {
      return Response.json({ error: 'File size exceeds maximum' }, { status: 413 })
    }

    if (
      blobContentType &&
      !CHAT_ASSET_ALLOWED_MIME_TYPES.includes(
        blobContentType as (typeof CHAT_ASSET_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return Response.json({ error: 'Content type not allowed' }, { status: 415 })
    }

    // Server-side image dimension validation for image types
    if (blobContentType?.startsWith('image/')) {
      const dimensions = await getImageDimensionsFromUrl(resolvedBlobUrl)
      if (dimensions) {
        if (
          dimensions.width < CHAT_ASSET_MIN_IMAGE_WIDTH ||
          dimensions.height < CHAT_ASSET_MIN_IMAGE_HEIGHT
        ) {
          return Response.json(
            {
              error: `Image is too small. Minimum size is ${CHAT_ASSET_MIN_IMAGE_WIDTH}x${CHAT_ASSET_MIN_IMAGE_HEIGHT} pixels, but this image is ${dimensions.width}x${dimensions.height} pixels.`,
            },
            { status: 422 },
          )
        }
      }
      // If dimensions cannot be determined, allow the upload to proceed
      // (the client-side validation should have caught invalid images)
    }

    const expiresAt = new Date(Date.now() + CHAT_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const chatAsset = await payload.create({
      collection: 'chat-assets',
      data: {
        tenant: session.tenant,
        createdBy: userId,
        url: resolvedBlobUrl,
        pathname: session.pathname,
        originalFilename: session.originalFilename,
        mimeType: session.mimeType,
        filesize: blobSize || session.expectedSize || 0,
        retentionPolicy: 'ephemeral',
        expiresAt: expiresAt.toISOString(),
        uploadSessionId: session.id,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'upload-sessions',
      id: session.id,
      data: {
        status: 'finalized',
        chatAssetId: chatAsset.id,
      },
      overrideAccess: true,
    })

    return Response.json({
      chatAssetId: chatAsset.id,
      chatAsset: {
        id: chatAsset.id,
        url: chatAsset.url,
        pathname: chatAsset.pathname,
        originalFilename: chatAsset.originalFilename,
        mimeType: chatAsset.mimeType,
        filesize: chatAsset.filesize,
        expiresAt: chatAsset.expiresAt,
      },
    })
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/chat-assets/finalize' })
  }
}
