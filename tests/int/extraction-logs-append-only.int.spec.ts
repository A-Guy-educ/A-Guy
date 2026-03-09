/**
 * Integration tests: Extraction Logs Append-Only Constraint
 * Covers: access control on extraction-logs collection
 *
 * P2 #24 — audit integrity: extraction logs must be immutable.
 * create/update/delete all return () => false at access control level.
 * Server-side creation uses overrideAccess: true.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let lessonId: string
let mediaId: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create required references
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `elog-test-${Date.now()}`, slug: `elog-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  const category = await payload.create({
    collection: 'categories',
    data: { title: 'ELog Category', slug: `elog-cat-${Date.now()}`, locale: 'he' } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'EL',
      title: 'ELog Course',
      categories: [category.id],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: { course: course.id, title: 'ELog Chapter', tenant: tenantId } as any,
    overrideAccess: true,
  })

  const lesson = await payload.create({
    collection: 'lessons',
    data: { title: 'ELog Lesson', chapter: chapter.id, tenant: tenantId } as any,
    overrideAccess: true,
  })
  lessonId = lesson.id

  const media = await payload.create({
    collection: 'media',
    data: {
      type: 'external',
      externalUrl: `https://example.com/elog-${Date.now()}.pdf`,
      filename: `elog-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  mediaId = media.id
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

describe('Extraction logs append-only constraint', () => {
  let logId: string

  it('allows server-side creation with overrideAccess', async () => {
    const log = await payload.create({
      collection: 'extraction-logs',
      data: {
        lesson: lessonId,
        media: mediaId,
        status: 'success',
        stage: 'extract',
        pipelineVersion: 3,
        rawResponse: '{"result":"test"}',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    expect(log.id).toBeDefined()
    logId = log.id
  })

  it('rejects create without overrideAccess (access: create returns false)', async () => {
    await expect(
      payload.create({
        collection: 'extraction-logs',
        data: {
          lesson: lessonId,
          media: mediaId,
          status: 'completed',
          stage: 'extract',
          pipelineVersion: 'v3',
          rawResponse: '{}',
          tenant: tenantId,
        } as any,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('rejects update without overrideAccess (append-only)', async () => {
    await expect(
      payload.update({
        collection: 'extraction-logs',
        id: logId,
        data: { status: 'failed' } as any,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('rejects delete without overrideAccess (append-only)', async () => {
    await expect(
      payload.delete({
        collection: 'extraction-logs',
        id: logId,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
