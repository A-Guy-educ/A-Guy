/**
 * Integration tests: Conversation Context Hierarchy Builder
 * Covers: buildContextHierarchy in conversation-service.ts
 *
 * P1 — correctness: incorrect hierarchy traversal causes memory items to be
 * stored under wrong context keys, breaking AI conversation continuity.
 *
 * Tests the full parent traversal chain for each collection type:
 * exercise → lesson → chapter → course → global
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { buildContextHierarchy } from '@/server/services/conversation-service'
import { createContextHierarchy } from '../factories/context.factory'
import type { ContextHierarchy } from '../factories/context.factory'

let payload: Payload
let hierarchy: ContextHierarchy
let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create full hierarchy once for all tests
  hierarchy = await createContextHierarchy(payload)
}, 120_000)

afterAll(async () => {
  await hierarchy?.cleanup()
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('buildContextHierarchy', () => {
  it('exercise context key returns full exercise→lesson→chapter→course→global chain', async () => {
    const keys = await buildContextHierarchy(`exercises:${hierarchy.exerciseId}`, payload)

    expect(keys).toEqual([
      `exercises:${hierarchy.exerciseId}`,
      `lessons:${hierarchy.lessonId}`,
      `chapters:${hierarchy.chapterId}`,
      `courses:${hierarchy.courseId}`,
      'global',
    ])
  })

  it('lesson context key returns lesson→chapter→course→global chain', async () => {
    const keys = await buildContextHierarchy(`lessons:${hierarchy.lessonId}`, payload)

    expect(keys).toEqual([
      `lessons:${hierarchy.lessonId}`,
      `chapters:${hierarchy.chapterId}`,
      `courses:${hierarchy.courseId}`,
      'global',
    ])
  })

  it('chapter context key returns chapter→course→global chain', async () => {
    const keys = await buildContextHierarchy(`chapters:${hierarchy.chapterId}`, payload)

    expect(keys).toEqual([
      `chapters:${hierarchy.chapterId}`,
      `courses:${hierarchy.courseId}`,
      'global',
    ])
  })

  it('course context key returns course→global only', async () => {
    const keys = await buildContextHierarchy(`courses:${hierarchy.courseId}`, payload)

    expect(keys).toEqual([`courses:${hierarchy.courseId}`, 'global'])
  })

  it('always appends global as the final entry for all context types', async () => {
    const exerciseKeys = await buildContextHierarchy(`exercises:${hierarchy.exerciseId}`, payload)
    const lessonKeys = await buildContextHierarchy(`lessons:${hierarchy.lessonId}`, payload)
    const chapterKeys = await buildContextHierarchy(`chapters:${hierarchy.chapterId}`, payload)
    const courseKeys = await buildContextHierarchy(`courses:${hierarchy.courseId}`, payload)

    expect(exerciseKeys.at(-1)).toBe('global')
    expect(lessonKeys.at(-1)).toBe('global')
    expect(chapterKeys.at(-1)).toBe('global')
    expect(courseKeys.at(-1)).toBe('global')
  })
})
