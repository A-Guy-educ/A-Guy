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
  CHAT_ASSET_RETENTION_DAYS,
} from '@/server/chat-assets/constants'
import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import { getMediaBlobAdapter } from '@/infra/blob/vercel-blob-adapter'

const finalizeSchema = z.object({
  uploadSessionId: z.string().min(1),
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

    const { uploadSessionId } = validated.data

    const session = await payload.findByID({
      collection: 'upload-sessions',
      id: uploadSessionId,
      depth: 0,
      overrideAccess: true,
    })

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

    if (!session.blobUrl) {
      return Response.json({ error: 'Upload not completed' }, { status: 409 })
    }

    if (!isVercelBlobUrl(session.blobUrl)) {
      return Response.json({ error: 'Invalid blob URL' }, { status: 400 })
    }

    const blobAdapter = getMediaBlobAdapter()
    const metadata = await blobAdapter.getMetadata(session.blobUrl)

    if (!metadata) {
      return Response.json({ error: 'Blob not found' }, { status: 404 })
    }

    if (metadata.size && metadata.size > CHAT_ASSET_MAX_BYTES) {
      return Response.json({ error: 'File size exceeds maximum' }, { status: 413 })
    }

    if (
      metadata.contentType &&
      !CHAT_ASSET_ALLOWED_MIME_TYPES.includes(
        metadata.contentType as (typeof CHAT_ASSET_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return Response.json({ error: 'Content type not allowed' }, { status: 415 })
    }

    const expiresAt = new Date(Date.now() + CHAT_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const chatAsset = await payload.create({
      collection: 'chat-assets',
      data: {
        tenant: session.tenant,
        createdBy: userId,
        url: session.blobUrl,
        pathname: session.pathname,
        originalFilename: session.originalFilename,
        mimeType: session.mimeType,
        filesize: metadata.size || session.expectedSize || 0,
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
