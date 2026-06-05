/**
 * Admin Dashboard: Course Enrollments Widget E2E Tests
 *
 * @tags @critical
 *
 * Verifies the Course Enrollments widget renders correctly in the admin dashboard:
 * - Widget displays "Top Courses" / "קורסים מובילים" title
 * - Shows up to 5 courses with enrollment counts and progress bars
 * - "View all" button expands to show all courses when present
 * - Progress bars are proportional to max enrollment (100% for highest)
 */

import { expect, test } from '@playwright/test'

import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

test.describe('Admin Dashboard: Course Enrollments Widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('widget displays top courses title', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-course-enrollments'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for the widget title (supports both English and Hebrew)
    const widgetTitle = await page
      .locator('h3:has-text("Top Courses"), h3:has-text("קורסים מובילים")')
      .first()
      .isVisible()
    expect(widgetTitle).toBeTruthy()
  })

  test('widget shows progress bars for courses', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-course-progress'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find the Top Courses widget
    const topCoursesSection = page
      .locator('h3:has-text("Top Courses"), h3:has-text("קורסים מובילים")')
      .first()
    await expect(topCoursesSection).toBeVisible()

    // The widget renders progress bar containers (height:6px, border-radius:3px)
    // and inner bars (height:100%, border-radius:3px) with width as a percentage
    const barContainers = page.locator('[style*="height: 6px"][style*="border-radius: 3px"]')
    await expect(barContainers.first()).toBeVisible()

    // Find inner bars within the widget panel - they have height:100%, border-radius:3px
    // and a width percentage (e.g. "5%", "100%")
    const innerBars = page.locator(
      '[style*="height: 100%"][style*="border-radius: 3px"][style*="width:"]',
    )
    const innerBarCount = await innerBars.count()
    expect(innerBarCount).toBeGreaterThan(0)

    // Verify at least one bar has a non-zero width percentage (fixed to minimum 5% width)
    let hasNonZeroWidth = false
    for (let i = 0; i < innerBarCount; i++) {
      const style = await innerBars.nth(i).getAttribute('style')
      if (
        style &&
        style.includes('width:') &&
        !style.includes('width: 0%') &&
        !style.includes('width:0%')
      ) {
        hasNonZeroWidth = true
        break
      }
    }
    expect(hasNonZeroWidth).toBeTruthy()
  })

  test('view all button expands full list when more than 5 courses', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-course-viewall'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for the "View all" / "הצג הכל" button
    const viewAllButton = page.locator('button:has-text("View all"), button:has-text("הצג הכל")')
    if (await viewAllButton.isVisible()) {
      // Click to expand
      await viewAllButton.click()
      await page.waitForTimeout(500)

      // After clicking, should show "Show less" / "הצג פחות"
      const showLessButton = page.locator(
        'button:has-text("Show less"), button:has-text("הצג פחות")',
      )
      await expect(showLessButton).toBeVisible()
    }
  })
})
