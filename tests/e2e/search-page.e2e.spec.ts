import { test, expect } from '@playwright/test'

test.describe('Search Page', () => {
  test('results area should be present after query submission via URL navigation', async ({
    page,
  }) => {
    // Navigate directly to search with a query parameter
    await page.goto('/search?q=algebra')

    // The search input should be visible
    const searchInput = page.locator('#search')
    await expect(searchInput).toBeVisible()

    // The results section or "no results" message should be visible
    // (Either results appear, or "no results found" message appears - both indicate results area is present)
    const resultsArea = page.locator(
      'text=/Courses & Lessons|No results found|Results for "algebra"/i',
    )
    await expect(resultsArea).toBeVisible({ timeout: 10000 })
  })

  test('results area should be present after typing and pressing Enter', async ({ page }) => {
    await page.goto('/search')

    // Type in the search input
    const searchInput = page.locator('#search')
    await searchInput.fill('algebra')

    // Press Enter to submit
    await searchInput.press('Enter')

    // Wait for URL to update
    await expect(page).toHaveURL(/\/search\?q=algebra/, { timeout: 5000 })

    // The results section should appear (either results or "no results found")
    const resultsArea = page.locator(
      'text=/Courses & Lessons|No results found|Results for "algebra"/i',
    )
    await expect(resultsArea).toBeVisible({ timeout: 10000 })
  })

  test('search results should persist after initial load with query param', async ({ page }) => {
    // Navigate to search with a query
    await page.goto('/search?q=algebra')

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle')

    // Verify the URL still has the query (not redirected to /search)
    await expect(page).toHaveURL(/\/search\?q=algebra/, { timeout: 5000 })

    // The results section should be present
    const resultsArea = page.locator(
      'text=/Courses & Lessons|No results found|Results for "algebra"/i',
    )
    await expect(resultsArea).toBeVisible({ timeout: 10000 })
  })
})
