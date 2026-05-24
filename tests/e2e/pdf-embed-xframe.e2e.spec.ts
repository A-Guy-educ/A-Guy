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

  test('page title should not show "No Title" when no title param is provided', async ({
    page,
  }) => {
    await page.goto('/test/pdf-embed', { waitUntil: 'domcontentloaded' })

    // The page should not display "No Title" in the document title
    const title = await page.locator('meta[name="title"]').getAttribute('content')
    expect(title).not.toContain('No Title')
  })

  test('should show fallback immediately when URL is empty string', async ({ page }) => {
    // Navigate with empty URL parameter (empty string, not missing)
    const testUrl = '/test/pdf-embed?url=&title=Test'
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' })

    // Wait a short time - the fallback should already be showing for empty URL
    // We should NOT see a blank white iframe
    await page.waitForTimeout(500)

    // The page should show the fallback UI (download button) for empty URL
    // because empty URL means the PDF cannot be displayed
    const downloadButton = page.locator('a:has-text("Download")').first()
    await expect(downloadButton).toBeVisible()
  })
})
