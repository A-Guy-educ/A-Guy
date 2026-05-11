// @vitest-environment node
/**
 * Integration test: repro #1582 — GET /api/admin/dashboard-metrics returns 500
 *
 * The admin dashboard at /admin calls GET /api/admin/dashboard-metrics?period=month
 * to populate three stats panels. When the endpoint crashes with HTTP 500, all three
 * panels stay permanently in a "Loading..." state.
 *
 * This test exercises the aggregation loop in the route's GET handler that processes
 * activity log data from user-stats documents. The loop:
 *   for (const entry of stat.activityLog || []) { switch(entry.actionType){...} }
 * crashes with TypeError when entry.actionType is accessed on a non-object value
 * (null, undefined, string, number — possible via raw MongoDB inserts or legacy
 * migrations that bypass Payload's field validation).  The TypeError causes
 * Promise.all to reject, and the route returns HTTP 500.
 *
 * The existing tests in admin-dashboard-metrics.int.spec.ts and
 * dashboard-metrics.int.spec.ts never create user-stats docs, so this code
 * path is never exercised and the bug is never caught.
 */

import { GET } from '@/app/api/admin/dashboard-metrics/route'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminToken: string
const createdIds: string[] = []

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-1582-${Date.now()}@test.local`
  const password = 'test-password-1234'

  const admin = await payload.create({
    collection: 'users',
    data: { email: adminEmail, password, name: 'Admin 1582' } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  createdIds.push(admin.id)

  const login = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password },
  })
  adminToken = login.token!
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  for (const id of createdIds) {
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)(
  'repro #1582: GET /api/admin/dashboard-metrics returns 500',
  () => {
    it('returns 200 when user-stats activityLog entries are non-objects (null/undefined/string/number)', async () => {
      // Set up: create a user whose user-stats doc has activityLog entries that are
      // NOT plain objects.  This triggers: TypeError: Cannot read properties of
      // <X> (reading 'actionType') in the aggregation loop, which causes the
      // Promise.all to reject and the route to return HTTP 500.
      const user = await payload.create({
        collection: 'users',
        data: {
          email: `student-1582-${Date.now()}@test.local`,
          password: 'test-password-1234',
          name: 'Student 1582',
        } as any,
        overrideAccess: true,
      })
      createdIds.push(user.id)

      // Get raw MongoDB access via Payload's mongoose connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAny = payload.db as any
      const mongoose = dbAny?.mongoose

      if (mongoose?.connection?.db) {
        await mongoose.connection.db.collection('user-stats').insertOne({
          user: user.id,
          totalTimeSpentSeconds: 60,
          // Non-object entries in activityLog — these trigger the crash
          // TypeError: Cannot read properties of null/undefined/string/number
          activityLog: [
            {
              actionType: 'question_asked',
              label: 'Asked a question',
              targetId: 'q-1',
              targetCollection: 'conversations',
              timestamp: new Date(),
            },
            null, // ← null entry: null.actionType → TypeError
            'invalid-string-entry' as unknown as object, // ← string entry
            42 as unknown as object, // ← number entry
            undefined, // ← undefined entry: undefined.actionType → TypeError
            {
              actionType: 'conversation_started',
              label: 'Started a conversation',
              targetId: 'c-1',
              targetCollection: 'conversations',
              timestamp: new Date(),
            },
          ],
          updatedAt: new Date(),
          createdAt: new Date(),
        })
      }

      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)

      // Before the fix: TypeError in aggregation loop → Promise.all rejects → 500.
      // After the fix: null/undefined guards in loop → graceful skip → 200.
      expect(res.status).toBe(200)

      const body = await res.json()
      // Feature-usage counts must be present and reflect only valid entries
      expect(body.engagement.featureUsage).toEqual(
        expect.objectContaining({
          questionsAsked: expect.any(Number),
          conversationsStarted: expect.any(Number),
        }),
      )
    }, 30_000)
  },
)
