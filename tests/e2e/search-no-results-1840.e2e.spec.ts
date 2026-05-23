/**
 * E2E Test: #1840 - /search page - no results rendered after search submit
 *
 * Bug: When a user types in the search box and presses Enter (or clicks submit),
 * the URL stays at /search and no results or empty-state renders.
 *
 * Root cause: The Search component's form onSubmit only calls e.preventDefault()
 * without triggering the debounced URL update. The URL only updates after the
 * 200ms debounce delay from the last keystroke, meaning pressing Enter immediately
 * after typing doesn't update the URL at all.
 *
 * Expected behavior: Pressing Enter or clicking submit should immediately
 * update the URL to /search?q=<query> and display results.
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers, setupAuthenticatedUser, generateTestUserEmail } from './helpers/auth'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('#1840 Search page - no results rendered after search submit', () => {
  test('should update URL and show results when user types and presses Enter', async ({ page }) => {
    // 1. Create and authenticate a student user
    const user = await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('search-bug'),
        password: 'TestPass123!',
      },
      'student',
    )
    expect(user.id).toBeDefined()

    // 2. Navigate to /search
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    // 3. Verify we're on the search page
    expect(page.url()).toContain('/search')

    // 4. Find the search input and type 'math'
    const searchInput = page.locator('input#search')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('math')

    // 5. Press Enter to submit the search
    await searchInput.press('Enter')

    // 6. Wait for URL to update with query param (this is the BUG - it doesn't update!)
    // The expected behavior is that the URL should immediately update to /search?q=math
    // and results should appear (or empty state if no matches)
    try {
      await page.waitForURL(/q=math/, { timeout: 5000 })
      // If we get here, the URL was updated - this is the FIXED behavior
      expect(page.url()).toContain('q=math')
    } catch {
      // TIMEOUT: URL did NOT update - this is the BUG
      const currentUrl = page.url()
      throw new Error(
        'BUG REPRODUCED: Pressed Enter but URL stayed at ' +
          currentUrl +
          ' instead of updating to /search?q=math. ' +
          "The form's onSubmit handler only calls e.preventDefault() without triggering the debounced search.",
      )
    }
  })

  test('should show results when URL has query param on page load', async ({ page }) => {
    // This test verifies that the page DOES render results when the URL has ?q=
    // (i.e., the bug is NOT in the page's search logic itself)

    // 1. Create and authenticate a student user
    const user = await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('search-bug-load'),
        password: 'TestPass123!',
      },
      'student',
    )
    expect(user.id).toBeDefined()

    // 2. Navigate directly to /search?q=test
    await page.goto('/search?q=test')
    await page.waitForLoadState('domcontentloaded')

    // 3. The page should show either results or empty state (not just a blank search form)
    // Either the course results, post results, or the "no results" message should be visible
    const hasContent =
      (await page
        .locator('text=/courses/i')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator('text=/no results/i')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator('text=/try a different/i')
        .isVisible()
        .catch(() => false))

    expect(hasContent, 'Page should show results or empty-state when loaded with ?q= param').toBe(
      true,
    )
  })
})
