/**
 * Admin Version Footer E2E Tests
 *
 * @tags @critical
 *
 * Verifies the admin footer displays the correct version:
 * - Admin footer shows proper semantic version (vX.Y.Z) from package.json
 * - Admin footer does NOT show 'vdev' which indicates missing version configuration
 */

import { expect, test } from '@playwright/test'

import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

test.describe('Admin Version Footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('admin footer displays proper semantic version, not vdev', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-version-footer'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // The admin version footer is inside a div with class "version-info"
    const versionInfo = page.locator('.version-info')
    await expect(versionInfo).toBeVisible()

    // Get the text content of the version info
    const versionText = await versionInfo.textContent()

    // Should NOT contain 'vdev' which indicates the fallback 'dev' value
    expect(versionText).not.toContain('vdev')

    // Should contain a proper semantic version pattern vX.Y.Z
    // The version comes from package.json and matches the frontend footer
    expect(versionText).toMatch(/v\d+\.\d+\.\d+/)
  })

  test('admin footer version matches frontend footer version', async ({ page }) => {
    // Get version from frontend footer
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')

    const frontendVersionElement = page
      .locator('footer span.text-xs')
      .filter({ hasText: /^v\d+\.\d+\.\d+$/ })
    await expect(frontendVersionElement).toBeVisible()
    const frontendVersion = await frontendVersionElement.textContent()

    // Get version from admin footer
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-version-footer-match'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const adminVersionInfo = page.locator('.version-info')
    await expect(adminVersionInfo).toBeVisible()
    const adminVersionText = await adminVersionInfo.textContent()

    // Extract just the version part (e.g., "v0.25.9" from "v0.25.9 • Built 2026-01-15")
    const adminVersionMatch = adminVersionText?.match(/v\d+\.\d+\.\d+/)
    const adminVersion = adminVersionMatch ? adminVersionMatch[0] : null

    // The admin version should match the frontend version
    expect(adminVersion).toBe(frontendVersion)
  })

  test('admin footer displays build date', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-version-footer-date'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const versionInfo = page.locator('.version-info')
    await expect(versionInfo).toBeVisible()

    // Should contain "Built" followed by a date
    const versionText = await versionInfo.textContent()
    expect(versionText).toMatch(/Built \d{4}-\d{2}-\d{2}/)
  })
})
