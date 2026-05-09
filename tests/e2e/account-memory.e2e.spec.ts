/**
 * E2E Tests for Account Memory Page
 *
 * Tests:
 * - Memory page renders for authenticated users
 * - Memory page redirects unauthenticated users to login
 * - Memory link appears in account navigation
 * - Empty state is displayed with Brain icon and privacy link
 */
import { expect, test } from '@playwright/test'
import {
  cleanupTestUsers,
  createTestUser,
  generateTestUserEmail,
  setupAuthenticatedUser,
} from './helpers/auth'

test.describe('Account Memory Page', () => {
  let testUserEmail: string
  let testUserPassword: string

  test.beforeEach(async () => {
    testUserEmail = generateTestUserEmail('memory-account')
    testUserPassword = 'test123456'
  })

  // Clean up all test users after all tests complete
  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    // Navigate to memory page without being logged in
    await page.goto('/account/memory')

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('renders memory page for authenticated users with empty state', async ({ page }) => {
    // Create and authenticate user
    const user = await createTestUser({ email: testUserEmail, password: testUserPassword })
    await setupAuthenticatedUser(page, user)

    // Navigate to memory page
    await page.goto('/account/memory')
    await page.waitForLoadState('networkidle')

    // Should be on the memory page
    await expect(page).toHaveURL(/\/account\/memory/)

    // Should display the page title "Your Memory" or translated equivalent
    await expect(page.locator('h1')).toContainText(/memory/i)

    // Should display the Brain icon (in the empty state)
    const brainIcon = page.locator('svg[class*="lucide-brain"]').first()
    await expect(brainIcon).toBeVisible()

    // Should display the privacy link
    const privacyLink = page.locator('a[href*="privacy"]').first()
    await expect(privacyLink).toBeVisible()
  })

  test('shows Memory link in account navigation', async ({ page }) => {
    // Create and authenticate user
    const user = await createTestUser({ email: testUserEmail, password: testUserPassword })
    await setupAuthenticatedUser(page, user)

    // Navigate to account page
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Should display the Memory link
    const memoryLink = page.locator('a[href="/account/memory"]').first()
    await expect(memoryLink).toBeVisible()
    await expect(memoryLink).toContainText(/memory/i)
  })

  test('clicking Memory link navigates to memory page', async ({ page }) => {
    // Create and authenticate user
    const user = await createTestUser({ email: testUserEmail, password: testUserPassword })
    await setupAuthenticatedUser(page, user)

    // Navigate to account page
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Click the Memory link
    const memoryLink = page.locator('a[href="/account/memory"]').first()
    await memoryLink.click()

    // Should navigate to memory page
    await expect(page).toHaveURL(/\/account\/memory/)
  })

  test('privacy link opens in new tab', async ({ page }) => {
    // Create and authenticate user
    const user = await createTestUser({ email: testUserEmail, password: testUserPassword })
    await setupAuthenticatedUser(page, user)

    // Navigate to memory page
    await page.goto('/account/memory')
    await page.waitForLoadState('networkidle')

    // Find the privacy link
    const privacyLink = page.locator('a[href*="privacy"]').first()

    // Should have target="_blank" and rel="noopener noreferrer"
    await expect(privacyLink).toHaveAttribute('target', '_blank')
    await expect(privacyLink).toHaveAttribute('rel', /noopener/)
  })
})
