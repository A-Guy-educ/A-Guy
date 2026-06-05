/**
 * Bug #2484: Mobile hamburger menu drops logged-in user identity
 *
 * Route: /start (375px viewport)
 * Steps: Log in as QA account, resize to 375px, open hamburger menu
 *
 * Expected: Menu shows Welcome Yair, My Account, Logout — as on desktop
 * Actual: Mobile hamburger menu shows only Courses, Search, Language selector —
 *         no user name, account link, or logout
 *
 * Root cause: The `landing-page` CSS class (applied to body by HomePage)
 * hides the entire header with `display: none !important` on ALL viewports.
 * This makes the hamburger menu inaccessible on mobile.
 *
 * @tags @bug
 */
import { expect, test } from '@playwright/test'

import {
  cleanupTestUsers,
  createTestUser,
  generateTestUserEmail,
  setupAuthenticatedUser,
  type TestUser,
} from './helpers/auth'

test.describe('Mobile Hamburger Menu Auth State', () => {
  let testUser: TestUser

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test.beforeAll(async () => {
    // Create a test user via Payload API
    testUser = await createTestUser(
      {
        email: generateTestUserEmail('mobile-menu-auth'),
        password: 'TestPass123!',
      },
      'student',
    )
  })

  test('mobile hamburger menu button is accessible on /start at 375px viewport', async ({
    page,
  }) => {
    // Authenticate
    await setupAuthenticatedUser(
      page,
      { email: testUser.email, password: testUser.password },
      'student',
    )

    // Set mobile viewport first, THEN navigate
    await page.setViewportSize({ width: 375, height: 812 })

    // Navigate to /start
    await page.goto('/start')
    await page.waitForLoadState('networkidle')

    // The hamburger menu button should be visible on mobile
    // (before fix: it was hidden because body.landing-page header had display:none)
    const menuButton = page.locator('button[aria-label="Open menu"]')
    await expect(menuButton).toBeVisible({ timeout: 10_000 })
  })

  test('mobile hamburger menu shows account link and logout when authenticated', async ({
    page,
  }) => {
    // Authenticate
    await setupAuthenticatedUser(
      page,
      { email: testUser.email, password: testUser.password },
      'student',
    )

    // Set mobile viewport first, THEN navigate
    await page.setViewportSize({ width: 375, height: 812 })

    // Navigate to /start
    await page.goto('/start')
    await page.waitForLoadState('networkidle')

    // Open mobile menu - need to dismiss floating controls first
    // The floating controls (theme/language) are at top-right with z-50
    // We need to close any open dropdowns first
    await page.keyboard.press('Escape').catch(() => null)
    await page.waitForTimeout(300)

    const menuButton = page.locator('button[aria-label="Open menu"]')
    await expect(menuButton).toBeVisible({ timeout: 10_000 })

    // Click with force to bypass any overlay interception
    await menuButton.click({ force: true })
    await page.waitForTimeout(800) // Wait for menu animation

    // Verify menu is open
    const closeButton = page.locator('button[aria-label="Close menu"]')
    await expect(closeButton).toBeVisible({ timeout: 5000 })

    // Mobile menu auth section should show My Account and Logout (user is authenticated)
    // App renders Hebrew by default
    const myAccount = page.locator('text="החשבון שלי"')
    const logout = page.locator('text="התנתק"')
    await expect(myAccount).toBeVisible({ timeout: 3000 })
    await expect(logout).toBeVisible({ timeout: 3000 })
  })

  test('desktop header is hidden on /start (landing page) but visible on /courses', async ({
    page,
  }) => {
    // Authenticate
    await setupAuthenticatedUser(
      page,
      { email: testUser.email, password: testUser.password },
      'student',
    )

    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })

    // /start is an immersive landing page — header is intentionally hidden on desktop (lg+)
    await page.goto('/start')
    await page.waitForLoadState('networkidle')

    // User dropdown should be hidden on landing page at desktop
    const userDropdown = page.locator('[data-testid="user-dropdown"]')
    await expect(userDropdown).toBeHidden({ timeout: 5000 })

    // On a non-landing-page route (e.g. /courses), desktop header should show auth state
    await page.goto('/courses')
    await page.waitForLoadState('networkidle')

    const headerAuth = page.locator('[data-testid="header-auth"]')
    await expect(headerAuth).toBeVisible({ timeout: 5000 })
  })

  test('mobile hamburger menu shows login when not authenticated', async ({ page }) => {
    // Clear all cookies to ensure no auth
    const context = page.context()
    await context.clearCookies()

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    // Navigate to /start
    await page.goto('/start')
    await page.waitForLoadState('networkidle')

    // Close any open dropdowns
    await page.keyboard.press('Escape').catch(() => null)
    await page.waitForTimeout(300)

    // Open mobile menu
    const menuButton = page.locator('button[aria-label="Open menu"]')
    await expect(menuButton).toBeVisible({ timeout: 10_000 })
    await menuButton.click({ force: true })
    await page.waitForTimeout(800)

    // Verify menu is open
    const closeButton = page.locator('button[aria-label="Close menu"]')
    await expect(closeButton).toBeVisible({ timeout: 5000 })

    // Should show Login button (not My Account/Logout since not authenticated)
    // When clearing auth cookies, language also resets to English
    // Use nth(1) since desktop header nav (hidden on mobile) comes before mobile menu nav in DOM
    const mobileMenuLogin = page.locator('nav >> text="Log in"').nth(1)
    await expect(mobileMenuLogin).toBeVisible({ timeout: 3000 })
  })
})
