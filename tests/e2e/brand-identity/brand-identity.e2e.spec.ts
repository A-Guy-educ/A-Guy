/**
 * Brand Identity Smoke Tests
 *
 * Verifies that brand configuration is correctly reflected in the UI and
 * metadata, catching regressions where brand identity is accidentally hardcoded.
 *
 * These tests are the CI gate for brand identity. Any drift in brand config
 * (name, theme color, favicon, manifest) will fail the build.
 *
 * @tags @brand @smoke
 */
import { expect, test } from '@playwright/test'

import { getBrand } from '@/brands'

test.setTimeout(60_000)

/** Resolved once per worker — uses the server-side brand config. */
const brand = getBrand()
const brandName = brand.config.name
const themeColorLight = brand.config.themeColor.light

test.describe('brand identity smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded')
  })

  test('title contains brand name', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title).toContain(brandName)
  })

  test('og:site_name matches brand config', async ({ page }) => {
    await page.goto('/')
    const ogSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content')
    expect(ogSiteName).toBe(brandName)
  })

  test('themeColor meta tag matches brand themeColor.light', async ({ page }) => {
    await page.goto('/')
    const themeColorMeta = await page
      .locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
      .getAttribute('content')
    expect(themeColorMeta).toBe(themeColorLight)
  })

  test('favicon resolves to 200', async ({ page }) => {
    await page.goto('/')
    const faviconHref = await page.locator('link[rel="icon"]').first().getAttribute('href')
    expect(faviconHref).not.toBeNull()
    const response = await page.goto(faviconHref!)
    expect(response?.status()).toBe(200)
  })

  test('manifest contains brand name', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest')
    expect(response?.status()).toBe(200)
    const json = await response?.json()
    expect(json.name).toBe(brandName)
  })

  test('header logo is present', async ({ page }) => {
    await page.goto('/')
    // The BrandLogo SVG renders inside the home link in the header
    const logo = page.locator('header a[href="/"] svg').first()
    await expect(logo).toBeVisible({ timeout: 10_000 })
  })
})
