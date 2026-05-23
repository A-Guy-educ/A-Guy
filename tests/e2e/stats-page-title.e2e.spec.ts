/**
 * Stats Page Title Test
 * Verifies that the /stats page has a descriptive page title
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers } from './helpers/auth'
import { loginAsStudent } from './helpers/verification-fixtures'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test('stats page has descriptive page title', async ({ page }) => {
  await loginAsStudent(page)
  await page.goto('/stats')
  await page.waitForLoadState('domcontentloaded')

  // Title should be "Statistics | A-Guy" following the pattern of other pages
  await expect(page).toHaveTitle('Statistics | A-Guy')
})
