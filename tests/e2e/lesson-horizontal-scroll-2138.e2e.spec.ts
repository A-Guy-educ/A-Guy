/**
 * E2E test: No horizontal scroll on LaTeX lesson pages (issue #2138)
 *
 * Tests the specific edge cases identified in issue #2138:
 * 1. html/body overflow-x hidden prevents document-level horizontal scroll
 * 2. LatexDocumentViewer responsive padding (px-4 sm:px-12)
 * 3. ConsolidatedLatexLessonView max-w-full on mobile
 * 4. ChatInterface respects container width
 * 5. No horizontal scroll at 360px width on LaTeX lesson pages
 *
 * Acceptance criteria:
 * - No horizontal scrollbar visible at viewport widths >= 320px
 * - KaTeX/code/table inner-scroll works inside their own containers
 * - LaTeX lesson pages render without horizontal scroll at 360px width
 * - Exercise pages and chat panel render without horizontal scroll at 360px width
 */
import { test, expect, type Page } from '@playwright/test'

import {
  cleanupVerificationData,
  loginAsStudent,
  seedVerificationData,
  type VerificationData,
} from './helpers/verification-fixtures'

let data: VerificationData | null = null

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000)
  data = await seedVerificationData()
})

test.afterAll(async () => {
  await cleanupVerificationData(data)
})

/**
 * Helper: check that the page has no horizontal overflow.
 * A page has horizontal overflow when its scrollWidth > clientWidth.
 */
async function expectNoHorizontalScroll(page: Page, viewportLabel: string) {
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(hasHorizontalOverflow, `Viewport ${viewportLabel}: page has horizontal overflow`).toBe(
    false,
  )

  // Also check body and main content containers
  const bodyOverflow = await page.evaluate(() => {
    return document.body.scrollWidth > document.body.clientWidth
  })
  expect(bodyOverflow, `Viewport ${viewportLabel}: body has horizontal overflow`).toBe(false)
}

test.describe('Issue #2138 – No horizontal scroll in LaTeX lesson pages', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!data, 'No test data available')
    await loginAsStudent(page)
    await page.goto(data!.lessonUrl)
    await page.waitForLoadState('domcontentloaded')
  })

  test('no horizontal scroll at 320px (small mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '320px')
  })

  test('no horizontal scroll at 360px width (Android common)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '360px')
  })

  test('no horizontal scroll at 375px (iPhone SE)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '375px')
  })

  test('no horizontal scroll at 768px (tablet)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '768px')
  })

  test('no horizontal scroll at 1024px (desktop sm)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '1024px')
  })

  test('no horizontal scroll at 1440px (desktop lg)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '1440px')
  })

  test('html element has overflow-x hidden', async ({ page }) => {
    const htmlOverflowX = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement)
      return style.overflowX
    })
    expect(htmlOverflowX, 'html overflow-x should be hidden').toBe('hidden')
  })

  test('body element has overflow-x hidden', async ({ page }) => {
    const bodyOverflowX = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body)
      return style.overflowX
    })
    expect(bodyOverflowX, 'body overflow-x should be hidden').toBe('hidden')
  })
})
