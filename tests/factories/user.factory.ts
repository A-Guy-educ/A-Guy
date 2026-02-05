import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { AccountRole } from '@/server/payload/collections/Users/roles'

export interface UserFactoryInput {
  email?: string
  password?: string
  name?: string
  role?: User['role']
}

export function buildUserData(input: UserFactoryInput = {}) {
  const timestamp = Date.now()
  return {
    email: input.email ?? `test-user-${timestamp}@example.com`,
    password: input.password ?? 'test123456',
    name: input.name ?? `Test User ${timestamp}`,
    role: input.role ?? AccountRole.Student,
    tier: 'free' as const,
  }
}

export async function createTestUser(payload: Payload, input: UserFactoryInput = {}) {
  return payload.create({
    collection: 'users',
    data: buildUserData(input),
  })
}
