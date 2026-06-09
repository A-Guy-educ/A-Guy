/**
 * E2E test for LessonBlocksField delete confirmation (#2551)
 *
 * Tests that clicking the Trash2 delete button on a block row shows a
 * confirmation dialog before removing the block.
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

type ExerciseRefBlock = {
  blockType: string
  exercise?: string | { id?: string }
}

async function seedLessonWithTwoExerciseBlocks(): Promise<{
  lessonId: string
  exerciseIds: string[]
} | null> {
  if (!data) return null

  const payload = await getPayload({ config })
  const exerciseIds: string[] = []
  const lessonId = data.course.lessonId

  // Create two exercises
  const mcq = await payload.create({
    collection: 'exercises',
    data: {
      title: 'Delete Confirm Test MCQ',
      slug: `delete-confirm-mcq-${Date.now()}`,
      lesson: lessonId,
      status: 'published',
      exerciseContent: buildMcqExercise(),
    } as any,
    overrideAccess: true,
    draft: false,
  })
  exerciseIds.push(mcq.id)

  const fr = await payload.create({
    collection: 'exercises',
    data: {
      title: 'Delete Confirm Test FR',
      slug: `delete-confirm-fr-${Date.now()}`,
      lesson: lessonId,
      status: 'published',
      exerciseContent: buildFreeResponseExercise(),
    } as any,
    overrideAccess: true,
    draft: false,
  })
  exerciseIds.push(fr.id)

  // Add two exercise blocks to the lesson
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

test.afterAll(async () => {
  if (data) {
    const payload = await getPayload({ config })
    // Clean up exercises created for this test
    const lessonId = data.course.lessonId
    const blocks = JSON.parse(
      (await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0 })).blocks as string,
    )
    const exerciseIds = blocks
      .filter((block: ExerciseRefBlock) => block.blockType === 'exerciseRef')
      .map((block: ExerciseRefBlock) =>
        typeof block.exercise === 'string' ? block.exercise : block.exercise?.id,
      )
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

test.setTimeout(60_000)

test.describe('LessonBlocksField delete confirmation', () => {
  test('shows confirmation dialog when Trash2 button is clicked and block is removed on confirm', async ({
    page,
  }) => {
    test.skip(!data, 'No test data available')

    const result = await seedLessonWithTwoExerciseBlocks()
    test.skip(!result, 'Failed to seed lesson with exercises')
    const { lessonId } = result!

    await loginAsAdmin(page)
    await page.goto(`/admin/collections/lessons/${lessonId}`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for blocks to be visible
    const lessonBlocksLabel = page.getByText('Lesson Blocks')
    await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

    // Count block rows before delete
    const blockRows = page
      .locator('[draggable="true"]')
      .filter({ has: page.locator('button >> [title="Delete"]') })
    await expect(blockRows).toHaveCount(2, { timeout: 10_000 })

    // Set up dialog handler BEFORE clicking delete
    let dialogHandled = false
    page.on('dialog', async (dialog) => {
      // Verify the dialog message mentions "delete" (window.confirm uses browser's default message)
      const message = dialog.message().toLowerCase()
      expect(message).toMatch(/delete|block/i)
      dialogHandled = true
      await dialog.accept()
    })

    // Click the Trash2 (Delete) button on the first block row
    const deleteButton = blockRows.first().locator('button >> [title="Delete"]')
    await deleteButton.click()

    // Give a small grace period for the dialog to appear
    await page.waitForTimeout(500)

    // The bug: no dialog fires, so dialogHandled stays false and this fails
    expect(dialogHandled).toBe(true)

    // After confirming, block count should decrease
    await expect(blockRows).toHaveCount(1, { timeout: 10_000 })
  })

  test('block is NOT removed when Cancel is chosen in confirmation dialog', async ({ page }) => {
    test.skip(!data, 'No test data available')

    const result = await seedLessonWithTwoExerciseBlocks()
    test.skip(!result, 'Failed to seed lesson with exercises')
    const { lessonId } = result!

    await loginAsAdmin(page)
    await page.goto(`/admin/collections/lessons/${lessonId}`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for blocks to be visible
    const lessonBlocksLabel = page.getByText('Lesson Blocks')
    await expect(lessonBlocksLabel).toBeVisible({ timeout: 15_000 })

    // Count block rows before delete attempt
    const blockRows = page
      .locator('[draggable="true"]')
      .filter({ has: page.locator('button >> [title="Delete"]') })
    await expect(blockRows).toHaveCount(2, { timeout: 10_000 })

    // Set up dialog handler to DISMISS the dialog (Cancel)
    let dialogHandled = false
    page.on('dialog', async (dialog) => {
      dialogHandled = true
      await dialog.dismiss() // Cancel
    })

    // Click the Trash2 (Delete) button on the first block row
    const deleteButton = blockRows.first().locator('button >> [title="Delete"]')
    await deleteButton.click()

    // Give a small grace period for the dialog to appear
    await page.waitForTimeout(500)

    // Verify dialog was shown and dismissed
    expect(dialogHandled).toBe(true)

    // Block count should remain the same (2) since we cancelled
    await expect(blockRows).toHaveCount(2, { timeout: 10_000 })
  })
})
