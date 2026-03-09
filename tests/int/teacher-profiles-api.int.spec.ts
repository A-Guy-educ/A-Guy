/**
 * Integration tests for GET /api/teacher-profiles
 *
 * Tests:
 * - Returns profiles when authenticated
 * - Returns 401 when not authenticated
 * - Returns correct data shape (slug, label, description, isEnabled)
 * - Excludes disabled profiles
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/teacher-profiles/route'
import { createTestUser } from '../factories/user.factory'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let authToken: string
let testUserId: string
let promptId: string
let enabledProfileId: string
let disabledProfileId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create test user and login to get JWT
  const user = await createTestUser(payload)
  testUserId = user.id

  const loginResult = await payload.login({
    collection: 'users',
    data: { email: user.email, password: 'test123456' },
  })
  authToken = loginResult.token!

  // Create a prompt (required by teacher_profiles)
  const prompt = await payload.create({
    collection: 'prompts',
    data: {
      title: `test-prompt-${Date.now()}`,
      template: 'Test prompt body for integration tests',
    } as any,
    overrideAccess: true,
  })
  promptId = prompt.id

  // Create enabled teacher profile
  const enabledProfile = await payload.create({
    collection: 'teacher_profiles',
    data: {
      slug: `test-enabled-${Date.now()}`,
      label: 'Enabled Teacher',
      description: 'An enabled test teacher profile',
      systemPrompt: promptId,
      isEnabled: true,
    } as any,
    overrideAccess: true,
  })
  enabledProfileId = enabledProfile.id

  // Create disabled teacher profile
  const disabledProfile = await payload.create({
    collection: 'teacher_profiles',
    data: {
      slug: `test-disabled-${Date.now()}`,
      label: 'Disabled Teacher',
      description: 'A disabled test teacher profile',
      systemPrompt: promptId,
      isEnabled: false,
    } as any,
    overrideAccess: true,
  })
  disabledProfileId = disabledProfile.id
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Cleanup test data
  try {
    await payload.delete({
      collection: 'teacher_profiles',
      id: enabledProfileId,
      overrideAccess: true,
    })
  } catch {
    /* already deleted */
  }
  try {
    await payload.delete({
      collection: 'teacher_profiles',
      id: disabledProfileId,
      overrideAccess: true,
    })
  } catch {
    /* already deleted */
  }
  try {
    await payload.delete({
      collection: 'prompts',
      id: promptId,
      overrideAccess: true,
    })
  } catch {
    /* already deleted */
  }
  try {
    await payload.delete({
      collection: 'users',
      id: testUserId,
      overrideAccess: true,
    })
  } catch {
    /* already deleted */
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('GET /api/teacher-profiles', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost:3000/api/teacher-profiles')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns profiles when authenticated', async () => {
    const request = new Request('http://localhost:3000/api/teacher-profiles', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.profiles).toBeDefined()
    expect(Array.isArray(data.profiles)).toBe(true)
  })

  it('returns correct data shape for each profile', async () => {
    const request = new Request('http://localhost:3000/api/teacher-profiles', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    const data = await response.json()

    // Find our enabled test profile
    const testProfile = data.profiles.find((p: any) => p.label === 'Enabled Teacher')
    expect(testProfile).toBeDefined()

    // Verify shape: only safe fields exposed
    expect(testProfile).toHaveProperty('slug')
    expect(testProfile).toHaveProperty('label')
    expect(testProfile).toHaveProperty('description')
    expect(testProfile).toHaveProperty('isEnabled')

    // Verify sensitive fields are NOT exposed
    expect(testProfile).not.toHaveProperty('systemPrompt')
    expect(testProfile).not.toHaveProperty('id')
    expect(testProfile).not.toHaveProperty('createdAt')
  })

  it('excludes disabled profiles', async () => {
    const request = new Request('http://localhost:3000/api/teacher-profiles', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    const data = await response.json()

    // Disabled profile should not appear
    const disabledProfile = data.profiles.find((p: any) => p.label === 'Disabled Teacher')
    expect(disabledProfile).toBeUndefined()
  })
})
