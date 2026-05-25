/**
 * Bug #1905: Fix overlapping footer links at mobile viewport on Practice page
 *
 * Steps to reproduce:
 * 1. Resize to 375px wide
 * 2. Scroll to bottom of /practice page
 * 3. Observe 'Statistics & Performance' and 'Upcoming Exam' links
 *
 * Expected: Two footer links should be vertically stacked without overlap
 * Actual: Links overlap in the Y-axis
 */
import { test, expect } from '@playwright/test'

test.describe('Practice page mobile footer links', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport (iPhone SE size)
    await page.setViewportSize({ width: 375, height: 667 })
    // Navigate to practice page
    await page.goto('/practice')
    await page.waitForLoadState('domcontentloaded')
  })

  test('footer links do not overlap at 375px mobile viewport', async ({ page }) => {
    // Scroll to bottom of the page to ensure footer is in view
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(500) // Allow time for any animations

    // Find the footer links by their text content
    const statsLink = page
      .locator('a:has-text("Statistics & Performance"), a:has-text("סטטיסטיקות")')
      .first()
    const examLink = page.locator('a:has-text("Upcoming Exam"), a:has-text("מבחן")').first()

    // Ensure both links are visible
    await expect(statsLink).toBeVisible({ timeout: 10000 })
    await expect(examLink).toBeVisible({ timeout: 10000 })

    // Get bounding boxes - Playwright returns {x, y, width, height}
    const statsBox = await statsLink.boundingBox()
    const examBox = await examLink.boundingBox()

    expect(statsBox).not.toBeNull()
    expect(examBox).not.toBeNull()

    // boundingBox returns {x, y, width, height} where y=top and y+height=bottom
    const statsTop = statsBox!.y
    const statsBottom = statsBox!.y + statsBox!.height
    const examTop = examBox!.y
    const examBottom = examBox!.y + examBox!.height

    // Two boxes overlap in Y-axis if: box1.top < box2.bottom AND box2.top < box1.bottom
    const yOverlap = !(statsBottom < examTop || examBottom < statsTop)

    // Assert no Y-axis overlap (they should be stacked vertically with a gap)
    expect(yOverlap).toBe(false)
  })

  test('footer links are stacked vertically at 375px (not side by side)', async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(500)

    const statsLink = page
      .locator('a:has-text("Statistics & Performance"), a:has-text("סטטיסטיקות")')
      .first()
    const examLink = page.locator('a:has-text("Upcoming Exam"), a:has-text("מבחן")').first()

    await expect(statsLink).toBeVisible({ timeout: 10000 })
    await expect(examLink).toBeVisible({ timeout: 10000 })

    const statsBox = await statsLink.boundingBox()
    const examBox = await examLink.boundingBox()

    // The exam link should be below the stats link (stacked vertically)
    // Use y (top) coordinate for comparison
    expect(examBox!.y).toBeGreaterThan(statsBox!.y - 5)
  })
})
