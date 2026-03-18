/**
 * Shared Playwright fixtures for pre-launch verification tests.
 * Each spec file seeds its own data and cleans up only what it created.
 */
import type { Page } from '@playwright/test'

import type { TestCourseData } from './courses'
import type { TestExerciseData } from './admin'
import { generateTestUserEmail, setupAuthenticatedUser, cleanupTestUsers } from './auth'
import { seedTestCourseData, buildLessonUrl } from './courses'
import { seedTestExercises, cleanupTestExercisesById } from './admin'

export interface VerificationData {
  course: TestCourseData
  exercises: TestExerciseData[]
  lessonUrl: string
}

/**
 * Seed fresh verification data for the calling spec file.
 * Each file gets its own independent data — no shared singleton.
 */
export async function seedVerificationData(): Promise<VerificationData | null> {
  const course = await seedTestCourseData()
  if (!course) return null

  const exercises = await seedTestExercises(course)
  const lessonUrl = buildLessonUrl(course)

  return { course, exercises, lessonUrl }
}

/**
 * Clean up only the specific data that was seeded.
 */
export async function cleanupVerificationData(data: VerificationData | null): Promise<void> {
  if (data) {
    const ids = data.exercises.map((e) => e.exerciseId)
    await cleanupTestExercisesById(ids)
  }
  await cleanupTestUsers()
}

/**
 * Helper: set up an authenticated student on a page.
 */
export async function loginAsStudent(page: Page) {
  return setupAuthenticatedUser(
    page,
    {
      email: generateTestUserEmail('verify-student'),
      password: 'TestPass123!',
    },
    'student',
  )
}

/**
 * Helper: set up an authenticated admin on a page.
 */
export async function loginAsAdmin(page: Page) {
  return setupAuthenticatedUser(
    page,
    {
      email: generateTestUserEmail('verify-admin'),
      password: 'AdminPass123!',
    },
    'admin',
  )
}
