/**
 * E2E test for issue #2547: Ask page redirects to start but title stays as Ask
 *
 * Bug: When navigating to /ask without a gradeLevel, the user is redirected to
 * /start but the browser tab title remains "שאל | A-Guy" (the Ask page title)
 * instead of updating to reflect the start page.
 *
 * Expected: Both URL and browser tab title reflect the start page after redirect.
 */
import { test, expect } from '@playwright/test'

test.describe('Ask page redirect title bug #2547', () => {
  test('redirects to /start and updates browser title', async ({ page }) => {
    // Clear localStorage to simulate user without gradeLevel
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())

    // Navigate to /ask
    await page.goto('/ask')

    // Wait for redirect to complete
    await page.waitForURL(/\/start/, { timeout: 10000 })

    // The URL should now be /start
    expect(page.url()).toContain('/start')

    // The browser title should NOT be the Ask page title
    const title = await page.title()
    expect(title).not.toBe('שאל | A-Guy')

    // The title should also not contain just "שאל" (the Ask page title without template)
    expect(title).not.toContain('שאל')
  })
})
