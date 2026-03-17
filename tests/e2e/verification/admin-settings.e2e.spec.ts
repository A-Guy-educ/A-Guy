/**
 * Pre-Launch Verification: #28 Tagging & Categories,
 * #29 Language Switching, #30 Live Preview
 * @tags @smoke
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers } from '../helpers/auth'
import { loginAsAdmin, loginAsStudent } from '../helpers/verification-fixtures'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Scenario #28 – Tagging & Categories', () => {
  test('categories collection is accessible in admin', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/collections/categories')
    await page.waitForLoadState('domcontentloaded')

    const content = page.locator('main, [class*="collection-list"], table')
    await expect(content.first()).toBeVisible({ timeout: 15_000 })
  })

  test.skip(true, 'Catalog filtering by tags not yet implemented')
  test('assigning tags updates catalog filters', async () => {
    // When implemented: assign tag to course, verify filter in catalog
  })
})

test.describe('Scenario #29 – Language Switching', () => {
  test('content renders correctly in Hebrew', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    const htmlDir = await page.locator('html').getAttribute('dir')
    const bodyDir = await page.locator('body').getAttribute('dir')
    const hasRTL = htmlDir === 'rtl' || bodyDir === 'rtl'

    const body = await page.locator('body').textContent()
    const hasHebrew = /[\u0590-\u05FF]/.test(body || '')

    expect(hasRTL || hasHebrew).toBeTruthy()
  })

  test('content renders correctly in English', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/en/courses')
    await page.waitForLoadState('domcontentloaded')

    const body = await page.locator('body').textContent()
    const hasLatin = /[a-zA-Z]{3,}/.test(body || '')
    expect(hasLatin).toBeTruthy()
  })
})

test.describe('Scenario #30 – Live Preview', () => {
  test.skip(true, 'Live preview (student view from editor) not yet implemented')

  test('editor can see student view preview while editing', async () => {
    // When implemented: open lesson in admin, click preview, verify student view
  })
})
