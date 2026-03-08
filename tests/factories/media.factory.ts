import type { Payload } from 'payload'
import type { Media } from '@/payload-types'

export interface MediaFactoryInput {
  filename?: string
  mimeType?: string
  filesize?: number
  url?: string
  tenant?: string
  createdBy?: string
}

export function buildMediaData(input: MediaFactoryInput = {}) {
  const timestamp = Date.now()
  return {
    filename: input.filename ?? `test-image-${timestamp}.jpg`,
    mimeType: input.mimeType ?? 'image/jpeg',
    filesize: input.filesize ?? 1024,
    url: input.url ?? `https://example.blob.vercel-storage.com/test-${timestamp}.jpg`,
    ...(input.tenant ? { tenant: input.tenant } : {}),
  }
}

/** Create a test media entry. Note: does not upload a real file. */
export async function createTestMedia(
  payload: Payload,
  input: MediaFactoryInput = {},
): Promise<Media> {
  const data = buildMediaData(input)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test factory: Payload's create() union types are strict
  return payload.create({ collection: 'media', data: data as any, overrideAccess: true })
}

/** Generate a minimal 1x1 JPEG buffer for upload tests */
export function createTestImageBuffer(): Buffer {
  // Minimal valid JPEG (1x1 pixel, red)
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP' +
      '//////////////////////////////////////////////////////////////////////////////////////' +
      '2wBDAf//////////////////////////////////////////////////////////////////////////////////////' +
      'wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAFBABAAAAAAAAAAAAAAAAAAAAf/' +
      'aAAwDAQACEQMRAD8AJQAAAP/Z',
    'base64',
  )
}
