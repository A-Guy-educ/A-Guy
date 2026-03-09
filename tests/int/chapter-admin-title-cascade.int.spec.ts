/**
 * Integration tests: Chapter adminTitle Cascade Across Tenants
 * Covers: cascadeAdminTitle afterChange hook on Courses collection
 *
 * P2 #26 — display issue: stale adminTitle after course rename.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let categoryId: string

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
    data: { name: `cascade-test-${Date.now()}`, slug: `cascade-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Cascade Category', slug: `cascade-cat-${Date.now()}`, locale: 'he' } as any,
    overrideAccess: true,
  })
  categoryId = category.id
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

describe('Chapter adminTitle cascade', () => {
  it('auto-computes adminTitle on chapter creation', async () => {
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'C1',
        title: 'Mathematics',
        categories: [categoryId],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const chapter = await payload.create({
      collection: 'chapters',
      data: { course: course.id, title: 'Algebra', tenant: tenantId } as any,
      overrideAccess: true,
    })

    expect(chapter.adminTitle).toContain('Algebra')
    expect(chapter.adminTitle).toContain('Mathematics')
  })

  it('cascades course title change to all related chapters', async () => {
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'C2',
        title: 'Physics',
        categories: [categoryId],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const ch1 = await payload.create({
      collection: 'chapters',
      data: { course: course.id, title: 'Mechanics', tenant: tenantId } as any,
      overrideAccess: true,
    })

    const ch2 = await payload.create({
      collection: 'chapters',
      data: { course: course.id, title: 'Optics', tenant: tenantId } as any,
      overrideAccess: true,
    })

    // Update course title
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { title: 'Advanced Physics' } as any,
      overrideAccess: true,
    })

    // Re-read chapters — adminTitle should reflect new course title
    const updatedCh1 = await payload.findByID({
      collection: 'chapters',
      id: ch1.id,
      overrideAccess: true,
    })

    const updatedCh2 = await payload.findByID({
      collection: 'chapters',
      id: ch2.id,
      overrideAccess: true,
    })

    expect(updatedCh1.adminTitle).toContain('Mechanics')
    expect(updatedCh1.adminTitle).toContain('Advanced Physics')
    expect(updatedCh2.adminTitle).toContain('Optics')
    expect(updatedCh2.adminTitle).toContain('Advanced Physics')
  })

  it('does not cascade when course title is unchanged', async () => {
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'C3',
        title: 'Chemistry',
        categories: [categoryId],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const chapter = await payload.create({
      collection: 'chapters',
      data: { course: course.id, title: 'Organic', tenant: tenantId } as any,
      overrideAccess: true,
    })

    const originalAdminTitle = chapter.adminTitle

    // Update course but NOT the title
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { courseLabel: 'C3-updated' } as any,
      overrideAccess: true,
    })

    const reloaded = await payload.findByID({
      collection: 'chapters',
      id: chapter.id,
      overrideAccess: true,
    })

    expect(reloaded.adminTitle).toBe(originalAdminTitle)
  })
})
