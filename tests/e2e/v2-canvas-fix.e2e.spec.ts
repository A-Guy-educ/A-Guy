/**
 * E2E Tests for V2 Canvas Fix (@napi-rs/canvas Integration)
 *
 * Tests:
 * - V2 conversion processes PDF pages without canvas.node errors
 * - Job progress updates correctly during page processing
 * - Exercise creation with traceability metadata from cropped segments
 * - Guardrails for failed/rejected image crops
 * - Zero-segment completion with warnings
 *
 * These tests verify the @napi-rs/canvas fix for the native module error.
 *
 * NOTE: These tests are currently skipped because they navigate to fake lesson IDs
 * in the admin panel (/admin/collections/lessons/test-lesson-id) that don't exist,
 * resulting in a Payload 404 page instead of the edit view with V2 panel.
 * A proper fix would require either seeding real lesson data or converting to
 * component-level integration tests.
 */

import { test, expect } from '@playwright/test'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

// Skip all tests in this file - requires seeded admin lesson data
const hasAdminData = false // TODO: Implement admin data seeding

test.describe('V2 Canvas Fix - @napi-rs/canvas Integration', () => {
  test.skip(
    !hasAdminData,
    'Skipped: Requires seeded lesson data in admin panel. These tests navigate to non-existent lesson IDs.',
  )

  // Create admin user and authenticate before tests
  test.beforeEach(async ({ page }) => {
    // Authenticate as admin user
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-test'),
        password: 'TestPassword123!',
      },
      'admin',
    )

    // Navigate to admin area
    await page.goto('http://localhost:3000/admin')
  })

  // Clean up test users after all tests complete
  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test.describe('PDF Page Rendering', () => {
    test('should process multi-page PDF without canvas.node error', async ({ page }) => {
      // Mock the V2 job with progress updates showing all pages processed
      let jobCallCount = 0

      // Track network requests to ensure no canvas errors
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      // Mock status API with simulated progress
      await page.route('/api/exercises/convert/status*', async (route) => {
        jobCallCount++
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'test-job-id',
                  status: jobCallCount >= 3 ? 'completed' : 'running',
                  output: {
                    pagesTotal: 7,
                    pagesProcessed: jobCallCount >= 3 ? 7 : jobCallCount * 2,
                    exercisesCreated: jobCallCount >= 3 ? 25 : Math.floor(jobCallCount * 8),
                    errors: [],
                    warnings: [],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      // Navigate to a lesson with PDF
      await page.goto('http://localhost:3000/admin/collections/lessons/test-lesson-id')

      // Wait for V2 status panel
      await page.waitForSelector('text=V2 Conversion Status', { timeout: 10000 })

      // Check that no canvas.node errors occurred
      const canvasErrors = consoleErrors.filter(
        (err) =>
          err.includes('canvas.node') ||
          err.includes('Cannot find module') ||
          err.includes('build/Release'),
      )

      expect(canvasErrors).toHaveLength(0)
    })

    test('should handle PDF with single page correctly', async ({ page }) => {
      // Mock single-page PDF job completion
      await page.route('/api/exercises/convert/status*', async (route) => {
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'single-page-job',
                  status: 'completed',
                  output: {
                    pagesTotal: 1,
                    pagesProcessed: 1,
                    exercisesCreated: 3,
                    errors: [],
                    warnings: [],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      // Navigate to lesson
      await page.goto('http://localhost:3000/admin/collections/lessons/single-page-lesson')

      // Verify single page processed
      await page.waitForSelector('text=1 / 1', { timeout: 5000 })
      await expect(page.locator('text=Pages').first()).toContainText('1 / 1')
    })
  })

  test.describe('Exercise Creation from Cropped Segments', () => {
    test('should show correct exercise count after V2 completion', async ({ page }) => {
      // Mock completed job with exercises
      await page.route('/api/exercises/convert/status*', async (route) => {
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'completed-job',
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
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/test-lesson')

      // Wait for completion
      await page.waitForSelector('text=COMPLETED', { timeout: 5000 })

      // Verify exercise count
      await expect(page.locator('text=Exercises').first()).toContainText('20')
    })

    test('should display traceability metadata in job output', async ({ page }) => {
      // Mock job with traceability info in errors (for debugging)
      await page.route('/api/exercises/convert/status*', async (route) => {
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'traceability-job',
                  status: 'completed',
                  output: {
                    pagesTotal: 3,
                    pagesProcessed: 3,
                    exercisesCreated: 12,
                    errors: [
                      {
                        pageIndex: 1,
                        bbox: { x: 0.1, y: 0.2, width: 0.5, height: 0.3 },
                        reason: 'Crop dimensions too small',
                      },
                    ],
                    warnings: [],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/trace-test')

      // Wait for status
      await page.waitForSelector('text=COMPLETED', { timeout: 5000 })

      // Error should show with bbox info for debugging
      await expect(page.locator('text=Errors').first()).toContainText('1')
    })
  })

  test.describe('Guardrails and Edge Cases', () => {
    test('should show warnings when no valid segments produced', async ({ page }) => {
      // Mock job with warnings for zero segments
      await page.route('/api/exercises/convert/status*', async (route) => {
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'zero-segments-job',
                  status: 'completed',
                  output: {
                    pagesTotal: 5,
                    pagesProcessed: 5,
                    exercisesCreated: 0,
                    errors: [],
                    warnings: [
                      'Model returned no bounding boxes across all pages.',
                      'PDF may not contain exercise content.',
                    ],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/empty-pdf')

      // Wait for completion
      await page.waitForSelector('text=⚠️', { timeout: 5000 })

      // Verify warnings displayed
      await expect(page.locator('text=Model returned no bounding boxes')).toBeVisible()
      await expect(page.locator('text=PDF may not contain exercise content')).toBeVisible()
    })

    test('should handle failed job with error details', async ({ page }) => {
      // Mock failed job
      await page.route('/api/exercises/convert/status*', async (route) => {
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'failed-job',
                  status: 'failed',
                  output: {
                    pagesTotal: 10,
                    pagesProcessed: 3,
                    exercisesCreated: 5,
                    errors: [
                      {
                        pageIndex: 3,
                        bbox: { x: 0.0, y: 0.0, width: 1.0, height: 1.0 },
                        reason: 'Page rendering failed: Cannot read properties of undefined',
                      },
                      {
                        pageIndex: 4,
                        reason: 'Vision API timeout',
                      },
                    ],
                    warnings: [],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/failed-job')

      // Wait for failed status
      await page.waitForSelector('text=FAILED', { timeout: 5000 })

      // Verify error count
      await expect(page.locator('text=Errors').first()).toContainText('2')

      // Verify Run Now button appears for failed jobs
      await expect(page.getByRole('button', { name: 'Run Now' })).toBeVisible()
    })

    test('should display partial progress for interrupted jobs', async ({ page }) => {
      // Mock running job with partial progress
      await page.route('/api/exercises/convert/status*', async (route) => {
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'partial-job',
                  status: 'running',
                  output: {
                    pagesTotal: 10,
                    pagesProcessed: 6,
                    exercisesCreated: 18,
                    errors: [
                      {
                        pageIndex: 2,
                        reason: 'Invalid crop dimensions',
                      },
                    ],
                    warnings: [],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/partial-job')

      // Wait for running status
      await page.waitForSelector('text=RUNNING', { timeout: 5000 })

      // Verify progress bar exists
      const progressBar = page.locator('[style*="background-color: var(--theme-primary)"]')
      await expect(progressBar).toBeVisible()

      // Verify partial progress displayed
      await expect(page.locator('text=Pages').first()).toContainText('6 / 10')
      await expect(page.locator('text=Exercises').first()).toContainText('18')
      await expect(page.locator('text=Errors').first()).toContainText('1')
    })
  })

  test.describe('V2 Job Status Transitions', () => {
    test('should transition from queued to running when job starts', async ({ page }) => {
      let statusCall = 0

      // First call returns queued, subsequent calls return running
      await page.route('/api/exercises/convert/status*', async (route) => {
        statusCall++
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          if (statusCall === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                docs: [
                  {
                    id: 'transition-job',
                    status: 'queued',
                    output: {
                      pagesTotal: 5,
                      pagesProcessed: 0,
                      exercisesCreated: 0,
                      errors: [],
                      warnings: [],
                    },
                    updatedAt: new Date().toISOString(),
                  },
                ],
              }),
            })
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                docs: [
                  {
                    id: 'transition-job',
                    status: 'running',
                    output: {
                      pagesTotal: 5,
                      pagesProcessed: 2,
                      exercisesCreated: 7,
                      errors: [],
                      warnings: [],
                    },
                    updatedAt: new Date().toISOString(),
                  },
                ],
              }),
            })
          }
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/transition-test')

      // Initially should show QUEUED
      await page.waitForSelector('text=QUEUED', { timeout: 5000 })

      // After polling, should show RUNNING
      await page.waitForFunction(
        () => {
          const running = document.querySelector('text=RUNNING')
          return running !== null
        },
        { timeout: 15000 },
      )
    })

    test('should handle rapid status changes correctly', async ({ page }) => {
      // Simulate quick status transitions
      let callCount = 0

      await page.route('/api/exercises/convert/status*', async (route) => {
        callCount++
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          const statuses = ['queued', 'running', 'running', 'completed']
          const statusIndex = Math.min(callCount - 1, statuses.length - 1)
          const status = statuses[statusIndex]

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'rapid-job',
                  status,
                  output: {
                    pagesTotal: 3,
                    pagesProcessed: status === 'completed' ? 3 : status === 'running' ? 2 : 0,
                    exercisesCreated: status === 'completed' ? 9 : status === 'running' ? 6 : 0,
                    errors: [],
                    warnings: [],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ docs: [] }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/rapid-test')

      // Should eventually reach completed
      await page.waitForSelector('text=COMPLETED', { timeout: 15000 })
      await expect(page.locator('text=Exercises').first()).toContainText('9')
    })
  })

  test.describe('V1 vs V2 Coexistence', () => {
    test('should show both V1 and V2 buttons independently', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/collections/lessons/coexistence-test')

      // Both buttons should be visible
      await expect(page.getByRole('button', { name: 'Convert (V1)' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Convert (V2 Images)' })).toBeVisible()

      // V1 and V2 status panels should both exist
      await expect(page.locator('text=Exercise Conversion').first()).toBeVisible()
    })

    test('V2 conversion should not affect V1 jobs', async ({ page }) => {
      // Mock V1 status
      await page.route('/api/exercises/convert/status*', async (route) => {
        const url = new URL(route.request().url())
        const pipelineVersion = url.searchParams.get('pipelineVersion')

        if (pipelineVersion === '2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'v2-job',
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
        } else {
          // V1 job still exists independently
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              docs: [
                {
                  id: 'v1-job',
                  status: 'running',
                  output: {
                    pagesTotal: 3,
                    pagesProcessed: 1,
                    exercisesCreated: 2,
                    errors: [],
                  },
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          })
        }
      })

      await page.goto('http://localhost:3000/admin/collections/lessons/independent-test')

      // V2 should be completed
      await page.waitForSelector('text=COMPLETED', { timeout: 5000 })

      // Both pipelines coexist independently
      await expect(page.getByRole('button', { name: 'Convert (V1)' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Convert (V2 Images)' })).toBeVisible()
    })
  })
})
