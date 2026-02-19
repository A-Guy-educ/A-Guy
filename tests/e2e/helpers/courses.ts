/**
 * Test helpers for course and lesson data
 */
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { logger } from '@/infra/utils/logger'

export interface TestCourseData {
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  courseId: string
  chapterId: string
  lessonId: string
}

/**
 * Generate a unique slug with random suffix to avoid conflicts
 */
function generateUniqueSlug(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}`
}

async function ensureDefaultTenant(payload: Payload): Promise<string> {
  const slug = getDefaultTenantSlug()
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    return existing.docs[0].id
  }

  const created = await payload.create({
    collection: 'tenants',
    data: { name: slug, slug, status: 'active' },
    overrideAccess: true,
  })

  return created.id
}

/**
 * Delete existing test data to avoid unique constraint violations
 * Uses depth: 0 to avoid populating relationships that may cause null reference errors
 */
async function cleanupTestData(payload: Payload): Promise<void> {
  // Delete in reverse order to avoid relationship issues: lessons → chapters → courses
  // Use depth: 0 to avoid populating relationships during cleanup

  // Find and delete test lessons
  const lessons = await payload.find({
    collection: 'lessons',
    where: {
      slug: {
        like: 'test-lesson-',
      },
    },
    limit: 100,
    depth: 0,
  })

  for (const lesson of lessons.docs) {
    try {
      await payload.delete({
        collection: 'lessons',
        id: lesson.id,
      })
    } catch {
      // Ignore errors - document may already be deleted
    }
  }

  // Find and delete test chapters
  const chapters = await payload.find({
    collection: 'chapters',
    where: {
      slug: {
        like: 'test-chapter-',
      },
    },
    limit: 100,
    depth: 0,
  })

  for (const chapter of chapters.docs) {
    try {
      await payload.delete({
        collection: 'chapters',
        id: chapter.id,
      })
    } catch {
      // Ignore errors - document may already be deleted
    }
  }

  // Delete test courses (by prefix)
  const courses = await payload.find({
    collection: 'courses',
    where: {
      slug: {
        like: 'test-course-',
      },
    },
    limit: 100,
    depth: 0,
  })

  for (const course of courses.docs) {
    try {
      await payload.delete({
        collection: 'courses',
        id: course.id,
      })
    } catch {
      // Ignore errors - document may already be deleted
    }
  }
}

/**
 * Seed test course data if it doesn't exist
 * Creates a test course with a chapter and lesson, all published and active
 */
export async function seedTestCourseData(): Promise<TestCourseData | null> {
  try {
    const payload = await getPayload({ config })

    // Clean up any existing test data first
    await cleanupTestData(payload)

    logger.info('Seeding test course data...')

    // Get or create a test category
    let category
    const categories = await payload.find({
      collection: 'categories',
      where: {
        title: {
          equals: 'Test Category',
        },
      },
      limit: 1,
    })

    if (categories.docs.length > 0) {
      category = categories.docs[0]
    } else {
      category = await payload.create({
        collection: 'categories',
        data: {
          title: 'Test Category',
          slug: 'test-category',
        },
        draft: false,
      })
    }

    // Create test course with unique slug
    const courseSlug = generateUniqueSlug('test-course')
    const tenantId = await ensureDefaultTenant(payload)
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'TEST',
        title: 'Test Course for E2E',
        slug: courseSlug,
        description: 'A test course created for E2E testing',
        status: 'published',
        isActive: true,
        order: 0,
        categories: [category.id],
        tenant: tenantId,
        pageAccessType: 'free',
        accessType: 'free',
      },
    })

    // Create test chapter with unique slug
    const chapterSlug = generateUniqueSlug('test-chapter')
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        course: course.id,
        chapterLabel: '1',
        slug: chapterSlug,
        title: 'Test Chapter',
        description: 'A test chapter created for E2E testing',
        status: 'published',
        isActive: true,
        order: 0,
        tenant: tenantId,
      },
    })

    // Create test lesson with unique slug
    const lessonSlug = generateUniqueSlug('test-lesson')
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapter.id,
        slug: lessonSlug,
        title: 'Test Lesson',
        description: 'A test lesson created for E2E testing',
        type: 'learning',
        status: 'published',
        isActive: true,
        order: 0,
        tenant: tenantId,
        accessType: 'inherit',
      },
    })

    logger.info('Test course data seeded successfully')

    return {
      courseSlug: course.slug!,
      chapterSlug: chapter.slug!,
      lessonSlug: lesson.slug!,
      courseId: course.id,
      chapterId: chapter.id,
      lessonId: lesson.id,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    logger.error({ err, message: err.message, stack: err.stack }, 'Error seeding test course data')
    return null
  }
}

/**
 * Get the first available published course with chapters and lessons
 * Returns null if no suitable course data is available
 */
export async function getTestCourseData(): Promise<TestCourseData | null> {
  try {
    const payload = await getPayload({ config })

    // Get first published course
    const courses = await payload.find({
      collection: 'courses',
      where: {
        and: [
          {
            status: {
              equals: 'published',
            },
          },
          {
            isActive: {
              equals: true,
            },
          },
        ],
      },
      limit: 1,
      depth: 2,
    })

    if (courses.docs.length === 0) {
      logger.warn('No published courses found in database')
      return null
    }

    const course = courses.docs[0]

    // Get first chapter
    const chapters = await payload.find({
      collection: 'chapters',
      where: {
        and: [
          {
            course: {
              equals: course.id,
            },
          },
          {
            status: {
              equals: 'published',
            },
          },
          {
            isActive: {
              equals: true,
            },
          },
        ],
      },
      limit: 1,
      depth: 1,
    })

    if (chapters.docs.length === 0) {
      logger.warn({ courseSlug: course.slug }, 'No published chapters found for course')
      return null
    }

    const chapter = chapters.docs[0]

    // Get first lesson
    const lessons = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          {
            chapter: {
              equals: chapter.id,
            },
          },
          {
            status: {
              equals: 'published',
            },
          },
          {
            isActive: {
              equals: true,
            },
          },
        ],
      },
      limit: 1,
      depth: 1,
    })

    if (lessons.docs.length === 0) {
      logger.warn({ chapterSlug: chapter.slug }, 'No published lessons found for chapter')
      return null
    }

    const lesson = lessons.docs[0]

    return {
      courseSlug: course.slug!,
      chapterSlug: chapter.slug!,
      lessonSlug: lesson.slug!,
      courseId: course.id,
      chapterId: chapter.id,
      lessonId: lesson.id,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    logger.error({ err }, 'Error fetching test course data')
    return null
  }
}

/**
 * Build lesson URL from course data
 */
export function buildLessonUrl(data: TestCourseData): string {
  return `/courses/${data.courseSlug}/chapters/${data.chapterSlug}/lessons/${data.lessonSlug}`
}
