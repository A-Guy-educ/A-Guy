/**
 * E2E test for issue #1499: /signup route should render signup page
 *
 * Expected: Navigating to /signup should render the signup page (not redirect to /login)
 *
 * The server-side code was incorrectly redirecting to /login when isPasswordLoginEnabled()
 * returned false. This test verifies the signup page renders correctly.
 */
import { expect, test } from '@playwright/test'

// Derive BASE_URL from env var (BOM sanitized), matching playwright.config.ts baseURL fallback
const BASE_URL = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/^﻿/, '')

test.describe('Signup Route (Issue #1499)', () => {
  test('navigating to /signup should render signup page, not redirect to /login', async ({
    page,
  }) => {
    // Navigate to the signup page
    await page.goto(`${BASE_URL}/signup`)

    // Verify the page loaded successfully by checking for a key element
    const heading = page.locator('h1', { hasText: /create account|sign up/i })
    await expect(heading).toBeVisible({ timeout: 10000 })

    // Verify we're on the signup page (not redirected to login)
    await expect(page).toHaveURL(/\/signup/)
  })

  test('signup page should display Google OAuth signup option', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)

    // Verify we're on signup page
    await expect(page).toHaveURL(/\/signup/)

    // Verify Google OAuth button is visible
    const googleButton = page.locator('button', { hasText: /google|continue with google/i })
    await expect(googleButton).toBeVisible()
  })

  test('signup page URL should not contain /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)

    // Verify we stayed on signup page
    await expect(page).toHaveURL(/\/signup/)

    // Also check the URL doesn't contain /login
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('/login')
  })
})
