/**
 * Bug #2481: /ask and /practice silently redirect to /start for authenticated user
 *
 * When an authenticated user without gradeLevel in localStorage navigates to
 * /ask or /practice, they are silently redirected to /start instead of seeing
 * the page or a meaningful error message.
 *
 * @tags @bug @auth
 */
import { expect, test } from '@playwright/test'

import { generateTestUserEmail, setupAuthenticatedUser, cleanupTestUsers } from './helpers/auth'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Bug #2481 - Authenticated user redirect issue', () => {
  test('authenticated user without gradeLevel should not be silently redirected from /ask to /start', async ({
    page,
  }) => {
    // Set up authenticated user
    const user = await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('ask-redirect-bug'),
        password: 'TestPass123!',
      },
      'student',
    )

    // Clear localStorage to simulate no gradeLevel (fresh login without onboarding)
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())

    // Navigate to /ask
    await page.goto('/ask')
    await page.waitForLoadState('networkidle')

    // The bug: user is silently redirected to /start (/) instead of staying on /ask
    // Expected: URL should contain /ask OR show a meaningful message about missing gradeLevel
    const currentUrl = page.url()

    // This is the failing assertion - currently the bug causes redirect to /
    expect(currentUrl).toMatch(/\/ask/)
    expect(currentUrl).not.toMatch(/\/start/)
    expect(currentUrl).not.toMatch(/^\/$/)
  })

  test('authenticated user without gradeLevel should not be silently redirected from /practice to /start', async ({
    page,
  }) => {
    // Set up authenticated user
    const user = await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('practice-redirect-bug'),
        password: 'TestPass123!',
      },
      'student',
    )

    // Clear localStorage to simulate no gradeLevel (fresh login without onboarding)
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())

    // Navigate to /practice
    await page.goto('/practice')
    await page.waitForLoadState('networkidle')

    // The bug: user is silently redirected to /start (/) instead of staying on /practice
    // Expected: URL should contain /practice OR show a meaningful message about missing gradeLevel
    const currentUrl = page.url()

    // This is the failing assertion - currently the bug causes redirect to /
    expect(currentUrl).toMatch(/\/practice/)
    expect(currentUrl).not.toMatch(/\/start/)
    expect(currentUrl).not.toMatch(/^\/$/)
  })
})
