/**
 * Integration tests: Config Values Domain Validation Edge Cases
 * Covers: beforeChangeValidateConfigValues hook — tenant+domain uniqueness
 *
 * P2 #25 — data integrity: duplicate configs silently accepted.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let tenantId2: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `cfg-test-${Date.now()}`, slug: `cfg-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  const tenant2 = await payload.create({
    collection: 'tenants',
    data: { name: `cfg-test2-${Date.now()}`, slug: `cfg-test2-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId2 = tenant2.id
}, 120_000)

afterEach(async () => {
  // Clean up config values between tests
  const configs = await payload.find({
    collection: 'config_values',
    limit: 100,
    overrideAccess: true,
  })
  for (const c of configs.docs) {
    await payload.delete({ collection: 'config_values', id: c.id, overrideAccess: true })
  }
})

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

describe('Config values domain validation', () => {
  it('creates a config entry with unique tenant+domain', async () => {
    const config = await payload.create({
      collection: 'config_values',
      data: {
        tenant: tenantId,
        domain: 'rate-limiting',
        config: { maxRequests: 100, windowMs: 60000 },
      } as any,
      overrideAccess: true,
    })

    expect(config.id).toBeDefined()
    expect(config.domain).toBe('rate-limiting')
  })

  it('rejects duplicate tenant+domain combination', async () => {
    await payload.create({
      collection: 'config_values',
      data: {
        tenant: tenantId,
        domain: 'chat',
        config: { maxTokens: 1000 },
      } as any,
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'config_values',
        data: {
          tenant: tenantId,
          domain: 'chat',
          config: { maxTokens: 2000 },
        } as any,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already exists for this tenant/i)
  })

  it('allows same domain for different tenants', async () => {
    const c1 = await payload.create({
      collection: 'config_values',
      data: {
        tenant: tenantId,
        domain: 'guest-chat',
        config: { enabled: true },
      } as any,
      overrideAccess: true,
    })

    const c2 = await payload.create({
      collection: 'config_values',
      data: {
        tenant: tenantId2,
        domain: 'guest-chat',
        config: { enabled: false },
      } as any,
      overrideAccess: true,
    })

    expect(c1.id).toBeDefined()
    expect(c2.id).toBeDefined()
    expect(c1.id).not.toBe(c2.id)
  })

  it('allows updating an existing config without uniqueness conflict', async () => {
    const config = await payload.create({
      collection: 'config_values',
      data: {
        tenant: tenantId,
        domain: 'update-test',
        config: { value: 1 },
      } as any,
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'config_values',
      id: config.id,
      data: { config: { value: 2 } } as any,
      overrideAccess: true,
    })

    expect(updated.config).toEqual({ value: 2 })
  })
})
