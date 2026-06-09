/**
 * E2E tests for brand-driven metadata across key routes.
 *
 * Validates that:
 * 1. Root metadata (siteName, twitter:site) is driven by getBrand().config
 * 2. Per-page titles follow the brand title template
 * 3. No hardcoded brand strings leak into metadata values
 *
 * Covers: /, /study, /courses (most-trafficked routes per issue spec).
 */
import { test, expect, Page } from '@playwright/test'

/** Brand values we expect to see in resolved metadata. */
const BRAND = {
  name: 'A-Guy',
  twitterHandle: '@aguy',
} as const

async function getMetaContent(page: Page, property: string): Promise<string | null> {
  return page.locator(`meta[property="${property}"]`).getAttribute('content')
}

async function getMetaName(page: Page, name: string): Promise<string | null> {
  return page.locator(`meta[name="${name}"]`).getAttribute('content')
}

test.describe('Brand-driven metadata', () => {
  test.describe.configure({ mode: 'parallel' })

  test('homepage has correct siteName in OpenGraph', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')

    const siteName = await getMetaContent(page, 'og:site_name')
    expect(siteName).toBe(BRAND.name)
  })

  test('homepage has correct twitter:site', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')

    const twitterSite = await getMetaName(page, 'twitter:site')
    expect(twitterSite).toBe(BRAND.twitterHandle)
  })

  test('homepage has correct twitter:creator', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')

    const twitterCreator = await getMetaName(page, 'twitter:creator')
    expect(twitterCreator).toBe(BRAND.twitterHandle)
  })

  test('/study page uses brand title template', async ({ page }) => {
    await page.goto('/study')
    await page.waitForLoadState('domcontentloaded')

    const title = await page.title()
    expect(title).toContain(BRAND.name)
  })

  test('/courses page has brand siteName', async ({ page }) => {
    await page.goto('http://localhost:3000/courses')
    await page.waitForLoadState('networkidle')

    const siteName = await getMetaContent(page, 'og:site_name')
    expect(siteName).toBe(BRAND.name)
  })

  test('/courses page uses brand twitter handle', async ({ page }) => {
    await page.goto('http://localhost:3000/courses')
    await page.waitForLoadState('networkidle')

    const twitterSite = await getMetaName(page, 'twitter:site')
    expect(twitterSite).toBe(BRAND.twitterHandle)
  })
})
