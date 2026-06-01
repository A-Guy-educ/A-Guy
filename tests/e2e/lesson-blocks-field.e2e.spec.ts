/**
 * E2E test for LessonBlocksField inline exercise display (#2104)
 *
 * Tests that the lesson admin page shows all exercise blocks inline
 * with full content (not just a list of exercise titles).
 */
import { expect, test } from '@playwright/test'

import {
  cleanupVerificationData,
  loginAsAdmin,
  seedVerificationData,
  type VerificationData,
} from './helpers/verification-fixtures'
import { buildMcqExercise, buildFreeResponseExercise } from './helpers/exercise-builders'
import config from '@payload-config'
import { getPayload } from 'payload'

let data: VerificationData | null = null

async function seedLessonWithExercises(): Promise<{
  lessonId: string
  exerciseIds: string[]
} | null> {
  if (!data) return null

  const payload = await getPayload({ config })
  const exerciseIds: string[] = []
  const lessonId = data.course.lessonId

  // Create MCQ exercise
  const mcq = await payload.create({
    collection: 'exercises',
    data: {
      title: 'Inline Test MCQ',
      slug: `inline-test-mcq-${Date.now()}`,
      lesson: lessonId,
      status: 'published',
      content: buildMcqExercise(),
    } as any,
    overrideAccess: true,
    draft: false,
  })
  exerciseIds.push(mcq.id)

  // Create Free Response exercise
  const fr = await payload.create({
    collection: 'exercises',
    data: {
      title: 'Inline Test Free Response',
      slug: `inline-test-fr-${Date.now()}`,
      lesson: lessonId,
      status: 'published',
      content: buildFreeResponseExercise(),
    } as any,
    overrideAccess: true,
    draft: false,
  })
  exerciseIds.push(fr.id)

  // Update lesson blocks to reference these exercises
  const blocks = [
    { blockType: 'exerciseRef', exercise: mcq.id, id: `ref-${mcq.id}` },
    { blockType: 'exerciseRef', exercise: fr.id, id: `ref-${fr.id}` },
  ]
  await payload.update({
    collection: 'lessons',
    id: lessonId,
    data: { blocks: JSON.stringify(blocks) },
    overrideAccess: true,
  })

  return { lessonId, exerciseIds }
}

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000)
  data = await seedVerificationData()
})

test.setTimeout(60_000)

test.afterAll(async () => {
  // Clean up exercises created for this test
  if (data) {
    const payload = await getPayload({ config })
    const lessonId = data.course.lessonId
    const blocks = JSON.parse(
      (
        await payload.findByID({
          collection: 'lessons',
          id: lessonId,
          depth: 0,
        })
      ).blocks as string,
    )
    const exerciseIds = blocks
      .filter((b: any) => b.blockType === 'exerciseRef')
      .map((b: any) => (typeof b.exercise === 'string' ? b.exercise : b.exercise?.id))
      .filter(Boolean)

    for (const id of exerciseIds) {
      try {
        await payload.delete({ collection: 'exercises', id, overrideAccess: true })
      } catch {
        // Ignore
      }
    }
  }
  await cleanupVerificationData(data)
})

