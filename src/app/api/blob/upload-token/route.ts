/**
 * Handle Upload Route
 * Vercel Blob client calls this to get a client token for direct uploads
 */

import { handleUpload } from '@vercel/blob/client'
import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'
import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_BYTES,
  CHAT_ASSET_TOKEN_VALID_MINUTES,
} from '@/server/chat-assets/constants'
import { buildChatAssetPathname } from '@/server/chat-assets/pathname'

import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'

const clientPayloadSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().positive(),
  purpose: z.enum(['chat-media']).default('chat-media'),
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

    const tenantId = await getDefaultTenantId(payload)
    if (!tenantId) {
      return Response.json({ error: 'Tenant not found' }, { status: 500 })
    }

    const result = await handleUpload({
      request,
      body: await request.json(),
      onBeforeGenerateToken: async (pathname, clientPayloadRaw, _multipart) => {
        let clientPayload: z.infer<typeof clientPayloadSchema>
        try {
          clientPayload = clientPayloadSchema.parse(JSON.parse(clientPayloadRaw || '{}'))
        } catch {
          throw new Error('Invalid client payload')
        }

        if (clientPayload.size > CHAT_ASSET_MAX_BYTES) {
          throw new Error(`File size exceeds maximum of ${CHAT_ASSET_MAX_BYTES} bytes`)
        }

        if (
          !CHAT_ASSET_ALLOWED_MIME_TYPES.includes(
            clientPayload.contentType as (typeof CHAT_ASSET_ALLOWED_MIME_TYPES)[number],
          )
        ) {
          throw new Error(`Content type ${clientPayload.contentType} is not allowed`)
        }

        const expiresAt = new Date(Date.now() + CHAT_ASSET_TOKEN_VALID_MINUTES * 60 * 1000)

        const session = await payload.create({
          collection: 'upload-sessions',
          data: {
            tenant: tenantId,
            createdBy: userId,
            purpose: clientPayload.purpose,
            originalFilename: clientPayload.originalFilename,
            mimeType: clientPayload.contentType,
            expectedSize: clientPayload.size,
            pathname: '',
            status: 'initiated',
            expiresAt: expiresAt.toISOString(),
          },
          overrideAccess: true,
        })

        const finalPathname = buildChatAssetPathname({
          tenantId,
          userId,
          uploadSessionId: session.id,
          filename: clientPayload.originalFilename,
        })

        await payload.update({
          collection: 'upload-sessions',
          id: session.id,
          data: { pathname: finalPathname },
          overrideAccess: true,
        })

        return {
          allowedContentTypes: [clientPayload.contentType],
          maximumSizeInBytes: CHAT_ASSET_MAX_BYTES,
          validUntil: expiresAt.getTime(),
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60 * 60 * 24,
          tokenPayload: JSON.stringify({
            uploadSessionId: session.id,
            tenantId,
            userId,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payloadData = JSON.parse(tokenPayload || '{}')
          const { uploadSessionId } = payloadData

          if (!uploadSessionId) {
            console.error('[handleUpload] Missing uploadSessionId in tokenPayload')
            return
          }

          await payload.update({
            collection: 'upload-sessions',
            id: uploadSessionId,
            data: {
              blobUrl: blob.url,
              pathname: blob.pathname,
              status: 'uploaded',
            },
            overrideAccess: true,
          })

          console.log(`[handleUpload] Upload completed for session ${uploadSessionId}`)
        } catch (error) {
          console.error('[handleUpload] Error in onUploadCompleted:', error)
        }
      },
    })

    return Response.json(result)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
