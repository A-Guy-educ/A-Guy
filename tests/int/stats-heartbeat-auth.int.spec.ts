/**
 * Integration tests for Stats Heartbeat API Endpoint
 *
 * Issue: #1501 - Fix 401 on stats heartbeat API for unauthenticated users
 *
 * The heartbeat endpoint should handle unauthenticated requests gracefully.
 * When a user is not authenticated, the endpoint should either:
 * - Return 200 with a safe response (not tracking any user data)
 * - Return a response that indicates the heartbeat was skipped
 *
 * It should NOT return 401 Unauthorized, which causes console errors
 * in the browser after login.
 *
 * Run with:
 *   pnpm test:int -- tests/int/stats-heartbeat-auth.int.spec.ts
 */

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@payload-config'
import { POST } from '@/app/api/stats/heartbeat/route'

let payload: Payload

describe('Stats Heartbeat API', () => {
  beforeAll(async () => {
    // Start MongoDB container for integration tests
    const mongoUri = await startMongoContainer()
    process.env.DATABASE_URL = mongoUri
    process.env.PAYLOAD_SECRET = 'test-secret-key-for-integration-tests-only-minimum-32-chars'
    process.env.DEFAULT_TENANT_SLUG = 'default'

    // Initialize Payload
    payload = await getPayload({ config })
  }, 180000)

  afterAll(async () => {
    // Close DB connection before stopping container
    if (payload?.db?.destroy) {
      await payload.db.destroy()
    }

    await stopMongoContainer()
  })

  describe('POST /api/stats/heartbeat', () => {
    it('should NOT return 401 for unauthenticated requests - issue #1501', async () => {
      // Create a mock request without authentication headers
      const mockRequest = new Request('http://localhost:3000/api/stats/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seconds: 30,
        }),
      })

      const response = await POST(mockRequest)

      // The bug: currently returns 401 for unauthenticated users
      // Expected: should NOT return 401 (should return 200 with safe response)
      expect(response.status).not.toBe(401)

      // Should return 200 OK (indicating the endpoint handled the unauthenticated case gracefully)
      expect(response.status).toBe(200)
    })

    it('should accept valid heartbeat data from unauthenticated user without 401', async () => {
      // Create a mock request without authentication headers
      const mockRequest = new Request('http://localhost:3000/api/stats/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seconds: 45,
          lessonId: 'some-lesson-id',
        }),
      })

      const response = await POST(mockRequest)

      // The bug: currently returns 401 for unauthenticated users
      // Expected: should handle gracefully without 401
      expect(response.status).not.toBe(401)

      // Should return 200 OK
      expect(response.status).toBe(200)
    })
  })
})
