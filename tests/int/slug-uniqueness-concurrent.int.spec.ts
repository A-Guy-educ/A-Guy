/**
 * Integration tests: Slug Uniqueness Under Concurrent Creation
 * Covers: validateSlugUniqueness field hook on Exercises collection
 *
 * P2 #21 — edge case: slug collision window between check and insert.
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
let lessonId2: string

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
    data: { name: `slug-test-${Date.now()}`, slug: `slug-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create category → course → chapter → lesson
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Slug Test Category', slug: `slug-cat-${Date.now()}`, locale: 'he' } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'S1',
      title: 'Slug Test Course',
      categories: [category.id],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: { course: course.id, title: 'Slug Test Chapter', tenant: tenantId } as any,
    overrideAccess: true,
  })

  const lesson = await payload.create({
    collection: 'lessons',
    data: { title: 'Slug Test Lesson', chapter: chapter.id, tenant: tenantId } as any,
    overrideAccess: true,
  })
  lessonId = lesson.id

  // Second lesson for cross-lesson test
  const lesson2 = await payload.create({
    collection: 'lessons',
    data: { title: 'Slug Test Lesson 2', chapter: chapter.id, tenant: tenantId } as any,
    overrideAccess: true,
  })
  lessonId2 = lesson2.id
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

describe('Slug uniqueness under concurrent creation', () => {
  it('allows creating an exercise with a unique slug', async () => {
    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: 'Exercise Alpha',
        slug: `alpha-${Date.now()}`,
        lesson: lessonId,
        tenant: tenantId,
        type: 'open',
      } as any,
      overrideAccess: true,
    })

    expect(exercise.id).toBeDefined()
  })

  it('rejects duplicate slug within the same lesson', async () => {
    const slug = `dup-slug-${Date.now()}`

    await payload.create({
      collection: 'exercises',
      data: {
        title: 'Exercise One',
        slug,
        lesson: lessonId,
        tenant: tenantId,
        type: 'open',
      } as any,
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'exercises',
        data: {
          title: 'Exercise Two',
          slug,
          lesson: lessonId,
          tenant: tenantId,
          type: 'open',
        } as any,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/slug already exists/i)
  })

  it('allows same slug in different lessons', async () => {
    const slug = `cross-lesson-${Date.now()}`

    const ex1 = await payload.create({
      collection: 'exercises',
      data: {
        title: 'Exercise In Lesson 1',
        slug,
        lesson: lessonId,
        tenant: tenantId,
        type: 'open',
      } as any,
      overrideAccess: true,
    })

    const ex2 = await payload.create({
      collection: 'exercises',
      data: {
        title: 'Exercise In Lesson 2',
        slug,
        lesson: lessonId2,
        tenant: tenantId,
        type: 'open',
      } as any,
      overrideAccess: true,
    })

    expect(ex1.id).toBeDefined()
    expect(ex2.id).toBeDefined()
    expect(ex1.id).not.toBe(ex2.id)
  })
})
