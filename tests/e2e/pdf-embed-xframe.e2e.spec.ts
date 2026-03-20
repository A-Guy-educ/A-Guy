import { test, expect } from '@playwright/test'

/**
 * E2E Test: PDF Embed X-Frame-Options Blocking Issue
 *
 * This test verifies that PDFEmbed handles external URLs with X-Frame-Options
 * blocking via download fallback.
 *
 * Fix: PDFEmbed now shows a download button when inline viewing is blocked.
 * Users can still access the PDF via download link.
 *
 * @see .tasks/pdf-xframe-plan.md for full plan
 */
test.describe('PDF Embed X-Frame-Options Issue', () => {
  /**
   * Test URL that sets X-Frame-Options: deny
   * Using the aguy.co.il domain mentioned in the bug report
   */
  const BLOCKED_URL = 'https://www.aguy.co.il/'
  const TEST_TITLE = 'Blocked PDF Test'

  test('should show download button that links to the blocked URL', async ({ page }) => {
    // Navigate to test page
    const testUrl = `/test/pdf-embed?url=${encodeURIComponent(BLOCKED_URL)}&title=${encodeURIComponent(TEST_TITLE)}`
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' })

    // Wait for page to be interactive
    await page.waitForTimeout(1000)

    // The test page should render
    await expect(page.locator('h1')).toContainText('PDF Embed Test')

    // Download button should be visible and link to the blocked URL
    const downloadButton = page.locator('a:has-text("Download")').first()
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toHaveAttribute('href', BLOCKED_URL)
  })

  test('test page displays URL parameters correctly', async ({ page }) => {
    const testUrl = `/test/pdf-embed?url=${encodeURIComponent(BLOCKED_URL)}&title=${encodeURIComponent(TEST_TITLE)}`
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' })

    // Check that the page title is displayed
    await expect(page.locator('h1')).toContainText('PDF Embed Test')

    // Check that the URL is displayed in the parameters section
    await expect(page.locator('code').first()).toContainText(BLOCKED_URL)
  })
})
