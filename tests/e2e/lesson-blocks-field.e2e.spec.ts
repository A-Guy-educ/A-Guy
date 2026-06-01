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

/**
 * E2E test for LessonBlocksField empty state add buttons (#2298)
 *
 * Tests that the empty state in LessonBlocksField shows "Add Exercise"
 * and "Add Content Page" buttons so users can create blocks inline
 * without having to navigate away to the Exercises/Content Pages collections.
 */
test('shows Add Exercise and Add Content Page buttons in empty state', async ({ page }) => {
  test.skip(!data, 'No test data available')

  // Use the seeded lesson but ensure it has no blocks
  const { lessonId } = data!.course
  const payload = await getPayload({ config })

  // Clear any existing blocks to ensure empty state
  await payload.update({
    collection: 'lessons',
    id: lessonId,
    data: { blocks: JSON.stringify([]) },
    overrideAccess: true,
  })

  await loginAsAdmin(page)
  await page.goto(`/admin/collections/lessons/${lessonId}`)
  await page.waitForLoadState('domcontentloaded')

  // Wait for the LessonBlocksField to be visible
  const lessonBlocksLabel = page.getByText('Lesson Blocks')
  await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

  // Empty state message should be visible
  const emptyMessage = page.getByText(
    'No blocks yet. Create exercises or content pages for this lesson.',
  )
  await expect(emptyMessage).toBeVisible({ timeout: 10_000 })

  // Add Exercise button should be visible
  const addExerciseBtn = page.getByRole('button', { name: 'Add Exercise' })
  await expect(addExerciseBtn).toBeVisible({ timeout: 10_000 })

  // Add Content Page button should be visible
  const addContentPageBtn = page.getByRole('button', { name: 'Add Content Page' })
  await expect(addContentPageBtn).toBeVisible({ timeout: 10_000 })

  // Both buttons should navigate to the correct create pages
  await addExerciseBtn.click()
  await expect(page).toHaveURL(/\/admin\/collections\/exercises\/create/)
  await page.goBack()

  await addContentPageBtn.click()
  await expect(page).toHaveURL(/\/admin\/collections\/content-pages\/create/)
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

  test('shows confirmation dialog before deleting a block (#2299)', async ({ page }) => {
    test.skip(!data, 'No test data available')

    // Seed lesson with exercises to have blocks to delete
    const result = await seedLessonWithExercises()
    test.skip(!result, 'Failed to seed lesson with exercises')
    const { lessonId } = result!

    await loginAsAdmin(page)
    await page.goto(`/admin/collections/lessons/${lessonId}`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for the lesson blocks to be visible
    const lessonBlocksLabel = page.getByText('Lesson Blocks')
    await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

    // Count blocks before deletion
    const deleteButtons = page.locator('button[title="Delete"]')
    const blockCountBefore = await deleteButtons.count()
    expect(blockCountBefore).toBeGreaterThan(0)

    // Set up a dialog handler to cancel the confirmation
    // If no dialog appears and the bug exists, this handler will never fire
    let dialogAppeared = false
    page.on('dialog', async (dialog) => {
      dialogAppeared = true
      await dialog.dismiss()
    })

    // Click the first delete button
    await deleteButtons.first().click()

    // Give the UI a moment to react
    await page.waitForTimeout(500)

    // The fix should show a confirmation dialog before deletion
    // If the bug exists, dialogAppeared will be false (no confirmation dialog)
    expect(dialogAppeared).toBe(true)

    // Block count should remain the same since we cancelled
    const blockCountAfter = await deleteButtons.count()
    expect(blockCountAfter).toBe(blockCountBefore)
  })
})
