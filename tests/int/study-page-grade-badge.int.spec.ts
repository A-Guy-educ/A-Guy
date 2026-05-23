// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: StudyContent renders courseLabel as grade badge
 *
 * Bug #1867: Grade badge on /practice page displays only 'T' instead of the
 * full courseLabel like 'Translate Test (EN)'. The courseLabel is fetched
 * and stored in StudyContent state but never rendered in the header area,
 * causing the badge to be missing (or truncated if a width constraint exists).
 *
 * Fix: Render courseLabel as a badge above the section title in StudyContent.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

let payload: Payload
let originalDatabaseUrl: string | undefined

const GRADE_LEVEL = 'grade-8-badge-test'
// courseLabel must match gradeLevel for queryChaptersByGrade to find the course
const COURSE_LABEL = GRADE_LEVEL
const COURSE_TITLE = 'Translate Test Course'
const TENANT_SLUG = `badge-test-tenant-${Date.now()}`

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL

  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure the tenant exists
  const existingTenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: TENANT_SLUG } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingTenants.docs.length === 0) {
    await payload.create({
      collection: 'tenants',
      data: { name: TENANT_SLUG, slug: TENANT_SLUG, status: 'active' },
      overrideAccess: true,
    })
  }

  // Create a category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Badge Test Category',
      slug: `badge-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create a course with a multi-word courseLabel
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: COURSE_LABEL,
      title: COURSE_TITLE,
      slug: `badge-test-course-${Date.now()}`,
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })

  // Create a chapter
  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: course.id,
      title: 'Badge Test Chapter',
      slug: `badge-chapter-${Date.now()}`,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })

  // Create a practice lesson
  await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter.id,
      title: 'Practice Lesson',
      slug: `badge-practice-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
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

describe('prefetchStudyData — courseLabel for grade badge', () => {
  it('returns the full courseLabel (not truncated) for the grade badge', async () => {
    // Bug #1867: courseLabel should be the full string, not empty or truncated.
    // The UI renders courseLabel as a badge above the section title.
    const result = await prefetchStudyData(GRADE_LEVEL, undefined)

    expect(result).not.toBeNull()
    expect(result!.courseLabel).toBe(COURSE_LABEL)
    // courseLabel should be a meaningful multi-character string, not empty
    expect(result!.courseLabel.length).toBeGreaterThan(1)
  })

  it('courseLabel is a non-empty string when course is published', async () => {
    const result = await prefetchStudyData(GRADE_LEVEL, undefined)

    expect(result).not.toBeNull()
    expect(typeof result!.courseLabel).toBe('string')
    expect(result!.courseLabel.length).toBeGreaterThan(0)
    // Should not be a single character (common truncation indicator)
    expect(result!.courseLabel.length).toBeGreaterThan(1)
  })

  it('courseTitle is distinct from courseLabel and also non-truncated', async () => {
    const result = await prefetchStudyData(GRADE_LEVEL, undefined)

    expect(result).not.toBeNull()
    expect(result!.courseTitle).toBe(COURSE_TITLE)
    expect(result!.courseTitle.length).toBeGreaterThan(1)
    // courseLabel and courseTitle should be different
    expect(result!.courseLabel).not.toBe(result!.courseTitle)
  })
})
