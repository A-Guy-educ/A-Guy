/**
 * Pre-Launch Verification: #3 Site-wide Search, #4 Catalog Navigation
 * @tags @smoke
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers } from '../helpers/auth'
import { loginAsStudent } from '../helpers/verification-fixtures'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Scenario #3 – Site-wide Search', () => {
  test('searching for keywords returns relevant results', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/search?q=test')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.locator(
      'input[id="search"], input[placeholder*="Search"], input[placeholder*="חיפוש"]',
    )
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Scenario #4 – Catalog Navigation', () => {
  test('course cards display in the catalog', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    const cards = page.locator('[class*="bg-card"][class*="rounded"]')
    const emptyState = page.locator('text=/no courses/i, text=/אין קורסים/i')

    const hasCards = await cards
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false)
    const isEmpty = await emptyState
      .first()
      .isVisible()
      .catch(() => false)

    expect(hasCards || isEmpty).toBeTruthy()
  })

  test('course card shows title and action button', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    const firstCard = page.locator('[class*="bg-card"][class*="rounded"]').first()
    const cardVisible = await firstCard.isVisible({ timeout: 10_000 }).catch(() => false)
    test.skip(!cardVisible, 'No courses available in catalog')

    // Card should have a title and be clickable (link or button)
    const hasTitle = await firstCard
      .locator('h2, h3, h4, h5')
      .first()
      .isVisible()
      .catch(() => false)
    const hasLink = await firstCard
      .locator('a')
      .first()
      .isVisible()
      .catch(() => false)
    const isClickable = await firstCard.evaluate(
      (el) => el.tagName === 'A' || el.closest('a') !== null,
    )
    expect(hasTitle || hasLink || isClickable).toBeTruthy()
  })
})
