import { test, expect } from '@playwright/test'

const MOBILE_VIEWPORT = { width: 375, height: 812 }
const TABLET_VIEWPORT = { width: 768, height: 1024 }

test.describe('Visual Regression - Responsive', () => {
  test('landing page - mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/start')
    await page.waitForTimeout(2000)
    await expect(page).toHaveScreenshot('landing-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    })
  })

  test('landing page - tablet', async ({ page }) => {
    await page.setViewportSize(TABLET_VIEWPORT)
    await page.goto('/start')
    await page.waitForTimeout(2000)
    await expect(page).toHaveScreenshot('landing-tablet.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    })
  })

  test('login page - mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/login')
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('login-mobile.png', {
      maxDiffPixelRatio: 0.05,
    })
  })
})
