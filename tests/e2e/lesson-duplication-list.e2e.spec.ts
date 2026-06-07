/**
 * E2E Tests for Lesson Duplications List View — Relationship Cells (issue #2507)
 *
 * Verifies that Source Lesson and Output Lesson relationship columns in the
 * /admin/collections/lesson-duplications list view render lesson titles
 * instead of perpetually showing "Loading...".
 *
 * The bug: RelationshipProvider's loadRelationshipDocs effect fails to fire when
 * RelationshipCell calls getRelationships(), leaving cells stuck on "Loading...".
 */
import { test, expect } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

async function createLessonDuplicationWithRelationships(payload: Payload, sourceLessonId: string) {
  // Create output lesson
  const outputLesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Test Output Lesson for List View',
      type: 'practice',
      status: 'published',
      isActive: true,
    } as never,
    overrideAccess: true,
  })

  // Create the duplication record with both relationships
  const record = await payload.create({
    collection: 'lesson-duplications',
    data: {
      sourceLesson: sourceLessonId,
      level: 'medium',
      status: 'succeeded',
      outputLesson: outputLesson.id,
    } as never,
    overrideAccess: true,
  })

  return {
    recordId: record.id,
    sourceLessonId,
    outputLessonId: outputLesson.id,
  }
}

async function cleanupTestData(
  payload: Payload,
  data: Awaited<ReturnType<typeof createLessonDuplicationWithRelationships>>,
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
      collection: 'lessons',
      id: data.outputLessonId,
      overrideAccess: true,
    })
    .catch(() => {})
}

test.describe('Lesson Duplications List View — Relationship Cells (issue #2507)', () => {
  let testData: Awaited<ReturnType<typeof createLessonDuplicationWithRelationships>> | null = null

  test.beforeAll(async () => {
    const payload = await getPayload({ config })

    // Find or create a source lesson
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
    testData = await createLessonDuplicationWithRelationships(payload, sourceLessonId)
  })

  test.afterAll(async () => {
    if (testData) {
      const payload = await getPayload({ config })
      await cleanupTestData(payload, testData)
    }
    await cleanupTestUsers()
  })

  test('Source Lesson and Output Lesson columns show titles, not "Loading..."', async ({
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
        email: generateTestUserEmail('admin-list-view'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the lesson-duplications list view
    await page.goto('/admin/collections/lesson-duplications')
    await page.waitForLoadState('networkidle')

    // Wait for the table to be visible
    await expect(page.locator('.relationship-table, table')).toBeVisible({ timeout: 15000 })

    // The bug: Source Lesson and Output Lesson cells show "Loading..." indefinitely.
    // After the fix: they should show actual lesson titles or IDs, not "Loading..."
    //
    // Wait a bit for any async fetches to complete
    await page.waitForTimeout(3000)

    // Assert: neither column should show "Loading..." text
    // We look for cells in the Source Lesson and Output Lesson column areas
    const tableBody = page.locator('tbody')
    await expect(tableBody).toBeVisible()

    // Check that the Source Lesson column does NOT contain "Loading..."
    // The Source Lesson cell should show a title (or ID fallback), not the loading text
    const loadingText = page.getByText('Loading...')
    const loadingCount = await loadingText.count()

    // Allow loading text to appear briefly, but it should resolve
    // After 3 seconds, no "Loading..." should remain for our specific record
    if (loadingCount > 0) {
      // If we see loading text, it should NOT be in the Source/Output Lesson columns
      // for the row containing our test record
      const rows = await tableBody.locator('tr').all()
      for (const row of rows) {
        const rowText = await row.textContent()
        if (rowText?.includes('medium') && rowText?.includes('succeeded')) {
          // This is likely our row — check it specifically
          const sourceLessonCell = row.locator('td').nth(0)
          const outputLessonCell = row.locator('td').nth(4)
          await expect(sourceLessonCell).not.toHaveText(/Loading/)
          await expect(outputLessonCell).not.toHaveText(/Loading/)
        }
      }
    }

    // The core assertion: no cell in the table should display persistent "Loading..." text.
    // This catches the bug where RelationshipCell shows "Loading..." indefinitely.
    await expect(page.locator('table')).not.toContainText(/Loading\.\.\./i, {
      timeout: 5000,
    })

    // Verify our specific test row is present and its relationship columns are resolved.
    // The row for our test record is identified by the 'medium' level and 'succeeded' status.
    const allRowTexts = await page.locator('tbody tr').allTextContents()
    const testRowExists = allRowTexts.some(
      (rowText) => rowText.includes('medium') && rowText.includes('succeeded'),
    )
    expect(testRowExists).toBe(true)

    // The test row's Source Lesson and Output Lesson cells should show lesson titles
    // (or IDs as fallback), NOT "Loading..." text.
    // We verify by finding the row and checking it doesn't contain loading text.
    const rows = await page.locator('tbody tr').all()
    for (const row of rows) {
      const rowText = await row.textContent()
      if (rowText?.includes('medium') && rowText?.includes('succeeded')) {
        // This is our test row — neither Source Lesson nor Output Lesson
        // column should contain "Loading..."
        expect(rowText).not.toMatch(/loading\.\.\./i)
      }
    }
  })
})
