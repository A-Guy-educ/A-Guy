/**
 * Bug #1990: Search UI feedback after submit
 * @tags @smoke
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers } from '../helpers/auth'
import { loginAsStudent } from '../helpers/verification-fixtures'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Search UI Feedback', () => {
  test('submitting search form shows results or empty state', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.locator(
      'input[id="search"], input[placeholder*="Search"], input[placeholder*="חיפוש"]',
    )
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })

    // Type in the search box
    await searchInput.first().fill('math')

    // Click submit button (it's sr-only but should still work as form submit)
    await page.locator('button[type="submit"]').click()

    // Wait for URL to change to include the query
    await page.waitForURL(/\?q=math/, { timeout: 5000 })

    // After submit, we should see either:
    // 1. Results (course content or posts)
    // 2. Empty state ("No results found")
    // NOT just the empty search page with no indication anything happened
    const hasResultsOrEmptyState =
      (await page
        .locator('text=/No results found|try a different search term/i')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator('h2:has-text("Courses & Lessons")')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator('[class*="bg-card"][class*="rounded"]')
        .first()
        .isVisible()
        .catch(() => false))

    expect(hasResultsOrEmptyState).toBeTruthy()
  })

  test('typing in search and waiting debounce navigates to results', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.locator(
      'input[id="search"], input[placeholder*="Search"], input[placeholder*="חיפוש"]',
    )
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })

    // Type in the search box
    await searchInput.first().fill('math')

    // Wait for debounce to fire and URL to change
    await page.waitForURL(/\?q=math/, { timeout: 5000 })

    // After debounce, we should see either results or empty state
    const hasResultsOrEmptyState =
      (await page
        .locator('text=/No results found|try a different search term/i')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator('h2:has-text("Courses & Lessons")')
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator('[class*="bg-card"][class*="rounded"]')
        .first()
        .isVisible()
        .catch(() => false))

    expect(hasResultsOrEmptyState).toBeTruthy()
  })
})
