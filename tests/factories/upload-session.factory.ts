import type { Payload } from 'payload'
import type { UploadSession } from '@/payload-types'

export interface UploadSessionFactoryInput {
  purpose?: string
  originalFilename?: string
  status?: 'pending' | 'completed' | 'expired'
  expiresAt?: string
  createdBy?: string
  tenant?: string
}

export function buildUploadSessionData(input: UploadSessionFactoryInput = {}) {
  const timestamp = Date.now()
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 3600_000).toISOString()
  return {
    purpose: input.purpose ?? 'chat-attachment',
    originalFilename: input.originalFilename ?? `test-file-${timestamp}.jpg`,
    status: input.status ?? 'pending',
    expiresAt,
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    ...(input.tenant ? { tenant: input.tenant } : {}),
  }
}

export async function createTestUploadSession(
  payload: Payload,
  input: UploadSessionFactoryInput = {},
): Promise<UploadSession> {
  return payload.create({
    collection: 'upload_sessions',
    data: buildUploadSessionData(input),
    overrideAccess: true,
  })
}

/** Create an expired upload session for cleanup testing */
export async function createExpiredUploadSession(
  payload: Payload,
  input: UploadSessionFactoryInput = {},
): Promise<UploadSession> {
  return createTestUploadSession(payload, {
    ...input,
    status: 'pending',
    expiresAt: new Date(Date.now() - 3600_000).toISOString(),
  })
}
