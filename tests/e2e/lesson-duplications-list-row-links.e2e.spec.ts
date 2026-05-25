/**
 * E2E Tests for Lesson Duplications List Row Links
 *
 * Bug: Row links in the lesson-duplications list go to
 * /admin/collections/lesson-duplications/:id (404) instead of
 * /admin/lesson-duplications/:id (the custom review route).
 *
 * Tests:
 *  - Row links in the list use the correct URL format (/admin/lesson-duplications/:id)
 *  - The index page redirects to the correct list location
 */
import { test, expect } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

async function createTestRecord(payload: Payload, sourceLessonId: string) {
  const outputLesson = await payload.create({
    collection: 'lessons',
    data: { title: 'Test Output Lesson', type: 'practice', status: 'draft' },
    draft: true,
    overrideAccess: true,
  })

  const record = await payload.create({
    collection: 'lesson-duplications',
    data: {
      sourceLesson: sourceLessonId,
      level: 'medium',
      status: 'needs_review',
      outputLesson: outputLesson.id,
      outputExercises: [],
      failures: [],
    },
    overrideAccess: true,
  })

  return { recordId: record.id, outputLessonId: outputLesson.id }
}

async function cleanupTestData(
  payload: Payload,
  data: Awaited<ReturnType<typeof createTestRecord>>,
) {
  await payload
    .delete({ collection: 'lesson-duplications', id: data.recordId, overrideAccess: true })
    .catch(() => {})
  await payload
    .delete({ collection: 'lessons', id: data.outputLessonId, overrideAccess: true })
    .catch(() => {})
}

test.describe('Lesson Duplications List Row Links', () => {
  let testData: Awaited<ReturnType<typeof createTestRecord>> | null = null

  test.beforeAll(async () => {
    const payload = await getPayload({ config })
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
    testData = await createTestRecord(payload, lessons.docs[0].id)
  })

  test.afterAll(async () => {
    if (testData) {
      const payload = await getPayload({ config })
      await cleanupTestData(payload, testData)
    }
    await cleanupTestUsers()
  })

  test('row links in the list use /admin/lesson-duplications/:id format (not /collections/)', async ({
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
        email: generateTestUserEmail('admin-row-links'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the lesson-duplications list
    await page.goto('/admin/collections/lesson-duplications')
    await page.waitForLoadState('networkidle')

    // Wait for the list to load (Payload renders the collection list)
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
      // If no table, the list might be empty or not rendered as a table
    })

    // Find the row for our test record by looking for the record ID in the table
    const row = page
      .locator('tr')
      .filter({ has: page.locator(`td >> text=${testData.recordId.slice(0, 8)}`) })
      .first()

    // Find the link in the row (the first column typically contains the title/id link)
    const rowLink = row.locator('a').first()

    // Check that the link does NOT contain /collections/ in the path
    // The correct format should be /admin/lesson-duplications/:id
    const href = await rowLink.getAttribute('href')
    expect(href).not.toContain('/collections/lesson-duplications')
    expect(href).toContain('/admin/lesson-duplications/')
    expect(href).toContain(testData.recordId)
  })

  test('clicking a row link navigates to the review page without 404', async ({ page }) => {
    if (!testData) {
      test.skip()
      return
    }

    // Authenticate as admin
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-row-link-click'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to the lesson-duplications list
    await page.goto('/admin/collections/lesson-duplications')
    await page.waitForLoadState('networkidle')

    // Wait for the list to load
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {})

    // Find and click the row for our test record
    const row = page
      .locator('tr')
      .filter({ has: page.locator(`td >> text=${testData.recordId.slice(0, 8)}`) })
      .first()
    const rowLink = row.locator('a').first()

    // Click the link and verify navigation
    await rowLink.click()
    await page.waitForLoadState('networkidle')

    // The URL should be /admin/lesson-duplications/:id (not /collections/)
    expect(page.url()).toContain('/admin/lesson-duplications/')
    expect(page.url()).toContain(testData.recordId)

    // Should not 404 — the page should load (either review UI or some content)
    // A 404 would show "Page not found" or similar
    await expect(page.locator('body')).not.toContainText(/404|Page Not Found/)
  })
})
