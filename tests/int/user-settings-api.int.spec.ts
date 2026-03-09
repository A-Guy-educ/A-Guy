/**
 * Integration tests for GET/PATCH /api/user-settings
 *
 * Tests:
 * - GET returns null settings for new user
 * - PATCH updates teacher profile selection
 * - GET returns updated settings after PATCH
 * - Returns 401 when not authenticated
 * - PATCH validates request body with Zod
 * - PATCH returns 404 for nonexistent profile slug
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET, PATCH } from '@/app/api/user-settings/route'
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
let profileSlug: string
let profileId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create test user and login
  const user = await createTestUser(payload, {
    email: `user-settings-test-${Date.now()}@example.com`,
  })
  testUserId = user.id

  const loginResult = await payload.login({
    collection: 'users',
    data: { email: user.email, password: 'test123456' },
  })
  authToken = loginResult.token!

  // Create prompt and teacher profile for PATCH tests
  const prompt = await payload.create({
    collection: 'prompts',
    data: {
      title: `settings-prompt-${Date.now()}`,
      template: 'Test prompt for user settings tests',
    } as any,
    overrideAccess: true,
  })
  promptId = prompt.id

  profileSlug = `settings-profile-${Date.now()}`
  const profile = await payload.create({
    collection: 'teacher_profiles',
    data: {
      slug: profileSlug,
      label: 'Settings Test Teacher',
      description: 'Teacher profile for settings tests',
      systemPrompt: promptId,
      isEnabled: true,
    } as any,
    overrideAccess: true,
  })
  profileId = profile.id
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up user_settings for test user
  const settings = await payload.find({
    collection: 'user_settings',
    where: { user: { equals: testUserId } },
    limit: 10,
    overrideAccess: true,
  })
  for (const s of settings.docs) {
    try {
      await payload.delete({
        collection: 'user_settings',
        id: s.id,
        overrideAccess: true,
      })
    } catch {
      /* already deleted */
    }
  }

  try {
    await payload.delete({
      collection: 'teacher_profiles',
      id: profileId,
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

describe.skipIf(!hasDatabaseUrl)('GET /api/user-settings', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost:3000/api/user-settings')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns null teacher profile for new user', async () => {
    const request = new Request('http://localhost:3000/api/user-settings', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.settings).toBeDefined()
    expect(data.settings.teacherProfile).toBeNull()
  })
})

describe.skipIf(!hasDatabaseUrl)('PATCH /api/user-settings', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost:3000/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherProfileSlug: profileSlug }),
    })
    const response = await PATCH(request)

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid request body', async () => {
    const request = new Request('http://localhost:3000/api/user-settings', {
      method: 'PATCH',
      headers: {
        Authorization: `JWT ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalidField: 'value' }),
    })
    const response = await PATCH(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid request')
  })

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost:3000/api/user-settings', {
      method: 'PATCH',
      headers: {
        Authorization: `JWT ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: 'not-valid-json',
    })
    const response = await PATCH(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid JSON body')
  })

  it('returns 404 for nonexistent profile slug', async () => {
    const request = new Request('http://localhost:3000/api/user-settings', {
      method: 'PATCH',
      headers: {
        Authorization: `JWT ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        teacherProfileSlug: 'nonexistent-profile-slug',
      }),
    })
    const response = await PATCH(request)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Teacher profile not found or disabled')
  })

  it('updates teacher profile selection successfully', async () => {
    const request = new Request('http://localhost:3000/api/user-settings', {
      method: 'PATCH',
      headers: {
        Authorization: `JWT ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teacherProfileSlug: profileSlug }),
    })
    const response = await PATCH(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.settings).toBeDefined()
    expect(data.settings.id).toBeDefined()
    expect(data.settings.teacherProfileSlug).toBe(profileSlug)
  })

  it('GET returns updated settings after PATCH', async () => {
    // First PATCH to set profile
    const patchReq = new Request('http://localhost:3000/api/user-settings', {
      method: 'PATCH',
      headers: {
        Authorization: `JWT ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teacherProfileSlug: profileSlug }),
    })
    await PATCH(patchReq)

    // Then GET to verify
    const getReq = new Request('http://localhost:3000/api/user-settings', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(getReq)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.settings).toBeDefined()
    expect(data.settings.id).toBeDefined()
    expect(data.settings.teacherProfile).toBeDefined()
    expect(data.settings.teacherProfile.slug).toBe(profileSlug)
    expect(data.settings.teacherProfile.label).toBe('Settings Test Teacher')
  })
})
