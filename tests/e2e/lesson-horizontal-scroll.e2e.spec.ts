/**
 * E2E test: No horizontal scroll in any lesson display mode (mobile-first)
 * Reproduces issue #1767: Prevent horizontal scrolling in all lesson display
 * modes on all screen sizes.
 *
 * Acceptance criteria:
 * - No horizontal scrollbar visible at any viewport width (320px → desktop)
 * - Wide images/tables/drawings shrink to fit, not scroll
 * - Page-level horizontal scroll is not acceptable
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
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  })
  expect(hasHorizontalOverflow, `Viewport ${viewportLabel}: page has horizontal overflow`).toBe(
    false,
  )

  // Also check body and main content containers
  const bodyOverflow = await page.evaluate(() => {
    return document.body.scrollWidth > document.body.clientWidth + 1
  })
  expect(bodyOverflow, `Viewport ${viewportLabel}: body has horizontal overflow`).toBe(false)
}

test.describe('Issue #1767 – No horizontal scroll in lesson display modes', () => {
  async function openLessonAtViewport(
    page: Page,
    viewport: { width: number; height: number },
  ): Promise<void> {
    test.skip(!data, 'No test data available')
    await page.setViewportSize(viewport)
    await loginAsStudent(page)
    await page.goto(data!.lessonUrl)
    await page.waitForLoadState('domcontentloaded')
  }

  test('no horizontal scroll at 320px (small mobile)', async ({ page }) => {
    await openLessonAtViewport(page, { width: 320, height: 568 })
    // Give a moment for any async content to settle
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '320px')
  })

  test('no horizontal scroll at 375px (iPhone SE)', async ({ page }) => {
    await openLessonAtViewport(page, { width: 375, height: 667 })
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '375px')
  })

  test('no horizontal scroll at 768px (tablet)', async ({ page }) => {
    await openLessonAtViewport(page, { width: 768, height: 1024 })
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '768px')
  })

  test('no horizontal scroll at 1024px (desktop sm)', async ({ page }) => {
    await openLessonAtViewport(page, { width: 1024, height: 768 })
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '1024px')
  })

  test('no horizontal scroll at 1440px (desktop lg)', async ({ page }) => {
    await openLessonAtViewport(page, { width: 1440, height: 900 })
    await page.waitForTimeout(500)
    await expectNoHorizontalScroll(page, '1440px')
  })

  test('no horizontal scroll on PDF tab at 320px', async ({ page }) => {
    await openLessonAtViewport(page, { width: 320, height: 568 })
    await page.waitForTimeout(500)

    // Click PDF tab if available
    const pdfTab = page.getByRole('tab', { name: /pdf/i })
    if (await pdfTab.isVisible()) {
      await pdfTab.click()
      await page.waitForTimeout(500)
      await expectNoHorizontalScroll(page, '320px PDF tab')
    } else {
      test.skip()
    }
  })

  test('no horizontal scroll on Interactive tab at 320px', async ({ page }) => {
    await openLessonAtViewport(page, { width: 320, height: 568 })
    await page.waitForTimeout(500)

    // Click Interactive tab if available
    const interactiveTab = page.getByRole('tab', { name: /interactive/i })
    if (await interactiveTab.isVisible()) {
      await interactiveTab.click()
      await page.waitForTimeout(500)
      await expectNoHorizontalScroll(page, '320px Interactive tab')
    } else {
      test.skip()
    }
  })
})
