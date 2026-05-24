/**
 * Search functionality tests - reproduces bug #2033
 * @tags @search
 */
import { expect, test } from '@playwright/test'

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to search page
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')
  })

  test('searching for "math" should display results after form submission', async ({ page }) => {
    const searchInput = page.locator(
      'input[id="search"], input[placeholder*="Search"], input[placeholder*="חיפוש"]',
    )
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })

    // Type 'math' in the search input
    await searchInput.first().fill('math')

    // Wait for debounce (200ms) + navigation + results to load
    await page.waitForURL(/\/search\?q=math/, { timeout: 5000 })

    // Verify results are displayed (either course results or "no results" message)
    const hasResults = await page
      .locator('text=/No results found/i')
      .isVisible()
      .catch(() => false)
    const hasCourseResults = await page
      .locator('text=/Courses & Lessons/i')
      .isVisible()
      .catch(() => false)
    const hasBlogResults = await page
      .locator('[class*="bg-card"][class*="rounded"]')
      .first()
      .isVisible()
      .catch(() => false)

    // Should either show results or a "no results" message - not just an empty page
    expect(hasResults || hasCourseResults || hasBlogResults).toBeTruthy()
  })

  test('URL should update with query parameter after typing', async ({ page }) => {
    const searchInput = page.locator(
      'input[id="search"], input[placeholder*="Search"], input[placeholder*="חיפוש"]',
    )
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })

    // Get initial URL
    const initialUrl = page.url()
    expect(initialUrl).toContain('/search')

    // Type 'test' in the search input
    await searchInput.first().fill('test')

    // Wait for URL to include query parameter
    await page.waitForURL(/\/search\?q=test/, { timeout: 5000 })

    // Verify the URL has the query parameter
    expect(page.url()).toContain('q=test')
  })
})
