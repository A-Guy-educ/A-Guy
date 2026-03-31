import { test, expect } from '@playwright/test'

test.describe('Visual Regression - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('landing page - dark', async ({ page }) => {
    await page.goto('/start')
    // Set dark theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    })
    await page.waitForTimeout(2000)
    await expect(page).toHaveScreenshot('landing-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    })
  })

  test('login page - dark', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('login-dark.png', {
      maxDiffPixelRatio: 0.05,
    })
  })
})
