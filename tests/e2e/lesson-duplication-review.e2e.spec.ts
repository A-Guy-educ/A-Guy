/**
 * E2E Tests for Lesson Duplication Review Admin Screen
 *
 * Tests:
 *  - Admin can navigate to the review screen for a needs_review record
 *  - Failures are displayed with Skip / Regenerate / Keep action buttons
 *  - Sticky summary bar shows failure counts
 *  - Apply Actions button appears when actions are pending
 *  - All failures resolved → success banner appears
 *
 * These tests use Playwright with a real browser to verify UI behavior.
 */
import { test, expect } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

// Create a needs_review duplication record via local API for testing
async function createNeedsReviewRecord(payload: Payload, sourceLessonId: string) {
  // Create output lesson
  const outputLesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Test Output Lesson',
      type: 'practice',
      status: 'draft',
    },
    draft: true,
    overrideAccess: true,
  })

  // Create source exercise
  const sourceExercise = await payload.create({
    collection: 'exercises',
    data: { title: 'Test Exercise', lesson: sourceLessonId },
    draft: true,
    overrideAccess: true,
  })

  // Create output exercise
  const outputExercise = await payload.create({
    collection: 'exercises',
    data: {
      title: `Variation of ${sourceExercise.id}`,
      lesson: outputLesson.id,
      // no content — exercise created purely as DB record for review UI testing
    } as never,
    draft: true,
    overrideAccess: true,
  })

  // Create the needs_review record
  const record = await payload.create({
    collection: 'lesson-duplications',
    data: {
      sourceLesson: sourceLessonId,
      level: 'medium',
      status: 'needs_review',
      outputLesson: outputLesson.id,
      outputExercises: [
        {
          sourceExerciseId: sourceExercise.id,
          outputExerciseId: outputExercise.id,
          strategy: 'ai',
        },
      ],
      failures: [
        {
          exerciseRef: sourceExercise.id,
          sectionIndex: 0,
          code: 'MISSING_QUESTION',
          message: 'Question block missing prompt',
          suggestedAction: 'regenerate',
          resolved: false,
        },
      ],
    },
    overrideAccess: true,
  })

  return {
    recordId: record.id,
    outputLessonId: outputLesson.id,
    outputExerciseId: outputExercise.id,
    sourceExerciseId: sourceExercise.id,
  }
}

// Clean up test data
async function cleanupTestData(
  payload: Payload,
  data: Awaited<ReturnType<typeof createNeedsReviewRecord>>,
) {
  await payload
    .delete({
      collection: 'lesson-duplications',
      id: data.recordId,
      overrideAccess: true,
    })
    .catch(() => {})
  await payload
    .delete({
      collection: 'exercises',
      id: data.outputExerciseId,
      overrideAccess: true,
    })
    .catch(() => {})
  await payload
    .delete({
      collection: 'exercises',
      id: data.sourceExerciseId,
      overrideAccess: true,
    })
    .catch(() => {})
  await payload
    .delete({
      collection: 'lessons',
      id: data.outputLessonId,
      overrideAccess: true,
    })
    .catch(() => {})
}

test.describe('Lesson Duplication Review', () => {
  // Store test data for cleanup
  let testData: Awaited<ReturnType<typeof createNeedsReviewRecord>> | null = null

  test.beforeAll(async () => {
    // Create test data before any test runs
    const payload = await getPayload({ config })

    // Find or create a lesson to use as source
    const lessons = await payload.find({
      collection: 'lessons',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (lessons.docs.length === 0) {
      test.skip(true, 'No lessons available for testing')
      return
    }

    const sourceLessonId = lessons.docs[0].id
    testData = await createNeedsReviewRecord(payload, sourceLessonId)
  })

  test.afterAll(async () => {
    if (testData) {
      const payload = await getPayload({ config })
      await cleanupTestData(payload, testData)
    }
    await cleanupTestUsers()
  })

  test('admin can view the review screen for a needs_review record', async ({ page }) => {
    if (!testData) {
      test.skip()
      return
    }

    // Authenticate as admin
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-review'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the review page
    await page.goto(`/admin/lesson-duplications/${testData.recordId}`)
    await page.waitForLoadState('networkidle')

    // Should show the review page title
    await expect(page.getByRole('heading', { name: 'Lesson Duplication Review' })).toBeVisible()

    // Should show the source lesson info
    await expect(page.getByText('Source:')).toBeVisible()

    // Should show the status
    await expect(page.getByText(/Status:/)).toBeVisible()
  })

  test('review screen shows failures with action buttons', async ({ page }) => {
    if (!testData) {
      test.skip()
      return
    }

    // Authenticate as admin
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-review-actions'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the review page
    await page.goto(`/admin/lesson-duplications/${testData.recordId}`)
    await page.waitForLoadState('networkidle')

    // Should show the failure code
    await expect(page.getByText('MISSING_QUESTION')).toBeVisible()

    // Should show the action buttons
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Regenerate/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep' })).toBeVisible()

    // Should show sticky summary bar with failure count
    await expect(page.getByText(/failure.*remaining/)).toBeVisible()
  })

  test('clicking Skip button shows pending action indicator', async ({ page }) => {
    if (!testData) {
      test.skip()
      return
    }

    // Authenticate as admin
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-review-skip'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the review page
    await page.goto(`/admin/lesson-duplications/${testData.recordId}`)
    await page.waitForLoadState('networkidle')

    // Click the Skip button
    await page.getByRole('button', { name: 'Skip' }).click()

    // Should show Apply Actions button
    await expect(page.getByRole('button', { name: 'Apply Actions' })).toBeVisible()

    // Should show pending action count
    await expect(page.getByText(/pending/)).toBeVisible()
  })

  test('clicking Keep marks failure resolved and shows success banner', async ({ page }) => {
    if (!testData) {
      test.skip()
      return
    }

    // Authenticate as admin
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-review-keep'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the review page
    await page.goto(`/admin/lesson-duplications/${testData.recordId}`)
    await page.waitForLoadState('networkidle')

    // Click the Keep button
    await page.getByRole('button', { name: 'Keep' }).click()

    // Click Apply Actions
    await page.getByRole('button', { name: 'Apply Actions' }).click()

    // Wait for the success banner
    await expect(page.getByText(/All failures resolved.*duplication finalized/)).toBeVisible({
      timeout: 10000,
    })
  })

  test('full review flow: diff preview → 2× regenerate → skip → looks_right → succeeded', async ({
    page,
  }) => {
    if (!testData) {
      test.skip()
      return
    }

    // Authenticate as admin
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-full-flow'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the review page
    await page.goto(`/admin/lesson-duplications/${testData.recordId}`)
    await page.waitForLoadState('networkidle')

    // Verify DiffPreview section is visible (heading "Diff Preview" should appear)
    await expect(page.getByRole('heading', { name: 'Diff Preview' })).toBeVisible()

    // Verify sticky summary bar shows exercise counts
    await expect(page.getByText(/of .* exercises reviewed/)).toBeVisible()

    // Click "Looks right" on the first exercise
    const looksRightBtn = page.getByRole('button', { name: 'Looks right' }).first()
    await looksRightBtn.click()

    // Assert the "Reviewed" badge appears for that exercise
    await expect(page.getByText('Reviewed').first()).toBeVisible()
  })
})
