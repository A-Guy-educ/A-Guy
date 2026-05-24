/**
 * Bug #2032: Ask, practice, and stats pages redirect to /start for authenticated user
 *
 * When an authenticated user (with Payload session) navigates to /ask without
 * a gradeLevel in localStorage, they are incorrectly redirected to / (which
 * falls through to /start) instead of being shown the page or redirected
 * to grade selection (/courses).
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers, setupAuthenticatedUser, generateTestUserEmail } from './helpers/auth'

test.describe('Bug #2032 - Authenticated user redirect issue', () => {
  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('authenticated user without gradeLevel should NOT be redirected to /start on /ask', async ({
    page,
  }) => {
    // Step 1: Create and authenticate a user (sets Payload session cookie)
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('qa-redirect-test'),
        password: 'TestPass123!',
      },
      'student',
    )

    // Step 2: Ensure localStorage does NOT have gradeLevel (the bug scenario)
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    // Step 3: Navigate to /ask
    await page.goto('/ask')
    await page.waitForLoadState('domcontentloaded')

    // Give client-side navigation time to complete
    await page.waitForTimeout(2000)

    // Step 4: ASSERTION - User should NOT be on /start
    // Buggy behavior: user is redirected to /start (or / which falls through to /start)
    const currentUrl = page.url()
    ;(expect(currentUrl).not.toContain('/start'),
      `Expected NOT to be redirected to /start, but URL is: ${currentUrl}`)
  })

  test('authenticated user without gradeLevel should NOT be redirected to /start on /practice', async ({
    page,
  }) => {
    // Create and authenticate a user
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('qa-redirect-test-practice'),
        password: 'TestPass123!',
      },
      'student',
    )

    // Ensure localStorage does NOT have gradeLevel
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    // Navigate to /practice
    await page.goto('/practice')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // User should NOT be on /start
    const currentUrl = page.url()
    ;(expect(currentUrl).not.toContain('/start'),
      `Expected NOT to be redirected to /start, but URL is: ${currentUrl}`)
  })

  test('authenticated user without gradeLevel should NOT be redirected to /start on /stats', async ({
    page,
  }) => {
    // Create and authenticate a user
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('qa-redirect-test-stats'),
        password: 'TestPass123!',
      },
      'student',
    )

    // Ensure localStorage does NOT have gradeLevel
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    // Navigate to /stats
    await page.goto('/stats')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // User should NOT be on /start (stats should redirect to /login if unauthenticated,
    // or show the stats page if authenticated with proper access)
    const currentUrl = page.url()
    ;(expect(currentUrl).not.toContain('/start'),
      `Expected NOT to be redirected to /start, but URL is: ${currentUrl}`)
  })
})
