import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import type { TestDataTracker } from '../helpers/test-data-tracker'

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
  }
}

export async function createTestUser(
  payload: Payload,
  input: UserFactoryInput = {},
  tracker?: TestDataTracker,
) {
  const user = await payload.create({
    collection: 'users',
    data: buildUserData(input),
  })
  tracker?.track('users', user.id)
  return user
}
