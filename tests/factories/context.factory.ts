import type { Payload } from 'payload'
import { DEFAULT_CONTENT } from '@/server/payload/collections/Exercises/defaults'

export interface ContextHierarchy {
  categoryId: string
  courseId: string
  chapterId: string
  lessonId: string
  exerciseId: string
  cleanup: () => Promise<void>
}

export async function createContextHierarchy(payload: Payload): Promise<ContextHierarchy> {
  const timestamp = Date.now()

  const category = await payload.create({
    collection: 'categories',
    data: {
      title: `Test Category ${timestamp}`,
      slug: `test-category-${timestamp}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'Test',
      title: `Test Course ${timestamp}`,
      slug: `test-course-${timestamp}`,
      order: 0,
      status: 'published',
      isActive: true,
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: course.id,
      title: `Test Chapter ${timestamp}`,
      slug: `test-chapter-${timestamp}`,
      order: 0,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })

  const lesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter.id,
      title: `Test Lesson ${timestamp}`,
      slug: `test-lesson-${timestamp}`,
      type: 'learning',
      order: 0,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })

  const exercise = await payload.create({
    collection: 'exercises',
    data: {
      title: `Test Exercise ${timestamp}`,
      slug: `test-exercise-${timestamp}`,
      order: 0,
      lesson: lesson.id,
      content: DEFAULT_CONTENT(),
    } as any,
    overrideAccess: true,
  })

  const cleanup = async () => {
    await payload.delete({ collection: 'exercises', id: exercise.id, overrideAccess: true })
    await payload.delete({ collection: 'lessons', id: lesson.id, overrideAccess: true })
    await payload.delete({ collection: 'chapters', id: chapter.id, overrideAccess: true })
    await payload.delete({ collection: 'courses', id: course.id, overrideAccess: true })
    await payload.delete({ collection: 'categories', id: category.id, overrideAccess: true })
  }

  return {
    categoryId: category.id,
    courseId: course.id,
    chapterId: chapter.id,
    lessonId: lesson.id,
    exerciseId: exercise.id,
    cleanup,
  }
}
