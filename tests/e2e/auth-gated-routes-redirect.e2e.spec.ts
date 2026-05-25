/**
 * Test for Issue #1969: Auth-gated routes /ask, /practice, /test
 * redirect silently to /start instead of showing the page or an auth message.
 *
 * When an authenticated user (with payload-token cookie) visits these routes
 * without a gradeLevel, they should see the page or an auth/access message,
 * not be silently redirected.
 */
import { expect, test } from '@playwright/test'

test.describe('Auth-gated routes redirect behavior (#1969)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test.describe.configure({ mode: 'serial' })

  test('authenticated user without gradeLevel visiting /ask should not be silently redirected', async ({
    page,
  }) => {
    // Set authenticated user cookie (but no gradeLevel in localStorage)
    await page.context().addCookies([
      {
        name: 'payload-token',
        value: 'fake-auth-token-for-testing',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    // Navigate to /ask
    await page.goto('/ask')
    await page.waitForLoadState('domcontentloaded')

    // Wait a bit for any potential redirect
    await page.waitForTimeout(1000)

    // The URL should still be /ask (not redirected to / or /start)
    // OR the page should show an auth/access message
    const currentUrl = page.url()
    expect(currentUrl).toMatch(/\/ask/)

    // Check if there's an auth/access message or the page content is visible
    const bodyText = await page.locator('body').textContent()
    // The page should show some content, not just blank
    expect(bodyText).toBeTruthy()
  })

  test('authenticated user without gradeLevel visiting /practice should not be silently redirected', async ({
    page,
  }) => {
    // Set authenticated user cookie (but no gradeLevel in localStorage)
    await page.context().addCookies([
      {
        name: 'payload-token',
        value: 'fake-auth-token-for-testing',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    // Navigate to /practice
    await page.goto('/practice')
    await page.waitForLoadState('domcontentloaded')

    // Wait a bit for any potential redirect
    await page.waitForTimeout(1000)

    // The URL should still be /practice (not redirected to / or /start)
    // OR the page should show an auth/access message
    const currentUrl = page.url()
    expect(currentUrl).toMatch(/\/practice/)

    // Check if there's an auth/access message or the page content is visible
    const bodyText = await page.locator('body').textContent()
    // The page should show some content, not just blank
    expect(bodyText).toBeTruthy()
  })

  test('authenticated user without gradeLevel visiting /test should not be silently redirected', async ({
    page,
  }) => {
    // Set authenticated user cookie (but no gradeLevel in localStorage)
    await page.context().addCookies([
      {
        name: 'payload-token',
        value: 'fake-auth-token-for-testing',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    // Navigate to /test
    await page.goto('/test')
    await page.waitForLoadState('domcontentloaded')

    // Wait a bit for any potential redirect
    await page.waitForTimeout(1000)

    // The URL should still be /test (not redirected to / or /start)
    // OR the page should show an auth/access message
    const currentUrl = page.url()
    expect(currentUrl).toMatch(/\/test/)

    // Check if there's an auth/access message or the page content is visible
    const bodyText = await page.locator('body').textContent()
    // The page should show some content, not just blank
    expect(bodyText).toBeTruthy()
  })
})
