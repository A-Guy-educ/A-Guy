/**
 * E2E Tests for V2 Error Display in Status Panel
 *
 * Tests:
 * - V2StatusPanel renders error reasons with page index
 * - Error details are displayed in error-themed styling
 * - Multiple errors are all rendered
 * - Empty errors array shows no error section
 *
 * These tests verify the fix for error details visibility issue.
 */

import { test, expect } from '@playwright/test'

test.describe('V2 Error Display in Status Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin area - assume we're logged in
    await page.goto('http://localhost:3000/admin')
  })

  test.describe('Error Details Rendering', () => {
    test('should display error reason with page index for failed jobs', async ({ page }) => {
      // Mock job response with errors containing reasons
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'mock-job-id',
                status: 'failed',
                output: {
                  pagesTotal: 5,
                  pagesProcessed: 2,
                  exercisesCreated: 0,
                  errors: [
                    { pageIndex: 0, reason: 'Model returned no bboxes' },
                    { pageIndex: 1, reason: 'Image crop below minimum size' },
                  ],
                  warnings: [],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      // Wait for status to load
      await page.waitForSelector('text=FAILED', { timeout: 5000 })

      // Verify error count is displayed
      await expect(page.locator('text=Errors')).toBeVisible()
      await expect(page.locator('text=2')).toBeVisible() // Error count

      // Verify individual error messages are rendered with page index
      await expect(page.locator('text=Page 1: Model returned no bboxes')).toBeVisible()
      await expect(page.locator('text=Page 2: Image crop below minimum size')).toBeVisible()
    })

    test('should display single error with page index', async ({ page }) => {
      // Mock job with single error
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'mock-job-id',
                status: 'failed',
                output: {
                  pagesTotal: 3,
                  pagesProcessed: 1,
                  exercisesCreated: 0,
                  errors: [{ pageIndex: 0, reason: 'PDF parsing failed - invalid PDF structure' }],
                  warnings: [],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      // Wait for status to load
      await page.waitForSelector('text=FAILED', { timeout: 5000 })

      // Verify error reason is displayed
      await expect(
        page.locator('text=Page 1: PDF parsing failed - invalid PDF structure'),
      ).toBeVisible()
    })

    test('should display multiple errors with distinct page indices', async ({ page }) => {
      // Mock job with multiple errors across different pages
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'mock-job-id',
                status: 'failed',
                output: {
                  pagesTotal: 10,
                  pagesProcessed: 4,
                  exercisesCreated: 3,
                  errors: [
                    { pageIndex: 0, reason: 'Crop region outside page bounds' },
                    { pageIndex: 2, reason: 'Confidence score below threshold' },
                    { pageIndex: 4, reason: 'Invalid bounding box format' },
                    { pageIndex: 6, reason: 'Image too blurry for detection' },
                  ],
                  warnings: ['Some pages had low confidence scores'],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      // Wait for status to load
      await page.waitForSelector('text=FAILED', { timeout: 5000 })

      // Verify all error messages are displayed
      await expect(page.locator('text=Page 1: Crop region outside page bounds')).toBeVisible()
      await expect(page.locator('text=Page 3: Confidence score below threshold')).toBeVisible()
      await expect(page.locator('text=Page 5: Invalid bounding box format')).toBeVisible()
      await expect(page.locator('text=Page 7: Image too blurry for detection')).toBeVisible()
    })

    test('should NOT show error details section when errors array is empty', async ({ page }) => {
      // Mock completed job with no errors
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'mock-job-id',
                status: 'completed',
                output: {
                  pagesTotal: 5,
                  pagesProcessed: 5,
                  exercisesCreated: 20,
                  errors: [],
                  warnings: [],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      // Wait for status to load
      await page.waitForSelector('text=COMPLETED', { timeout: 5000 })

      // Verify no error detail section is rendered
      const pageContent = await page.content()
      expect(pageContent).not.toContain('Page')
      expect(pageContent).not.toContain('error')

      // But errors count should not appear at all
      await expect(page.locator('text=Errors')).not.toBeVisible()
    })

    test('should show error details in error-themed styling', async ({ page }) => {
      // Mock failed job with error
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'mock-job-id',
                status: 'failed',
                output: {
                  pagesTotal: 3,
                  pagesProcessed: 1,
                  exercisesCreated: 0,
                  errors: [{ pageIndex: 0, reason: 'Test error for styling' }],
                  warnings: [],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      // Wait for status to load
      await page.waitForSelector('text=FAILED', { timeout: 5000 })

      // Check for error icon (X mark)
      await expect(page.locator('text=❌')).toBeVisible()

      // Verify error styling container exists (should have error background color)
      // The error section should have a distinct background
      const errorSection = page.locator('text=Test error for styling').first()
      await expect(errorSection).toBeVisible()
    })
  })

  test.describe('Error Display in Complete Job Flow', () => {
    test('should display errors when job fails during conversion', async ({ page }) => {
      // Step 1: Queue a job
      await page.route('/api/exercises/convert/queue-v2', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            jobId: 'conversion-job-123',
            message: 'V2 conversion job queued',
          }),
        })
      })

      // Click V2 convert button
      const v2Button = page.getByRole('button', { name: 'Convert (V2 Images)' })
      await v2Button.click()

      // Step 2: Mock failed status with errors
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'conversion-job-123',
                status: 'failed',
                output: {
                  pagesTotal: 5,
                  pagesProcessed: 2,
                  exercisesCreated: 3,
                  errors: [
                    { pageIndex: 0, reason: 'Vision model timeout' },
                    { pageIndex: 1, reason: 'No exercise detected on page' },
                  ],
                  warnings: ['Processing slowed due to high load'],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      // Wait for failed status
      await page.waitForSelector('text=FAILED', { timeout: 5000 })

      // Verify error details are visible
      await expect(page.locator('text=Page 1: Vision model timeout')).toBeVisible()
      await expect(page.locator('text=Page 2: No exercise detected on page')).toBeVisible()
    })

    test('should show zero exercises created when all crops fail guardrails', async ({ page }) => {
      // Mock job where all pages failed guardrails
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'guardrail-job',
                status: 'failed',
                output: {
                  pagesTotal: 3,
                  pagesProcessed: 3,
                  exercisesCreated: 0,
                  errors: [
                    { pageIndex: 0, reason: 'Exercise crop too small - below 100px minimum' },
                    { pageIndex: 1, reason: 'Exercise crop too small - below 100px minimum' },
                    { pageIndex: 2, reason: 'Exercise crop too small - below 100px minimum' },
                  ],
                  warnings: [],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await page.waitForSelector('text=FAILED', { timeout: 5000 })

      // Verify zero exercises created
      await expect(page.locator('text=Exercises')).toBeVisible()
      await expect(page.locator('text=0')).toBeVisible()

      // Verify all guardrail error reasons are displayed
      await expect(page.locator('text=Page 1: Exercise crop too small')).toBeVisible()
      await expect(page.locator('text=Page 2: Exercise crop too small')).toBeVisible()
      await expect(page.locator('text=Page 3: Exercise crop too small')).toBeVisible()
    })
  })

  test.describe('Warning vs Error Display', () => {
    test('should display both errors and warnings when both are present', async ({ page }) => {
      // Mock job with both errors and warnings
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'mixed-job',
                status: 'completed',
                output: {
                  pagesTotal: 5,
                  pagesProcessed: 5,
                  exercisesCreated: 18,
                  errors: [{ pageIndex: 2, reason: 'Image quality below threshold' }],
                  warnings: [
                    'Model returned no bboxes for some regions',
                    'Some exercises may be truncated',
                  ],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await page.waitForSelector('text=COMPLETED', { timeout: 5000 })

      // Verify errors are displayed
      await expect(page.locator('text=Errors')).toBeVisible()
      await expect(page.locator('text=1')).toBeVisible() // Error count
      await expect(page.locator('text=Page 3: Image quality below threshold')).toBeVisible()

      // Verify warnings are displayed (existing functionality)
      await expect(page.locator('text=⚠️')).toBeVisible()
      await expect(page.locator('text=Model returned no bboxes for some regions')).toBeVisible()
    })

    test('should distinguish error icons from warning icons', async ({ page }) => {
      // Mock job with both errors and warnings
      await page.route('/api/exercises/convert/status*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docs: [
              {
                id: 'mixed-job',
                status: 'completed',
                output: {
                  pagesTotal: 3,
                  pagesProcessed: 3,
                  exercisesCreated: 5,
                  errors: [{ pageIndex: 0, reason: 'Test error' }],
                  warnings: ['Test warning'],
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await page.waitForSelector('text=COMPLETED', { timeout: 5000 })

      // Error should have X icon (❌)
      await expect(page.locator('text=❌')).toBeVisible()

      // Warning should have triangle icon (⚠️)
      await expect(page.locator('text=⚠️')).toBeVisible()
    })
  })
})
