import type { Payload } from 'payload'
import type { UploadSession } from '@/payload-types'
import type { TestDataTracker } from '../helpers/test-data-tracker'

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
  tracker?: TestDataTracker,
): Promise<UploadSession> {
  const session = await payload.create({
    collection: 'upload-sessions',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test factory: Payload's create() union types are strict
    data: buildUploadSessionData(input) as any,
    overrideAccess: true,
  })
  tracker?.track('upload-sessions', session.id)
  return session
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
