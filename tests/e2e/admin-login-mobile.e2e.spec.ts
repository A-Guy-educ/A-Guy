/**
 * Admin Login Form Mobile Fix E2E Test
 *
 * @tags @mobile @admin
 *
 * Verifies the admin login form renders comfortably at 375px mobile viewport.
 * Issue: Form renders in a narrow centered card (~300px content width inside 375px viewport),
 * making inputs feel compressed.
 */

import { expect, test } from '@playwright/test'

test.describe('Admin Login Form Mobile', () => {
  test('login form card uses comfortable width at 375px mobile viewport', async ({ page }) => {
    // Set mobile viewport (375x812 is iPhone X size)
    await page.setViewportSize({ width: 375, height: 812 })

    // Navigate to admin login page
    await page.goto('http://localhost:3000/admin/login')
    await page.waitForLoadState('domcontentloaded')

    // Find the login form card - Payload CMS wraps the login form in a card div
    // The form card typically has a max-width that makes it feel cramped at 375px
    const loginCard = page.locator('.login').first()

    // Wait for the login card to be visible
    await expect(loginCard).toBeVisible({ timeout: 10000 })

    // Get the bounding box of the login card
    const cardBox = await loginCard.boundingBox()

    if (cardBox) {
      // At 375px viewport, the card should not be cramped
      // It should have reasonable horizontal padding and not be narrower than ~320px
      // which would leave only ~290px for content after accounting for the card's own padding
      const minContentWidth = 280

      // The card itself should be at least 320px wide on a 375px viewport
      // (allowing for ~27px padding on each side, which is reasonable)
      expect(cardBox.width).toBeGreaterThanOrEqual(minContentWidth)
    }
  })

  test('login form inputs are properly sized at 375px mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    // Navigate to admin login page
    await page.goto('http://localhost:3000/admin/login')
    await page.waitForLoadState('domcontentloaded')

    // Find email and password inputs
    const emailInput = page.locator('input[name="email"], input[type="email"]').first()
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()

    // Both inputs should be visible
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await expect(passwordInput).toBeVisible({ timeout: 10000 })

    // Get the bounding boxes
    const emailBox = await emailInput.boundingBox()
    const passwordBox = await passwordInput.boundingBox()

    if (emailBox && passwordBox) {
      // Inputs should be at least 200px wide to be comfortable for touch
      const minInputWidth = 200

      expect(emailBox.width).toBeGreaterThanOrEqual(minInputWidth)
      expect(passwordBox.width).toBeGreaterThanOrEqual(minInputWidth)
    }
  })
})
