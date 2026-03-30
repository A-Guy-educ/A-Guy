import { test, expect } from '@playwright/test'

test.describe('Visual Regression - Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Set a consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('landing page', async ({ page }) => {
    await page.goto('/start')
    // Wait for animations to settle
    await page.waitForTimeout(2000)
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    })
  })

  test('courses page', async ({ page }) => {
    await page.goto('/courses')
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('courses-page.png', {
      maxDiffPixelRatio: 0.05,
    })
  })

  test('login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixelRatio: 0.05,
    })
  })

  test('signup page', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('signup-page.png', {
      maxDiffPixelRatio: 0.05,
    })
  })
})
