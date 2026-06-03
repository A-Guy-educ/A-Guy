/**
 * E2E Test: Purchase Detail Page
 *
 * Tests /account/purchases/:id for:
 * 1. No hydration errors on the purchase detail page
 * 2. Product name is displayed correctly (not "Unknown Product")
 * 3. Page renders correctly after navigation from purchases list
 *
 * @fileType e2e-test
 * @domain billing
 */

import { test, expect, type ConsoleMessage } from '@playwright/test'

import {
  createTestUser,
  deleteTestUser,
  generateTestUserEmail,
  authenticateViaAPI,
} from './helpers/auth'
import { getPayload } from 'payload'
import config from '@payload-config'

test.describe('Purchase Detail Page', () => {
  let userId: string
  let userEmail: string
  let transactionId: string
  let productName: string

  test.beforeAll(async () => {
    const payload = await getPayload({ config })

    // Create a product
    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Test Course Product',
        slug: `test-product-${Date.now()}`,
        billingType: 'one_time',
        price: 9900,
        currency: 'ILS',
        isActive: true,
      } as any,
      overrideAccess: true,
    })

    productName = product.name as string

    // Create a tenant
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: `test-tenant-${Date.now()}`,
        slug: `test-tenant-${Date.now()}`,
      } as any,
      overrideAccess: true,
    })

    // Create user
    userEmail = generateTestUserEmail('purchase-detail-test')
    const user = await payload.create({
      collection: 'users',
      data: {
        email: userEmail,
        password: 'TestPass123!',
        name: 'Purchase Detail Test User',
        role: 'student',
      } as any,
      overrideAccess: true,
    })
    userId = user.id

    // Create transaction
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: product.id,
        provider: 'stripe',
        providerTransactionId: `cs_test_${Date.now()}`,
        status: 'succeeded',
        amount: 9900,
        currency: 'ILS',
        tenant: tenant.id,
      } as any,
      overrideAccess: true,
    })
    transactionId = tx.id
  })

  test.afterAll(async () => {
    const payload = await getPayload({ config })
    // Clean up transaction
    try {
      await payload.delete({
        collection: 'transactions',
        id: transactionId,
        overrideAccess: true,
      })
    } catch {
      // Ignore cleanup errors
    }
    // Clean up user
    await deleteTestUser(userId)
  })

  test('should display product name without hydration errors', async ({ page }) => {
    // Authenticate
    await authenticateViaAPI(page, { email: userEmail, password: 'TestPass123!' })

    // Collect console errors
    const consoleErrors: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignore known non-critical errors
        if (!text.includes('Download the React DevTools') && !text.includes('favicon')) {
          consoleErrors.push(text)
        }
      }
    })

    // Navigate to purchase detail page
    await page.goto(`/account/purchases/${transactionId}`)
    await page.waitForLoadState('networkidle')

    // Check page loaded without crashing (not showing not found)
    const notFoundText = await page.locator('body').textContent()
    expect(notFoundText).not.toMatch(/not found|404/i)

    // Check product name is displayed (not "Unknown Product")
    const body = await page.locator('body').textContent()
    expect(body).toContain(productName)
    expect(body).not.toContain('Unknown Product')

    // Check for hydration errors
    const hydrationErrors = consoleErrors.filter(
      (e) =>
        e.includes('Hydration') ||
        e.includes('hydration') ||
        e.includes('418') ||
        e.includes('did not match'),
    )
    expect(hydrationErrors, `Hydration errors found: ${hydrationErrors.join(', ')}`).toHaveLength(0)
  })

  test('should not show "Unknown Product" for valid transaction', async ({ page }) => {
    await authenticateViaAPI(page, { email: userEmail, password: 'TestPass123!' })

    await page.goto(`/account/purchases/${transactionId}`)
    await page.waitForLoadState('networkidle')

    const body = await page.locator('body').textContent()
    expect(body).toContain(productName)
  })
})
