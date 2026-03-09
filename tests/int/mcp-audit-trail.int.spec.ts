/**
 * Integration tests: MCP Tool-Calling Audit Trail
 * Covers: logMcpCall() → mcp-audit-logs collection creation + access control
 *
 * P2 #22 — compliance: admin MCP tool calls must be logged.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { logMcpCall } from '@/server/repos/mcp/audit/audit-service'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let adminUserId: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `mcp-test-${Date.now()}`, slug: `mcp-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create admin user
  const user = await (payload as any).create({
    collection: 'users',
    data: {
      email: `mcp-admin-${Date.now()}@test.com`,
      password: 'test-password-123!',
      name: 'MCP Admin',
    },
  })
  adminUserId = user.id
}, 120_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('MCP audit trail', () => {
  it('creates an audit log entry via logMcpCall', async () => {
    const requestId = `req-${Date.now()}`

    await logMcpCall({
      req: { payload } as any,
      adminUserId,
      tenantId,
      toolName: 'test-tool',
      args: { query: 'find users', limit: 10 },
      resultCount: 5,
      success: true,
      durationMs: 123,
      requestId,
    })

    const logs = await payload.find({
      collection: 'mcp-audit-logs',
      where: { requestId: { equals: requestId } },
      overrideAccess: true,
    })

    expect(logs.docs).toHaveLength(1)
    const log = logs.docs[0]
    expect(log.toolName).toBe('test-tool')
    const logAdminUserId =
      typeof log.adminUserId === 'object' ? (log.adminUserId as any).id : log.adminUserId
    expect(logAdminUserId).toBe(adminUserId)
    const logTenantId = typeof log.tenantId === 'object' ? (log.tenantId as any).id : log.tenantId
    expect(logTenantId).toBe(tenantId)
    expect(log.resultCount).toBe(5)
    expect(log.success).toBe(true)
    expect(log.durationMs).toBe(123)
  })

  it('sanitizes circular/non-serializable args', async () => {
    const requestId = `req-circular-${Date.now()}`
    const circular: any = { a: 1 }
    circular.self = circular // circular reference

    await logMcpCall({
      req: { payload } as any,
      adminUserId,
      tenantId,
      toolName: 'circular-tool',
      args: circular,
      resultCount: 0,
      success: false,
      durationMs: 50,
      requestId,
    })

    const logs = await payload.find({
      collection: 'mcp-audit-logs',
      where: { requestId: { equals: requestId } },
      overrideAccess: true,
    })

    // Should still create the log (sanitizeJsonValue returns null for circular)
    expect(logs.docs).toHaveLength(1)
    expect(logs.docs[0].args).toBeNull()
  })

  it('rejects update on audit logs (append-only)', async () => {
    const logs = await payload.find({
      collection: 'mcp-audit-logs',
      limit: 1,
      overrideAccess: true,
    })

    if (logs.docs.length > 0) {
      await expect(
        payload.update({
          collection: 'mcp-audit-logs',
          id: logs.docs[0].id,
          data: { toolName: 'hacked' } as any,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    }
  })
})
