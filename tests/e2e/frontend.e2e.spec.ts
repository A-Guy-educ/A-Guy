import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    await context.newPage()
  })

  test.skip('can go on homepage', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // Check that the page loads successfully (not a 404 or error page)
    await expect(page).toHaveURL('http://localhost:3000/')

    // Verify page loaded with some content (not a blank page)
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Page should not show an error message
    const bodyText = await body.textContent()
    expect(bodyText).not.toMatch(/404|not found|error/i)
  })
})
