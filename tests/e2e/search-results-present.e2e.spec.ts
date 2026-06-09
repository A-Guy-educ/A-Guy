/**
 * Bug #2573: Search results area absent after query submission
 *
 * Steps to reproduce:
 * 1. Navigate to /search
 * 2. Type 'algebra' in the search textbox
 * 3. Press Enter
 * 4. Navigate to /search?q=algebra
 *
 * Expected: Results section appears below the search bar showing matching content
 * Actual: Page renders only the search input with no results region
 *
 * Root cause: The Search component's useEffect fires after debounce delay and
 * pushes the current debounced value to the router. On mount, if the URL has
 * ?q=param but the component's local state is empty (''), the effect will
 * eventually push '/' (no query), wiping out the URL param and hiding results.
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers } from './helpers/auth'
import { loginAsStudent } from './helpers/verification-fixtures'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Search results', () => {
  test('search results are present when navigating directly to /search?q=algebra', async ({
    page,
  }) => {
    await loginAsStudent(page)

    // Navigate directly to search URL with query param
    await page.goto('/search?q=algebra')
    await page.waitForLoadState('domcontentloaded')

    // Verify results section is visible
    // The page should show either course results, blog posts, or "no results" - but NOT just the search form
    const resultsSection = page.locator(
      'h2:has-text("Courses & Lessons"), [class*="CollectionArchive"], p:has-text("No results found")',
    )
    await expect(resultsSection.first()).toBeVisible({ timeout: 10_000 })
  })

  test('search results are present after typing and pressing Enter', async ({ page }) => {
    await loginAsStudent(page)

    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.locator('input[id="search"]')
    await expect(searchInput).toBeVisible()

    // Type a query
    await searchInput.fill('algebra')

    // Wait for debounce to fire and URL to update
    await page.waitForURL('**/search?q=algebra**', { timeout: 5000 })

    // Verify results section is visible (either results or "no results found")
    const resultsSection = page.locator(
      'h2:has-text("Courses & Lessons"), [class*="CollectionArchive"], p:has-text("No results found")',
    )
    await expect(resultsSection.first()).toBeVisible({ timeout: 10_000 })
  })
})
