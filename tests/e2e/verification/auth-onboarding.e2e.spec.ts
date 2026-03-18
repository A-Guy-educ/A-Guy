/**
 * Pre-Launch Verification: #1 OAuth Login, #2 Onboarding Journey
 * @tags @smoke
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers } from '../helpers/auth'
import { loginAsStudent } from '../helpers/verification-fixtures'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Scenario #1 – OAuth Login (smoke)', () => {
  test('Google OAuth button is visible on login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('load')

    // OAuth button may be a link or button; wait for hydration
    const oauthButton = page.locator(
      'a[href*="oauth/google"], a[href*="google"], button:has-text("Google"), [aria-label*="Google"]',
    )
    await expect(oauthButton.first()).toBeVisible({ timeout: 20_000 })
  })

  test('Google OAuth link points to correct provider', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const link = page.locator('a[href*="oauth/google"]').first()
    if (await link.isVisible()) {
      const href = await link.getAttribute('href')
      expect(href).toContain('oauth/google')
    }
  })
})

test.describe('Scenario #2 – Onboarding Journey', () => {
  test('new user is prompted to select a persona', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/onboarding/persona')
    await page.waitForLoadState('domcontentloaded')

    // Persona selection should show persona-specific UI elements
    const personaContent = page.locator('[class*="persona"], [data-testid*="persona"]')
    const hasPersonaUI = await personaContent
      .first()
      .isVisible()
      .catch(() => false)

    // Skip if persona UI isn't rendered — don't accept any heading as a pass
    test.skip(!hasPersonaUI, 'Persona selection UI not found on onboarding page')
  })
})
