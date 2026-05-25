/**
 * E2E Tests: Study Plan Auth Redirect
 *
 * Verifies that unauthenticated users are redirected to /login
 * when visiting /study-plan, rather than seeing an empty state.
 *
 * Fixes: #2066
 */

import { test, expect } from '@playwright/test'

test.describe('Study Plan Auth Redirect', () => {
  test('redirects to /login when unauthenticated', async ({ page }) => {
    // Navigate to study-plan without any auth cookie
    await page.goto('/study-plan')
    await page.waitForLoadState('load')

    // Should be redirected to login page, not show the empty plan state
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    // Verify we're on the login page (not the empty "Ready to start?" state)
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).not.toMatch(/Ready to start\?/i)
  })
})
