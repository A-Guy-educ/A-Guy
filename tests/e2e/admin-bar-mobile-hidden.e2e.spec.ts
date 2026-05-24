/**
 * E2E test: AdminBar hidden on mobile viewport at 375px on frontend pages
 * Reproduces issue #1973: Admin bar visible on frontend pages in mobile viewport
 *
 * Expected: AdminBar (Dashboard link, user email, Logout button) should NOT appear
 * on frontend pages at 375px viewport.
 *
 * Actual (bug): AdminBar is visible because sm:hidden only applies at 640px+,
 * so the conditional block: show=true makes it visible on mobile.
 */
import { test, expect } from '@playwright/test'

import {
  cleanupVerificationData,
  loginAsAdmin,
  seedVerificationData,
  type VerificationData,
} from './helpers/verification-fixtures'

let data: VerificationData | null = null

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000)
  data = await seedVerificationData()
})

test.afterAll(async () => {
  await cleanupVerificationData(data)
})

test.describe('Issue #1973 – AdminBar hidden on mobile frontend pages', () => {
  test('admin bar is hidden at 375px mobile viewport on /courses', async ({ page }) => {
    test.skip(!data, 'No test data available')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Log in as admin
    await loginAsAdmin(page)

    // Navigate to courses page
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    // The admin bar should NOT be visible at 375px
    // The admin bar container has class py-2 bg-foreground text-background
    // and contains PayloadAdminBar with Dashboard link, user info, Logout button
    const adminBar = page.locator('[class*="bg-foreground"][class*="text-background"]').first()
    await expect(adminBar).toBeHidden({ timeout: 5000 })
  })

  test('admin bar is visible at 640px+ viewport on /courses for logged-in admin', async ({
    page,
  }) => {
    test.skip(!data, 'No test data available')

    // Set desktop viewport (sm breakpoint = 640px)
    await page.setViewportSize({ width: 640, height: 800 })

    // Log in as admin
    await loginAsAdmin(page)

    // Navigate to courses page
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    // The admin bar SHOULD be visible at 640px+ when logged in
    const adminBar = page.locator('[class*="bg-foreground"][class*="text-background"]').first()
    await expect(adminBar).toBeVisible({ timeout: 5000 })
  })

  test('admin bar is hidden at 375px on /courses when not logged in', async ({ page }) => {
    test.skip(!data, 'No test data available')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Navigate to courses page (not logged in)
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    // The admin bar should be hidden (or absent) when not logged in
    const adminBar = page.locator('[class*="bg-foreground"][class*="text-background"]').first()
    if ((await adminBar.count()) > 0) {
      await expect(adminBar).toBeHidden({ timeout: 5000 })
    }
  })
})
