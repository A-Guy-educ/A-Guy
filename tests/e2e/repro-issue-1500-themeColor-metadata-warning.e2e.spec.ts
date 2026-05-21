/**
 * Test for issue #1500: [P2] Move themeColor from metadata to viewport export
 *
 * The /login page should not produce console warnings about themeColor.
 * Next.js warns when themeColor is in metadata export instead of viewport export.
 *
 * Expected behavior: No console warnings about themeColor
 * Actual behavior (bug): Warning appears because themeColor is in metadata export
 */

import { test, expect, type ConsoleMessage } from '@playwright/test'

// Hardcode the URL to avoid dotenv BOM issues
const BASE_URL = 'http://localhost:3000'

test.describe('Issue #1500: themeColor metadata warning', () => {
  test('login page should not have themeColor metadata warning', async ({ page }) => {
    const consoleWarnings: string[] = []

    // Capture all console warnings
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text())
      }
    })

    // Navigate to the login page using full URL
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // Filter for themeColor-related warnings
    const themeColorWarnings = consoleWarnings.filter((warning) =>
      warning.toLowerCase().includes('themecolor'),
    )

    // Assert no themeColor warnings appear
    // The warning looks like: "Unsupported metadata themeColor is configured in metadata export in /login. Please move it to viewport export instead."
    expect(themeColorWarnings).toHaveLength(0)

    // Also check that the page loaded successfully
    await expect(page.locator('body')).toBeVisible()
  })

  test('homepage should not have themeColor metadata warning', async ({ page }) => {
    const consoleWarnings: string[] = []

    // Capture all console warnings
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text())
      }
    })

    // Navigate to the homepage using full URL
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')

    // Filter for themeColor-related warnings
    const themeColorWarnings = consoleWarnings.filter((warning) =>
      warning.toLowerCase().includes('themecolor'),
    )

    // Assert no themeColor warnings appear
    expect(themeColorWarnings).toHaveLength(0)
  })
})
