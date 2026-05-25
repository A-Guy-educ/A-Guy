/**
 * E2E test for posts page title.
 *
 * Validates that:
 * 1. /posts page title uses brand-driven template (not hardcoded Payload CMS template text)
 * 2. /posts page title is "Posts | A-Guy" (brand titleTemplate applied)
 *
 * Covers issue: #2064
 */
import { test, expect, Page } from '@playwright/test'

async function getMetaName(page: Page, name: string): Promise<string | null> {
  return page.locator(`meta[name="${name}"]`).getAttribute('content')
}

test.describe('Posts page title', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('networkidle')
  })

  test('/posts page uses brand-driven title template', async ({ page }) => {
    await page.goto('http://localhost:3000/posts')
    await page.waitForLoadState('networkidle')

    const title = await getMetaName(page, 'title')
    // Title should use brand titleTemplate (Posts | A-Guy), NOT hardcoded Payload CMS template text
    expect(title).toBe('Posts | A-Guy')
  })

  test('/posts page title does not contain "Payload Website Template"', async ({ page }) => {
    await page.goto('http://localhost:3000/posts')
    await page.waitForLoadState('networkidle')

    const title = await getMetaName(page, 'title')
    // Title should NOT contain the hardcoded Payload CMS template text
    expect(title).not.toContain('Payload Website Template')
  })
})
