/**
 * E2E test: Admin controls should be hidden on mobile viewport
 * Reproduces issue #1980: Mobile viewport exposes admin controls on frontend
 *
 * Acceptance criteria:
 * - Admin bar (PayloadAdminBar) should NOT be visible at 375px width
 * - Admin bar should NOT be visible at 320px width (small mobile)
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

test.describe('Issue #1980 – Admin bar hidden on mobile viewport', () => {
  test('admin bar should not be visible at 375px mobile viewport', async ({ page }) => {
    test.skip(!data, 'No test data available')

    // Login as admin to make the PayloadAdminBar visible
    await loginAsAdmin(page)

    // Navigate to the exercise page
    const exerciseUrl = data!.exercises[0]
      ? `/exercises/${data!.exercises[0].exerciseId}`
      : '/exercises/nonexistent'

    await page.goto(exerciseUrl)
    await page.waitForLoadState('domcontentloaded')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForLoadState('domcontentloaded')

    // The admin bar container div has the class 'sm:hidden'
    // At 375px (less than 640px sm breakpoint), sm:hidden does NOT apply,
    // so the element is visible - this is the bug!
    // After fix, the admin bar should use 'hidden' class and be invisible at all sizes
    const adminBar = page.locator('div[class*="bg-foreground"][class*="text-background"]').first()

    // The admin bar should NOT be visible on mobile
    // This assertion will FAIL before the fix (admin bar is visible due to sm:hidden bug)
    // and PASS after the fix (admin bar uses 'hidden' class)
    await expect(adminBar).not.toBeVisible()
  })

  test('admin bar should not be visible at 320px small mobile viewport', async ({ page }) => {
    test.skip(!data, 'No test data available')

    await loginAsAdmin(page)

    const exerciseUrl = data!.exercises[0]
      ? `/exercises/${data!.exercises[0].exerciseId}`
      : '/exercises/nonexistent'

    await page.goto(exerciseUrl)
    await page.waitForLoadState('domcontentloaded')

    // Set small mobile viewport
    await page.setViewportSize({ width: 320, height: 568 })
    await page.waitForLoadState('domcontentloaded')

    const adminBar = page.locator('div[class*="bg-foreground"][class*="text-background"]').first()

    // The admin bar should NOT be visible on small mobile
    await expect(adminBar).not.toBeVisible()
  })

  test('frontend navigation should be visible at mobile viewport', async ({ page }) => {
    test.skip(!data, 'No test data available')

    await loginAsAdmin(page)

    const exerciseUrl = data!.exercises[0]
      ? `/exercises/${data!.exercises[0].exerciseId}`
      : '/exercises/nonexistent'

    await page.goto(exerciseUrl)
    await page.waitForLoadState('domcontentloaded')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForLoadState('domcontentloaded')

    // Frontend header navigation should still be visible
    const header = page.locator('header[class*="sticky"]')
    await expect(header).toBeVisible()

    // Mobile menu button should be visible on mobile
    const mobileMenuButton = page.locator('button[aria-label="open menu"]')
    await expect(mobileMenuButton).toBeVisible()
  })
})
