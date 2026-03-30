import { test, expect } from '@playwright/test'

test.describe('Visual Regression - Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('error page', async ({ page }) => {
    await page.goto('/nonexistent-page-12345')
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('error-page.png', {
      maxDiffPixelRatio: 0.05,
    })
  })
})
