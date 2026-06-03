/**
 * E2E Test: /ask route redirects to /courses instead of /start
 *
 * Bug: When a user without a grade level visits /ask, they are redirected
 * to / which falls back to /start (if no home page exists). The correct
 * behavior is to redirect to /courses where they can select a course.
 *
 * Issue: #2375
 */

import { test, expect } from '@playwright/test'

import { loginAsStudent } from './helpers/verification-fixtures'

test.describe('Ask Route', () => {
  test('should redirect to /courses (not /start) when user has no grade level', async ({
    page,
  }) => {
    // Set up authenticated user WITHOUT selecting a course
    await loginAsStudent(page)

    // Clear any existing grade level from localStorage
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('a-guy:user-profile')
    })

    // Navigate to /ask
    await page.goto('/ask')
    await page.waitForLoadState('load')

    // The URL should NOT be /start (this is the bug)
    // Instead, it should be /courses where user can select a course
    const currentUrl = page.url()

    // Bug: currently redirects to /start
    // Expected: should redirect to /courses
    expect(currentUrl).not.toContain('/start')
    expect(currentUrl).toContain('/courses')

    // After fix, it should redirect to /courses
    await expect(page).toHaveURL(/\/courses/, { timeout: 5000 })
  })

  test('should show Ask interface when user has selected a course', async ({ page }) => {
    // Set up authenticated user
    await loginAsStudent(page)

    // Set a grade level in localStorage (simulating course selection)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem(
        'a-guy:user-profile',
        JSON.stringify({
          gradeLevel: '8',
          mood: '',
          lastVisit: new Date().toISOString(),
        }),
      )
    })

    // Navigate to /ask
    await page.goto('/ask')
    await page.waitForLoadState('networkidle')

    // Should show the Ask interface (not redirect)
    await expect(page).toHaveURL(/\/ask/)

    // Check that some Ask-related content is visible
    // The page should show a button (either New Question or existing conversation)
    const hasAskContent = await page
      .locator('button')
      .first()
      .isVisible()
      .catch(() => false)

    expect(hasAskContent).toBeTruthy()
  })
})
