/**
 * Stats Page Chart E2E Tests
 *
 * @tags @critical
 *
 * Verifies the stats page (/stats) renders chart components:
 * - Chart elements (SVG-based chart) are present in the DOM
 * - Chart container renders the study activity visualization
 */

import { expect, test } from '@playwright/test'

import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

test.describe('Stats Page Chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('stats page renders chart elements', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('stats-chart'),
        password: 'StatsChart123!',
      },
      'student',
    )

    await page.goto('/stats')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Chart should be present as an SVG element (recharts renders as SVG)
    const chartElements = page.locator(
      'svg.recharts-surface, svg[class*="recharts"], .recharts-wrapper',
    )
    const chartCount = await chartElements.count()
    expect(chartCount).toBeGreaterThan(0)
  })

  test('stats page has a chart container with study activity data', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('stats-chart-data'),
        password: 'StatsChart123!',
      },
      'student',
    )

    await page.goto('/stats')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // The chart should have a bar or line element representing study activity
    const barElements = page.locator('.recharts-bar, .recharts-line')
    const hasBarOrLine = await barElements.count()

    // Fallback: check for any SVG chart element with data
    const svgWithData = page.locator('svg[data-chart]')
    const hasSvgData = await svgWithData.count()

    expect(hasBarOrLine + hasSvgData).toBeGreaterThan(0)
  })
})
