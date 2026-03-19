/**
 * Admin helpers for pre-launch verification E2E tests.
 * Provides seeding and cleanup utilities for test exercises.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import type { TestCourseData } from './courses'
import {
  buildFreeResponseExercise,
  buildMatchingExercise,
  buildMcqExercise,
  buildTableExercise,
} from './exercise-builders'

export interface TestExerciseData {
  exerciseId: string
  exerciseSlug: string
}

/**
 * Seed exercises with various question types for a given lesson.
 */
export async function seedTestExercises(courseData: TestCourseData): Promise<TestExerciseData[]> {
  const payload = await getPayload({ config })
  const exercises: TestExerciseData[] = []

  const configs = [
    { title: 'MCQ Exercise', content: buildMcqExercise() },
    { title: 'Free Response Exercise', content: buildFreeResponseExercise() },
    { title: 'Matching Exercise', content: buildMatchingExercise() },
    { title: 'Table Exercise', content: buildTableExercise() },
  ]

  for (const cfg of configs) {
    const slug = `test-ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ex = await payload.create({
      collection: 'exercises',
      data: {
        title: cfg.title,
        slug,
        lesson: courseData.lessonId,
        status: 'published',
        exerciseContent: cfg.content,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      draft: false,
    })
    exercises.push({ exerciseId: ex.id, exerciseSlug: ex.slug || slug })
  }

  return exercises
}

/**
 * Build URL for a specific exercise within a lesson.
 */
export function buildExerciseUrl(courseData: TestCourseData, exerciseSlug: string): string {
  const base = `/courses/${courseData.courseSlug}/chapters/${courseData.chapterSlug}/lessons/${courseData.lessonSlug}`
  return `${base}/exercises/${exerciseSlug}`
}

/**
 * Clean up specific test exercises by their IDs.
 * Only deletes the exercises that were seeded by the calling test file.
 */
export async function cleanupTestExercisesById(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const payload = await getPayload({ config })
  for (const id of ids) {
    try {
      await payload.delete({ collection: 'exercises', id, overrideAccess: true })
    } catch {
      // ignore cleanup errors
    }
  }
}
