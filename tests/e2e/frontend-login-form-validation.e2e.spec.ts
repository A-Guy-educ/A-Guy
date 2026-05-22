/**
 * Frontend Login Form Client-Side Validation E2E Test
 *
 * @tags @frontend @login @validation
 *
 * Verifies that the login form shows inline validation errors when:
 * 1. Submitting with empty fields
 * 2. Submitting with an invalid email format
 *
 * Issue: https://github.com/A-Guy-educ/A-Guy/issues/1780
 */

import { expect, test } from '@playwright/test'

test.describe('Frontend Login Form Client-Side Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows inline validation error when submitting with empty fields', async ({ page }) => {
    // Find the login form (the email/password form, not Google SSO)
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')

    // Wait for the form to be visible
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await expect(passwordInput).toBeVisible({ timeout: 10000 })

    // Click submit without filling any fields
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await submitButton.click()

    // Wait a moment for validation to show
    await page.waitForTimeout(500)

    // Should show inline validation errors for email and password
    // The error messages should be visible near the inputs
    const emailError = page
      .locator('text=Email is required')
      .or(page.locator('text=/email/i').locator('..').locator('p.text-destructive'))
    const passwordError = page
      .locator('text=Password is required')
      .or(page.locator('text=/password/i').locator('..').locator('p.text-destructive'))

    // At minimum, one of the errors should be visible
    // Check for any validation error message
    const errorMessages = page.locator('p.text-destructive')
    const errorCount = await errorMessages.count()
    expect(errorCount).toBeGreaterThan(0)
  })

  test('shows inline validation error when submitting with invalid email format', async ({
    page,
  }) => {
    // Find the login form
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')

    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await expect(passwordInput).toBeVisible({ timeout: 10000 })

    // Fill in an invalid email format
    await emailInput.fill('notanemail')
    await passwordInput.fill('somepassword')

    // Click submit
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Wait a moment for validation to show
    await page.waitForTimeout(500)

    // Should show inline validation error for email format
    // The form should NOT submit successfully
    // Instead, it should show "Enter a valid email" or similar
    const errorMessages = page.locator('p.text-destructive')
    const errorCount = await errorMessages.count()
    expect(errorCount).toBeGreaterThan(0)

    // Verify we're still on the login page (not redirected)
    await expect(page).toHaveURL(/\/login/)
  })
})
