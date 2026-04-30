/**
 * Integration tests for createExercisesFromExtraction (Stage 2 service).
 *
 * Covers the structured-vs-text source preference, lesson.blocks
 * reconciliation (drops stale exerciseRefs, appends new ones, preserves
 * unrelated entries), and the malformed-entry warnings path.
 *
 * @fileType integration-test
 * @domain content-pipeline
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { createExercisesFromExtraction } from '@/server/services/lesson-context-conversion/create-exercises-from-extraction'
import config from '@payload-config'
import type { Payload, User } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminUser: User
let tenantId: string
let categoryId: string
let courseId: string
let chapterId: string
const createdLessonIds: string[] = []
const createdExtractionIds: string[] = []
const createdExerciseIds: string[] = []

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const admin = await payload.create({
    collection: 'users',
    data: {
      email: `cefe-admin-${Date.now()}@example.com`,
      password: 'test123456',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin },
    overrideAccess: true,
  })
  adminUser = (await payload.findByID({
    collection: 'users',
    id: admin.id,
    overrideAccess: true,
  })) as unknown as User

  const existingTenants = await payload.find({ collection: 'tenants', limit: 1 })
  if (existingTenants.docs.length > 0) {
    tenantId = existingTenants.docs[0].id
  } else {
    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: 'CEFE Tenant', slug: `cefe-tenant-${Date.now()}` } as any,
      overrideAccess: true,
    })
    tenantId = tenant.id
  }

  const existingCategories = await payload.find({ collection: 'categories', limit: 1 })
  categoryId =
    existingCategories.docs[0]?.id ??
    (
      await payload.create({
        collection: 'categories',
        data: { title: 'CEFE Category', slug: `cefe-cat-${Date.now()}` } as any,
        overrideAccess: true,
      })
    ).id

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'CE',
      title: 'CEFE Course',
      slug: `cefe-course-${Date.now()}`,
      order: 0,
      status: 'published',
      isActive: true,
      categories: [categoryId],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      title: 'CEFE Chapter',
      slug: `cefe-chap-${Date.now()}`,
      order: 0,
      isActive: true,
      course: courseId,
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  chapterId = chapter.id
}, 60_000)

beforeEach(async () => {
  if (!payload) return
  for (const id of createdExerciseIds) {
    try {
      await payload.delete({ collection: 'exercises', id, overrideAccess: true })
    } catch {
      // already gone
    }
  }
  createdExerciseIds.length = 0
  for (const id of createdExtractionIds) {
    try {
      await payload.delete({ collection: 'context-extractions', id, overrideAccess: true })
    } catch {
      // already gone
    }
  }
  createdExtractionIds.length = 0
  for (const id of createdLessonIds) {
    try {
      await payload.delete({ collection: 'lessons', id, overrideAccess: true })
    } catch {
      // already gone
    }
  }
  createdLessonIds.length = 0
})

afterAll(async () => {
  if (!payload) return
  if (chapterId) {
    try {
      await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })
    } catch {
      // ignore
    }
  }
  if (courseId) {
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {
      // ignore
    }
  }
  if (adminUser?.id) {
    try {
      await payload.delete({ collection: 'users', id: adminUser.id, overrideAccess: true })
    } catch {
      // ignore
    }
  }
})

async function createLesson(): Promise<string> {
  const lesson = await payload.create({
    collection: 'lessons',
    data: {
      title: `CEFE Lesson ${Date.now()}`,
      slug: `cefe-lesson-${Date.now()}`,
      order: 0,
      type: 'practice',
      status: 'draft',
      isActive: true,
      chapter: chapterId,
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  createdLessonIds.push(lesson.id)
  return lesson.id
}

async function seedExtraction(
  lessonId: string,
  data: { text?: string; exercises?: unknown },
): Promise<void> {
  // sourceMedia is required, so create a tiny media row to point at.
  const media = await payload.create({
    collection: 'media',
    data: {
      filename: `cefe-${Date.now()}.tex`,
      mimeType: 'application/x-tex',
      filesize: 1,
      alt: 'cefe',
    } as any,
    file: {
      data: Buffer.from('% empty'),
      mimetype: 'application/x-tex',
      name: `cefe-${Date.now()}.tex`,
      size: 8,
    } as any,
    overrideAccess: true,
  })
  const extraction = await payload.create({
    collection: 'context-extractions',
    data: {
      lesson: lessonId,
      sourceMedia: media.id,
      // text is required by the collection schema even when the structured
      // exercises array is the source of truth; pass a placeholder if the
      // caller only cares about the structured field.
      text: data.text && data.text.trim() ? data.text : '% structured-only',
      exercises: data.exercises,
    } as any,
    overrideAccess: true,
  })
  createdExtractionIds.push(extraction.id)
}

describe('createExercisesFromExtraction', () => {
  it.skipIf(!hasDatabaseUrl)(
    'returns NO_EXTRACTION when the lesson has no extraction yet',
    async () => {
      const lessonId = await createLesson()
      const result = await createExercisesFromExtraction({
        payload,
        user: adminUser,
        lessonId,
      })
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.code).toBe('NO_EXTRACTION')
      }
    },
    30_000,
  )

  it.skipIf(!hasDatabaseUrl)(
    'prefers the structured exercises array and creates Exercise documents',
    async () => {
      const lessonId = await createLesson()
      await seedExtraction(lessonId, {
        text: 'fallback should not run',
        exercises: [
          { number: 1, latex: '$x + 1$', solution: null },
          { number: 2, latex: '$y + 2$', solution: 'נימוק' },
        ],
      })

      const result = await createExercisesFromExtraction({
        payload,
        user: adminUser,
        lessonId,
      })

      expect('error' in result).toBe(false)
      if ('error' in result) return
      expect(result.source).toBe('structured')
      expect(result.exerciseCount).toBe(2)
      expect(result.lessonBlocksUpdated).toBe(true)
      createdExerciseIds.push(...result.exerciseIds)
    },
    30_000,
  )

  it.skipIf(!hasDatabaseUrl)(
    'falls back to text parsing when no structured exercises are present',
    async () => {
      const lessonId = await createLesson()
      const text = `\\begin{document}
\\textbf{תרגיל 1}
תוכן ראשון
\\section*{פתרון תרגיל 1}
פתרון
\\end{document}`
      await seedExtraction(lessonId, { text })

      const result = await createExercisesFromExtraction({
        payload,
        user: adminUser,
        lessonId,
      })

      expect('error' in result).toBe(false)
      if ('error' in result) return
      expect(result.source).toBe('legacy_text')
      expect(result.exerciseCount).toBe(1)
      createdExerciseIds.push(...result.exerciseIds)
    },
    30_000,
  )

  it.skipIf(!hasDatabaseUrl)(
    'reconciles lesson.blocks: drops stale context_extraction refs, preserves unrelated entries, appends new ones',
    async () => {
      const lessonId = await createLesson()

      // Pre-existing playlist with one unrelated exerciseRef + one
      // contentPageRef. Both should survive the reconcile. Exercise.content
      // requires at least one block, so seed with a trivial LaTeX block.
      const unrelatedExercise = await payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: 'Unrelated',
          content: {
            blocks: [{ id: 'unrel0', type: 'latex', latex: '$1$' }],
          },
          origin: 'manual',
          order: 0,
        } as any,
        draft: true,
        context: { _skipBlockSync: true } as any,
        overrideAccess: true,
      })
      createdExerciseIds.push(unrelatedExercise.id)

      const initialBlocks = [
        { id: 'a1b2c3', blockType: 'contentPageRef', contentPage: 'page-1' },
        { id: 'd4e5f6', blockType: 'exerciseRef', exercise: unrelatedExercise.id },
      ]

      await payload.update({
        collection: 'lessons',
        id: lessonId,
        data: { blocks: JSON.stringify(initialBlocks) } as any,
        overrideAccess: true,
      })

      // Run once to create context exercises and append their refs.
      await seedExtraction(lessonId, {
        text: '',
        exercises: [{ number: 1, latex: '$a$', solution: null }],
      })
      const first = await createExercisesFromExtraction({
        payload,
        user: adminUser,
        lessonId,
      })
      expect('error' in first).toBe(false)
      if ('error' in first) return
      createdExerciseIds.push(...first.exerciseIds)

      // Re-run: stale context refs should be dropped, new ones appended,
      // and the unrelated exerciseRef + contentPageRef must still be there.
      const second = await createExercisesFromExtraction({
        payload,
        user: adminUser,
        lessonId,
      })
      expect('error' in second).toBe(false)
      if ('error' in second) return
      createdExerciseIds.push(...second.exerciseIds)

      const lesson = (await payload.findByID({
        collection: 'lessons',
        id: lessonId,
        overrideAccess: true,
        depth: 0,
      })) as { blocks?: unknown }

      const blocks = JSON.parse(String(lesson.blocks ?? '[]'))
      const exerciseRefs = blocks.filter((b: any) => b.blockType === 'exerciseRef')
      const contentRefs = blocks.filter((b: any) => b.blockType === 'contentPageRef')

      expect(contentRefs).toHaveLength(1)
      expect(exerciseRefs.map((b: any) => b.exercise)).toContain(unrelatedExercise.id)
      // The first run's exercise must be gone; second run's exercise must be present.
      expect(exerciseRefs.map((b: any) => b.exercise)).not.toContain(first.exerciseIds[0])
      expect(exerciseRefs.map((b: any) => b.exercise)).toContain(second.exerciseIds[0])
    },
    60_000,
  )

  it.skipIf(!hasDatabaseUrl)(
    'surfaces a warning when malformed entries are skipped from the structured array',
    async () => {
      const lessonId = await createLesson()
      await seedExtraction(lessonId, {
        text: '',
        exercises: [
          { number: 1, latex: '$valid$', solution: null },
          { latex: 'missing-number' }, // no number — skipped
          { number: 3, latex: '' }, // empty latex — skipped
        ],
      })

      const result = await createExercisesFromExtraction({
        payload,
        user: adminUser,
        lessonId,
      })
      expect('error' in result).toBe(false)
      if ('error' in result) return
      expect(result.exerciseCount).toBe(1)
      expect(result.warnings.some((w) => w.includes('Skipped 2 malformed'))).toBe(true)
      createdExerciseIds.push(...result.exerciseIds)
    },
    30_000,
  )
})
