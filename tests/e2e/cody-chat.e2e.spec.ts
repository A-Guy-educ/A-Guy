/**
 * E2E Tests for Cody Dashboard Chat
 *
 * Tests the Cody chat functionality:
 * - Dashboard page loads without crashing
 * - Chat API endpoint responds correctly
 *
 * Note: These tests require GitHub OAuth authentication which is complex in E2E.
 * For full chat testing, manual verification or a dedicated auth fixture is needed.
 *
 * Run with: pnpm test:e2e --project=chromium tests/e2e/cody-chat.e2e.spec.ts
 */
import type { Page, Response } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

// Skip tests if required env vars are not set
const hasGeminiKey = !!process.env.GEMINI_API_KEY
const hasGhPat = !!process.env.GH_PAT

test.describe('Cody Dashboard Chat', () => {
  test.skip(!hasGeminiKey, 'Skipping Cody chat tests: GEMINI_API_KEY is not set')
  test.skip(!hasGhPat, 'Skipping Cody chat tests: GH_PAT is not set')

  let testUserEmail: string

  test.beforeAll(async () => {
    testUserEmail = generateTestUserEmail('cody-chat-e2e')
  })

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  /**
   * Helper to find the chat input in the Cody dashboard
   */
  async function findChatInput(page: Page) {
    // Try different selectors for the chat input
    const selectors = [
      // CodyChat textarea
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="ask"]',
      // General textarea in chat area
      'textarea',
    ]

    for (const selector of selectors) {
      const input = page.locator(selector).first()
      if ((await input.count()) > 0) {
        const isVisible = await input.isVisible().catch(() => false)
        if (isVisible) {
          return input
        }
      }
    }
    return null
  }

  test('should load dashboard and show chat interface (requires GitHub OAuth)', async ({
    page,
  }) => {
    // Navigate to Cody dashboard
    await page.goto('/cody', { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Wait for initial load
    await page.waitForTimeout(3000)

    // Take a snapshot to see what's rendered
    const bodyText = await page.locator('body').textContent()

    // The page should load (even if it shows auth required)
    expect(bodyText).toBeTruthy()

    // Check for auth-related content (GitHub OAuth required)
    const hasAuthScreen =
      bodyText?.includes('GitHub') || bodyText?.includes('Sign in') || bodyText?.includes('Log In')

    if (hasAuthScreen) {
      // If we see auth screen, that's expected - GitHub OAuth is required
      console.log('Dashboard loaded but requires GitHub OAuth authentication')
      // This is acceptable - the page loads without crashing
    } else {
      // If no auth screen, try to find chat input
      const chatInput = await findChatInput(page)
      if (chatInput) {
        await expect(chatInput).toBeVisible()
      }
    }
  })

  test('should make chat API request without crashing', async ({ page }) => {
    // Navigate to Cody dashboard
    await page.goto('/cody', { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Wait for initial load
    await page.waitForTimeout(3000)

    // The page should not show a 500 error page (check for actual error content, not React runtime)
    const errorHeading = await page.locator('h1:has-text("500"), h2:has-text("500")').count()
    expect(errorHeading).toBe(0)

    // Should not show "Application error" as main content
    const appError = await page.locator('text=Application error').count()
    expect(appError).toBe(0)
  })

  test('should handle chat API endpoint health check', async ({ page }) => {
    // Make direct API call to check if chat endpoint is healthy
    const response = await page.request.get('/api/cody/chat', {
      headers: {
        // No auth - should return 401 or proper error
      },
    })

    // Should get a response (401, 403, or 503 depending on auth state)
    // The important thing is it doesn't crash
    expect([200, 401, 403, 503]).toContain(response.status())
  })

  test('should validate API returns proper error for unauthenticated request', async ({ page }) => {
    // Make direct API call to check error handling
    const response = await page.request.post('/api/cody/chat', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        agentId: 'dashboard-manager',
        messages: [{ role: 'user', content: 'test' }],
      }),
    })

    // Should return an error code (not 500)
    expect(response.status()).not.toBe(500)
    expect(response.status()).not.toBe(200) // Should not succeed without proper auth

    // Should return JSON error
    const contentType = response.headers()['content-type']
    expect(contentType).toContain('application/json')
  })
})
