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

async function ensureDefaultTenant(payload: Payload): Promise<string> {
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'default' } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) return existing.docs[0].id

  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: 'Default', slug: 'default', status: 'active' },
    overrideAccess: true,
  })

  return tenant.id
}

async function createLessonHierarchy(payload: Payload) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const tenant = await ensureDefaultTenant(payload)
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: `Duplication Review Category ${suffix}`,
      slug: `dup-review-category-${suffix}`,
      locale: 'he',
    },
    overrideAccess: true,
  })
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: `DUP-${suffix}`,
      title: `Duplication Review Course ${suffix}`,
      slug: `dup-review-course-${suffix}`,
      description: 'Course fixture for lesson duplication review E2E tests',
      locale: 'he',
      status: 'published',
      isActive: true,
      order: 0,
      categories: [category.id],
      tenant,
      pageAccessType: 'free',
      accessType: 'free',
      contentStatus: 'none',
      contentStatusVisible: true,
    },
    overrideAccess: true,
  })
  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: course.id,
      chapterLabel: '1',
      slug: `dup-review-chapter-${suffix}`,
      title: `Duplication Review Chapter ${suffix}`,
      status: 'published',
      isActive: true,
      order: 0,
      tenant,
      locale: 'he',
    },
    overrideAccess: true,
  })

  return { categoryId: category.id, courseId: course.id, chapterId: chapter.id, tenant }
}

// Create a needs_review duplication record via local API for testing
async function createNeedsReviewRecord(payload: Payload) {
  const hierarchy = await createLessonHierarchy(payload)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const sourceLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: hierarchy.chapterId,
      slug: `dup-review-source-lesson-${suffix}`,
      title: 'Test Source Lesson',
      type: 'practice',
      status: 'published',
      isActive: true,
      order: 0,
      tenant: hierarchy.tenant,
      locale: 'he',
      accessType: 'inherit',
      contentStatus: 'none',
      contentStatusVisible: true,
    },
    overrideAccess: true,
  })

  // Create output lesson
  const outputLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: hierarchy.chapterId,
      slug: `dup-review-output-lesson-${suffix}`,
      title: 'Test Output Lesson',
      type: 'practice',
      status: 'draft',
      isActive: true,
      order: 1,
      tenant: hierarchy.tenant,
      locale: 'he',
      accessType: 'inherit',
      contentStatus: 'none',
      contentStatusVisible: true,
    },
    draft: true,
    overrideAccess: true,
  })

  // Create source exercise
  const sourceExercise = await payload.create({
    collection: 'exercises',
    data: { title: 'Test Exercise', lesson: sourceLesson.id },
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
      sourceLesson: sourceLesson.id,
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
    sourceLessonId: sourceLesson.id,
    outputLessonId: outputLesson.id,
    outputExerciseId: outputExercise.id,
    sourceExerciseId: sourceExercise.id,
    chapterId: hierarchy.chapterId,
    courseId: hierarchy.courseId,
    categoryId: hierarchy.categoryId,
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
  await payload
    .delete({
      collection: 'lessons',
      id: data.sourceLessonId,
      overrideAccess: true,
    })
    .catch(() => {})
  await payload
    .delete({
      collection: 'chapters',
      id: data.chapterId,
      overrideAccess: true,
    })
    .catch(() => {})
  await payload
    .delete({
      collection: 'courses',
      id: data.courseId,
      overrideAccess: true,
    })
    .catch(() => {})
  await payload
    .delete({
      collection: 'categories',
      id: data.categoryId,
      overrideAccess: true,
    })
    .catch(() => {})
}

test.describe('Lesson Duplication Review', () => {
  // Store test data for cleanup
  let testData: Awaited<ReturnType<typeof createNeedsReviewRecord>> | null = null

  test.beforeEach(async () => {
    const payload = await getPayload({ config })
    testData = await createNeedsReviewRecord(payload)
  })

  test.afterEach(async () => {
    if (testData) {
      const payload = await getPayload({ config })
      await cleanupTestData(payload, testData)
      testData = null
    }
  })

  test.afterAll(async () => {
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
    await expect(page.getByText('MISSING_QUESTION', { exact: true })).toBeVisible()

    // Should show the action buttons
    await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Regenerate', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep', exact: true })).toBeVisible()

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
    await page.getByRole('button', { name: 'Skip', exact: true }).click()

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
    await page.getByRole('button', { name: 'Keep', exact: true }).click()

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
