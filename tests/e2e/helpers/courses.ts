/**
 * Test helpers for course and lesson data
 */
import config from '@payload-config'
import { getPayload } from 'payload'

export interface TestCourseData {
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  courseId: string
  chapterId: string
  lessonId: string
}

/**
 * Seed test course data if it doesn't exist
 * Creates a test course with a chapter and lesson, all published and active
 */
export async function seedTestCourseData(): Promise<TestCourseData | null> {
  try {
    const payload = await getPayload({ config })

    // Check if test course already exists
    const existing = await getTestCourseData()
    if (existing) {
      console.log('Test course data already exists, skipping seed')
      return existing
    }

    console.log('Seeding test course data...')

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

    // Create test course
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'TEST',
        title: 'Test Course for E2E',
        description: 'A test course created for E2E testing',
        status: 'published',
        isActive: true,
        order: 0,
        categories: [category.id],
      },
    })

    // Create test chapter with unique slug to avoid conflicts
    const timestamp = Date.now()
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        course: course.id,
        chapterLabel: '1',
        slug: `test-chapter-${timestamp}`,
        title: 'Test Chapter',
        description: 'A test chapter created for E2E testing',
        status: 'published',
        isActive: true,
        order: 0,
      },
    })

    // Create test lesson
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapter.id,
        title: 'Test Lesson',
        description: 'A test lesson created for E2E testing',
        status: 'published',
        isActive: true,
        order: 0,
      },
    })

    // Validate slugs exist
    if (!course.slug || !chapter.slug || !lesson.slug) {
      throw new Error('Course, chapter, or lesson missing slug field after creation')
    }

    console.log('Test course data seeded successfully')

    return {
      courseSlug: course.slug,
      chapterSlug: chapter.slug,
      lessonSlug: lesson.slug,
      courseId: course.id,
      chapterId: chapter.id,
      lessonId: lesson.id,
    }
  } catch (error) {
    console.error('Error seeding test course data:', error)
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
      console.warn('No published courses found in database')
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
      console.warn(`No published chapters found for course: ${course.slug}`)
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
      console.warn(`No published lessons found for chapter: ${chapter.slug}`)
      return null
    }

    const lesson = lessons.docs[0]

    // Validate slugs exist (required fields but TypeScript doesn't know)
    if (!course.slug || !chapter.slug || !lesson.slug) {
      throw new Error('Course, chapter, or lesson missing slug field')
    }

    return {
      courseSlug: course.slug,
      chapterSlug: chapter.slug,
      lessonSlug: lesson.slug,
      courseId: course.id,
      chapterId: chapter.id,
      lessonId: lesson.id,
    }
  } catch (error) {
    console.error('Error fetching test course data:', error)
    return null
  }
}

/**
 * Build lesson URL from course data
 */
export function buildLessonUrl(data: TestCourseData): string {
  return `/courses/${data.courseSlug}/chapters/${data.chapterSlug}/lessons/${data.lessonSlug}`
}