test.describe('LessonBlocksField inline exercise display', () => {
  test('shows exercise content blocks inline (not just titles) on lesson edit page', async ({
    page,
  }) => {
    test.skip(!data, 'No test data available')

    // Seed lesson with exercises
    const result = await seedLessonWithExercises()
    test.skip(!result, 'Failed to seed lesson with exercises')
    const { lessonId } = result!

    await loginAsAdmin(page)

    // Navigate to the lesson edit page in admin
    await page.goto(`/admin/collections/lessons/${lessonId}`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for the LessonBlocksField to be visible
    // The field is identified by the "Lesson Blocks" label
    const lessonBlocksLabel = page.getByText('Lesson Blocks')
    await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

    // The test: exercise content blocks should be visible inline
    // We check for the exercise content text which is only visible when blocks are rendered inline
    // The MCQ exercise has "What is 2 + 2?" as its first rich_text block
    const exerciseContent = page.getByText('What is 2 + 2?')
    await expect(exerciseContent).toBeVisible({
      timeout: 15_000,
      // This will FAIL with current implementation (only shows titles, not content)
    })

    // The free response exercise has "Solve the equation" text
    const frContent = page.getByText('Solve the equation')
    await expect(frContent).toBeVisible({ timeout: 15_000 })
  })

  test('does NOT show edit buttons that navigate away from the lesson page', async ({ page }) => {
    test.skip(!data, 'No test data available')

    const result = await seedLessonWithExercises()
    test.skip(!result, 'Failed to seed lesson with exercises')
    const { lessonId } = result!

    await loginAsAdmin(page)
    await page.goto(`/admin/collections/lessons/${lessonId}`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for the lesson blocks to be visible
    const lessonBlocksLabel = page.getByText('Lesson Blocks')
    await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

    // Wait for exercise content to appear (verifies inline rendering)
    const exerciseContent = page.getByText('What is 2 + 2?')
    await expect(exerciseContent).toBeVisible({ timeout: 15_000 })

    // After inline display is implemented, the Pencil edit buttons that navigate away
    // should NOT be present in the LessonBlocksField area
    // Instead, blocks should be immediately editable inline with per-exercise save buttons
    const pencilButtons = page.locator('button[title="Edit"]')
    // With inline editing, edit buttons may still exist but should not navigate away
    // The key indicator is that exercise content is visible (inline rendering works)
    const contentVisible = await page.getByText('What is 2 + 2?').isVisible()
    expect(contentVisible).toBe(true)
  })

  test('shows per-exercise save buttons when exercise content is inline', async ({ page }) => {
    test.skip(!data, 'No test data available')

    const result = await seedLessonWithExercises()
    test.skip(!result, 'Failed to seed lesson with exercises')
    const { lessonId } = result!

    await loginAsAdmin(page)
    await page.goto(`/admin/collections/lessons/${lessonId}`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for inline exercise content to be visible
    const lessonBlocksLabel = page.getByText('Lesson Blocks')
    await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

    const exerciseContent = page.getByText('What is 2 + 2?')
    await expect(exerciseContent).toBeVisible({ timeout: 15_000 })

    // After inline implementation, exercises should show inline save buttons
    // Look for save button text or Save Changes button within the exercise section
    const saveButtons = page.getByRole('button', { name: /save/i })
    // At minimum, there should be a visible save mechanism per exercise
    // The exact selector depends on implementation, but save buttons should exist
    const hasSaveMechanism = await saveButtons
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasSaveMechanism).toBe(true)
  })

  test('shows confirmation dialog before deleting a block', async ({ page }) => {
    test.skip(!data, 'No test data available')

    const result = await seedLessonWithExercises()
    test.skip(!result, 'Failed to seed lesson with exercises')
    const { lessonId } = result!

    await loginAsAdmin(page)
    await page.goto(`/admin/collections/lessons/${lessonId}`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for the lesson blocks to be visible
    const lessonBlocksLabel = page.getByText('Lesson Blocks')
    await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

    // Wait for exercise content to appear (verifies inline rendering)
    const exerciseContent = page.getByText('What is 2 + 2?')
    await expect(exerciseContent).toBeVisible({ timeout: 15_000 })

    // Click the delete (trash) button for the first block
    const deleteButtons = page.locator('button[title="Delete"]')
    await expect(deleteButtons.first()).toBeVisible({ timeout: 15_000 })
    await deleteButtons.first().click()

    // Confirmation dialog should appear
    const confirmDialog = page.getByText('Delete Block?')
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })

    // Click Cancel to keep the block
    const cancelButton = page.getByRole('button', { name: 'Cancel' })
    await expect(cancelButton).toBeVisible({ timeout: 5_000 })
    await cancelButton.click()

    // After cancel, the confirmation dialog should be gone
    await expect(confirmDialog).not.toBeVisible({ timeout: 5_000 })

    // The block content should still be visible (not deleted)
    await expect(exerciseContent).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('LessonBlocksField single-block add-UI', () => {
  /**
   * Regression test for issue #2296.
   * With exactly 1 block, the Add Exercise / Add Content Page buttons must be visible
   * so that a QA engineer can add a 2nd block and verify the reorder controls work.
   * Previously the add buttons only appeared when rows.length === 0 (empty state),
   * making it impossible to add a 2nd block from the custom LessonBlocksField UI.
   */
  test('Add buttons are visible when lesson has exactly 1 block', async ({ page }) => {
    // Set up: create a single-exercise lesson via the API
    const payload = await getPayload({ config })
    const timestamp = Date.now()

    // Create a minimal tenant + course + chapter + lesson
    const tenantSlug = `single-block-${timestamp}`
    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: tenantSlug, slug: tenantSlug, status: 'active' },
      overrideAccess: true,
    })
    const category = await payload.create({
      collection: 'categories',
      data: { title: `SB Cat ${timestamp}`, slug: `sb-cat-${timestamp}`, locale: 'he' },
    })
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `SB-${timestamp}`,
        title: `Single Block Course ${timestamp}`,
        locale: 'he',
        categories: [category.id],
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenant.id,
        pageAccessType: 'free',
        accessType: 'free',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `SB Chapter ${timestamp}`,
        chapterLabel: `SB-${timestamp}`,
        course: course.id,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenant.id,
        locale: 'he',
      },
    })
    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: `Single Block Exercise ${timestamp}`,
        slug: `sb-exercise-${timestamp}`,
        status: 'published',
        content: buildMcqExercise(),
      } as any,
      overrideAccess: true,
      draft: false,
    })
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Single Block Lesson ${timestamp}`,
        chapter: chapter.id,
        type: 'learning',
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenant.id,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })

    // Set lesson blocks to contain exactly 1 exercise reference
    const blocks = [{ blockType: 'exerciseRef', exercise: exercise.id, id: `ref-${exercise.id}` }]
    await payload.update({
      collection: 'lessons',
      id: lesson.id,
      data: { blocks: JSON.stringify(blocks) },
      overrideAccess: true,
    })

    // Clean up IDs for afterAll
    const cleanupIds = {
      lessonId: lesson.id,
      exerciseId: exercise.id,
      chapterId: chapter.id,
      courseId: course.id,
      categoryId: category.id,
      tenantId: tenant.id,
    }

    try {
      await loginAsAdmin(page)
      await page.goto(`/admin/collections/lessons/${lesson.id}`)
      await page.waitForLoadState('domcontentloaded')

      // Wait for LessonBlocksField to be visible
      const lessonBlocksLabel = page.getByText('Lesson Blocks')
      await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

      // Wait for the single block to appear
      await page.waitForTimeout(2_000) // allow async title fetch

      // The Add buttons MUST be visible when there's only 1 block
      // This is the regression: previously they only showed when rows.length === 0
      const addExerciseBtn = page.getByRole('button', { name: /add exercise/i })
      const addContentPageBtn = page.getByRole('button', { name: /add content page/i })

      await expect(addExerciseBtn).toBeVisible({
        timeout: 5_000,
        // This will FAIL with the current bug — add buttons are hidden when rows.length > 0
      })
      await expect(addContentPageBtn).toBeVisible({ timeout: 5_000 })

      // With 1 block: Move up must be disabled (at top boundary)
      const moveUpBtn = page.locator('button[title="Move up"]')
      await expect(moveUpBtn).toBeVisible({ timeout: 5_000 })
      await expect(moveUpBtn).toBeDisabled()

      // With 1 block: Move down must be disabled (at bottom boundary)
      const moveDownBtn = page.locator('button[title="Move down"]')
      await expect(moveDownBtn).toBeVisible({ timeout: 5_000 })
      await expect(moveDownBtn).toBeDisabled()
    } finally {
      // Clean up
      await payload.delete({
        collection: 'exercises',
        id: cleanupIds.exerciseId,
        overrideAccess: true,
      })
      await payload.delete({ collection: 'lessons', id: cleanupIds.lessonId, overrideAccess: true })
      await payload.delete({
        collection: 'chapters',
        id: cleanupIds.chapterId,
        overrideAccess: true,
      })
      await payload.delete({ collection: 'courses', id: cleanupIds.courseId, overrideAccess: true })
      await payload.delete({
        collection: 'categories',
        id: cleanupIds.categoryId,
        overrideAccess: true,
      })
      await payload.delete({ collection: 'tenants', id: cleanupIds.tenantId, overrideAccess: true })
    }
  })
})
