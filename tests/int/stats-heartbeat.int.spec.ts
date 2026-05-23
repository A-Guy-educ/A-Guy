// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: Stats Heartbeat API (#1833)
 *
 * Verifies that the heartbeat endpoint returns 401 when auth fails or throws,
 * rather than crashing with a 500. This guards against the regression where
 * a malformed auth token caused payload.auth() to throw and crash the route.
 *
 * Pattern: mirrors tests/int/dashboard-metrics.int.spec.ts — uses the shared
 * Payload instance from global-int-setup, imports the route's POST directly,
 * and authenticates with `Authorization: JWT <token>`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from '@/app/api/stats/heartbeat/route'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let validToken: string
const createdUserIds: string[] = []
const ts = Date.now()
const testEmail = `heartbeat-test-${ts}@test.local`
const testPassword = 'test-password-1234'

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const user = await payload.create({
    collection: 'users',
    data: {
      email: testEmail,
      password: testPassword,
      name: 'Heartbeat Test User',
    } as any,
    overrideAccess: true,
  })
  createdUserIds.push(user.id)

  const login = await payload.login({
    collection: 'users',
    data: { email: testEmail, password: testPassword },
  })
  validToken = login.token!
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  for (const id of createdUserIds) {
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)('POST /api/stats/heartbeat', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('http://localhost:3000/api/stats/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization header is malformed (non-JWT)', async () => {
    const req = new Request('http://localhost:3000/api/stats/heartbeat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer not-a-valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seconds: 30 }),
    })
    const res = await POST(req)
    // Must return 401, not crash with 500
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization header has invalid JWT format', async () => {
    const req = new Request('http://localhost:3000/api/stats/heartbeat', {
      method: 'POST',
      headers: {
        Authorization: 'JWT definitely-not-valid-jwt-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seconds: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 when authenticated with valid token and updates stats', async () => {
    const req = new Request('http://localhost:3000/api/stats/heartbeat', {
      method: 'POST',
      headers: {
        Authorization: `JWT ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seconds: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; totalTimeSpentSeconds: number }
    expect(body.success).toBe(true)
    expect(body.totalTimeSpentSeconds).toBe(30)
  })

  it('returns 400 when seconds is below minimum (30)', async () => {
    const req = new Request('http://localhost:3000/api/stats/heartbeat', {
      method: 'POST',
      headers: {
        Authorization: `JWT ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seconds: 10 }), // below minimum of 30
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when seconds exceeds maximum (60)', async () => {
    const req = new Request('http://localhost:3000/api/stats/heartbeat', {
      method: 'POST',
      headers: {
        Authorization: `JWT ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seconds: 120 }), // above maximum of 60
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
