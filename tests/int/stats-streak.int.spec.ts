// @vitest-environment node
// Node.js environment required: payload.auth() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array.

/**
 * Integration tests: Stats Streak API
 *
 * Tests POST /api/stats/streak endpoint
 *
 * @fileType integration-test
 * @domain stats
 * @pattern streak
 */

import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

let payload: Payload
let originalDatabaseUrl: string | undefined
let userToken: string
let userId: string
let tenantId: string

const USER_EMAIL = `streak-test-${Date.now()}@test.com`
const USER_PASSWORD = 'test-password-123!'

let POST: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create tenant
  const tenants = await payload.find({ collection: 'tenants', limit: 1, overrideAccess: true })
  if (tenants.docs.length > 0) {
    tenantId = tenants.docs[0].id
  } else {
    const t = await payload.create({
      collection: 'tenants',
      data: { name: 'Streak Test Tenant', slug: `streak-test-${Date.now()}`, status: 'active' },
      overrideAccess: true,
    })
    tenantId = t.id
  }

  // Create user
  const user = await (payload as any).create({
    collection: 'users',
    data: {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      name: 'Streak Test User',
      tenant: tenantId,
    },
  })
  userId = user.id

  // Login to get JWT token
  const loginResult = await payload.login({
    collection: 'users',
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  })
  userToken = loginResult.token as string

  // Route imported dynamically
  const route = await import('@/app/api/stats/streak/route')
  POST = route.POST
}, 120000)

afterAll(async () => {
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }
  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  }
})

describe('POST /api/stats/streak', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/stats/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 200 when authenticated and creates new streak', async () => {
    const request = new NextRequest('http://localhost:3000/api/stats/streak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${userToken}`,
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      success: boolean
      currentStreak: number
      longestStreak: number
    }
    expect(data.success).toBe(true)
    expect(data.currentStreak).toBe(1)
    expect(data.longestStreak).toBe(1)
  })

  it('returns 200 and is idempotent when called multiple times same day', async () => {
    // First call
    const request1 = new NextRequest('http://localhost:3000/api/stats/streak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${userToken}`,
      },
      body: JSON.stringify({}),
    })

    const response1 = await POST(request1)
    expect(response1.status).toBe(200)

    const data1 = (await response1.json()) as {
      success: boolean
      currentStreak: number
      longestStreak: number
    }
    expect(data1.currentStreak).toBe(1)

    // Second call - should be idempotent (already counted today)
    const request2 = new NextRequest('http://localhost:3000/api/stats/streak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${userToken}`,
      },
      body: JSON.stringify({}),
    })

    const response2 = await POST(request2)
    expect(response2.status).toBe(200)

    const data2 = (await response2.json()) as {
      success: boolean
      currentStreak: number
      longestStreak: number
    }
    // Already counted today, so streak should be unchanged
    expect(data2.currentStreak).toBe(1)
    expect(data2.longestStreak).toBe(1)
  })

  it('returns 200 with empty body', async () => {
    // Simulates what the frontend sends (empty body per useActiveTimeTracker)
    const request = new NextRequest('http://localhost:3000/api/stats/streak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${userToken}`,
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
