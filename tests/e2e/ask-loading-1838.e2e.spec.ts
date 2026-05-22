/**
 * E2E Test: #1838 - /ask page stuck indefinitely on loading spinner
 *
 * Bug: RequireCourseSelection shows a spinner indefinitely when profile?.gradeLevel
 * is missing. The component calls router.replace('/') but does NOT set
 * hasSelection=false, leaving hasSelection=null and the spinner persists forever.
 *
 * This creates an infinite loop: /ask -> / (RequireCourseSelection has no gradeLevel)
 * -> /ask (redirect back) -> / -> ...
 *
 * The fix: set hasSelection=false before router.replace('/') so the spinner
 * stops and the redirect completes.
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers, setupAuthenticatedUser, generateTestUserEmail } from './helpers/auth'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('#1838 Ask page loading spinner', () => {
  test('redirects to home (not stuck on spinner) when profile has no gradeLevel', async ({
    page,
  }) => {
    // 1. Create and authenticate a student user
    const user = await setupAuthenticatedUser(
      page,
      { email: generateTestUserEmail('ask-loading'), password: 'TestPass123!' },
      'student',
    )
    expect(user.id).toBeDefined()

    // 2. Verify auth cookie is set
    const cookies = await page.context().cookies()
    const hasAuthCookie = cookies.some((c) => c.name === 'payload-token')
    expect(hasAuthCookie).toBe(true)

    // 3. Set a profile WITHOUT gradeLevel in localStorage (simulates the bug scenario)
    await page.evaluate(() => {
      localStorage.setItem(
        'a-guy:user-profile',
        JSON.stringify({
          // NO gradeLevel — this triggers the bug
          mood: 'happy',
          lastVisit: new Date().toISOString(),
        }),
      )
    })

    // 4. Navigate to /ask
    await page.goto('/ask')
    await page.waitForLoadState('domcontentloaded')

    // 5. The bug: spinner stays visible forever (hasSelection=null)
    //    The fix: should redirect to / (hasSelection=false, no spinner, redirect fires)
    //
    //    We wait 5 seconds. If the bug exists, the spinner is still visible.
    //    If fixed, we should be redirected to / before 5 seconds.
    const startTime = Date.now()

    // Wait for redirect away from /ask (the fix should redirect immediately)
    try {
      await page.waitForURL('/', { timeout: 5000 })
      // Fix is working: redirected within 5 seconds
      expect(page.url()).toBe('http://localhost:3000/')
    } catch {
      // Timeout: still on /ask — check if spinner is visible (BUG)
      const spinner = page.locator('.animate-spin').first()
      const spinnerVisible = await spinner.isVisible().catch(() => false)

      if (spinnerVisible) {
        // FAIL: spinner still visible after 5+ seconds — this is the bug
        const elapsed = Date.now() - startTime
        throw new Error(
          `BUG REPRODUCED: /ask page stuck on loading spinner for ${elapsed}ms. ` +
            `RequireCourseSelection did not redirect — hasSelection remained null.`,
        )
      }
      // Spinner not visible but URL didn't change — maybe content loaded?
      const url = page.url()
      throw new Error(
        `Unexpected state: URL=${url}, no spinner, no redirect after ${Date.now() - startTime}ms`,
      )
    }
  })

  test('loads successfully when profile has gradeLevel', async ({ page }) => {
    // 1. Create and authenticate a student user
    const user = await setupAuthenticatedUser(
      page,
      { email: generateTestUserEmail('ask-loading-good'), password: 'TestPass123!' },
      'student',
    )
    expect(user.id).toBeDefined()

    // 2. Set a profile WITH gradeLevel in localStorage
    await page.evaluate(() => {
      localStorage.setItem(
        'a-guy:user-profile',
        JSON.stringify({
          gradeLevel: '8',
          mood: 'happy',
          lastVisit: new Date().toISOString(),
        }),
      )
    })

    // 3. Navigate to /ask
    await page.goto('/ask')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    // 4. Should NOT be stuck on spinner — either content or redirect
    const url = page.url()
    const spinner = page.locator('.animate-spin').first()
    const spinnerVisible = await spinner.isVisible().catch(() => false)

    // Either redirected (no profile needed context) or content loaded
    expect(
      url === 'http://localhost:3000/' || !spinnerVisible,
      `Expected redirect or content, got URL=${url}, spinner=${spinnerVisible}`,
    ).toBe(true)
  })
})
