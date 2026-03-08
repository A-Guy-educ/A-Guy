import type { Payload } from 'payload'
import type { ChatAsset } from '@/payload-types'

export interface ChatAssetFactoryInput {
  url?: string
  originalFilename?: string
  mimeType?: string
  filesize?: number
  expiresAt?: string
  createdBy?: string
  tenant?: string
}

export function buildChatAssetData(input: ChatAssetFactoryInput = {}) {
  const timestamp = Date.now()
  return {
    url: input.url ?? `https://example.blob.vercel-storage.com/chat-${timestamp}.jpg`,
    originalFilename: input.originalFilename ?? `chat-image-${timestamp}.jpg`,
    mimeType: input.mimeType ?? 'image/jpeg',
    filesize: input.filesize ?? 2048,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 86400_000).toISOString(),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    ...(input.tenant ? { tenant: input.tenant } : {}),
  }
}

export async function createTestChatAsset(
  payload: Payload,
  input: ChatAssetFactoryInput = {},
): Promise<ChatAsset> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test factory: Payload's create() union types are strict
  return payload.create({
    collection: 'chat-assets',
    data: buildChatAssetData(input) as any,
    overrideAccess: true,
  })
}

/** Create an expired chat asset for cleanup testing */
export async function createExpiredChatAsset(
  payload: Payload,
  input: ChatAssetFactoryInput = {},
): Promise<ChatAsset> {
  return createTestChatAsset(payload, {
    ...input,
    expiresAt: new Date(Date.now() - 86400_000).toISOString(),
  })
}
