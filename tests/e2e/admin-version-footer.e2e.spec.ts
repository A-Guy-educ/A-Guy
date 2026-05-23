/**
 * Admin Version Footer E2E Tests
 *
 * @tags @smoke
 *
 * Verifies the admin footer displays the correct version number:
 * - Footer shows semantic version (v0.25.8) not debug text (vdev)
 * - Version matches package.json version
 */
import { test, expect } from '@playwright/test'

import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

test.describe('Admin Version Footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('admin footer shows semantic version not dev', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-version'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // The version-info div should be visible in the admin footer
    const versionInfo = page.locator('.version-info')
    await expect(versionInfo).toBeVisible()

    // The version should be in semantic versioning format (v0.25.8), NOT 'vdev'
    const versionText = await versionInfo.textContent()
    expect(versionText).toMatch(/^v\d+\.\d+\.\d+\s*•\s*Built/)
  })

  test('admin footer version matches package.json', async ({ page }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('admin-version-match'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // The version should be v0.25.8 (from package.json)
    const versionInfo = page.locator('.version-info')
    await expect(versionInfo).toBeVisible()

    const versionText = await versionInfo.textContent()
    // Version should be v0.25.8, not vdev or any other dev variant
    expect(versionText).toContain('v0.25.8')
    expect(versionText).not.toContain('vdev')
  })
})
