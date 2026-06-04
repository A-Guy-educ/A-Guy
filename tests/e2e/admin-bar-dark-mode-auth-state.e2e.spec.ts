/**
 * Bug #2366: Thin white strip at top of page in dark mode for unauthenticated users
 *
 * Expected: No white strip at top of page in dark mode when not logged in.
 *           The AdminBar should not render at all (return null) for unauthenticated users.
 * Actual:   The outer div with py-2 bg-foreground text-background always renders on desktop
 *           because sm:block defeats the hidden class applied when show=false.
 *           The near-white bg-foreground creates a visible white strip at the top in dark mode.
 *
 * @tags @bug @admin-bar
 */
import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  cleanupTestUsers,
  createTestUser,
  generateTestUserEmail,
  type TestUser,
} from './helpers/auth'

async function authenticateAsAdmin(page: import('@playwright/test').Page, user: TestUser) {
  const payload = await getPayload({ config })
  const loginResult = await payload.login({
    collection: 'users',
    data: {
      email: user.email,
      password: user.password,
    },
  })

  if (loginResult && 'token' in loginResult && loginResult.token) {
    await page.context().addCookies([
      {
        name: 'payload-token',
        value: loginResult.token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])
  }
}

test.describe('Admin Bar dark mode unauthenticated users', () => {
  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('admin bar does not render for unauthenticated users on desktop', async ({ page }) => {
    // Set desktop viewport (1280px - above sm breakpoint of 640px)
    await page.setViewportSize({ width: 1280, height: 720 })

    // Force dark mode via data-theme attribute
    await page.goto('http://localhost:3000/')
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForLoadState('networkidle')

    // The admin bar outer div has py-2 bg-foreground text-background hidden sm:block
    // For unauthenticated users, this div should NOT exist in the DOM at all
    // (the fix returns null when !show)
    const adminBar = page.locator(
      'div[class*="bg-foreground"][class*="text-background"][class*="py-2"]',
    )

    // Wait briefly to ensure any JS rendering has settled
    await page.waitForTimeout(500)

    // The admin bar should not be present in the DOM for unauthenticated users
    const count = await adminBar.count()
    expect(count).toBe(0)
  })

  test('admin bar renders for authenticated admin users on desktop', async ({ page }) => {
    // Create admin user
    const adminUser = await createTestUser(
      {
        email: generateTestUserEmail('admin-bar-dark-mode'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    // Authenticate
    await authenticateAsAdmin(page, adminUser)

    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })

    // Force dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('http://localhost:3000/')
    await page.waitForLoadState('networkidle')

    // Admin bar should now be visible
    const adminBar = page.locator(
      'div[class*="bg-foreground"][class*="text-background"][class*="py-2"]',
    )

    await page.waitForTimeout(500)
    const isVisible = await adminBar.isVisible()
    expect(isVisible).toBe(true)
  })

  test('no white strip at top of page in dark mode when unauthenticated', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })

    // Force dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('http://localhost:3000/')
    await page.waitForLoadState('networkidle')

    await page.waitForTimeout(500)

    // The top of the page should not have a near-white strip
    // bg-foreground in dark mode is near-white (light gray ~#f5f5f5)
    // We check that the body background is the expected dark background color
    const bodyBg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })

    // The body background should be a dark color, not near-white
    // Parse rgb and verify it's a dark color (r+g+b < 100 or so)
    const match = bodyBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    expect(match).not.toBeNull()

    const [, r, g, b] = match!.map(Number)
    const isDark = r < 100 && g < 100 && b < 100
    expect(isDark).toBe(true)
  })
})
