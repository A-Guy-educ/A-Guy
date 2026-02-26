/**
 * Test helpers for authentication and user management
 */
import { Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '@payload-config'

export interface TestUser {
  email: string
  password: string
  id?: string
}

// Registry to track test users created during E2E tests for cleanup
const testUserRegistry: Set<string> = new Set()

/**
 * Generate a unique test user email
 */
export function generateTestUserEmail(prefix = 'e2e-test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@example.com`
}

/**
 * Create a test user via Payload Local API
 * Automatically registers the user for cleanup
 * @param user - User data including email and password
 * @param role - User role (defaults to 'student')
 */
export async function createTestUser(
  user: TestUser,
  role: 'admin' | 'student' = 'student',
): Promise<TestUser> {
  const payload = await getPayload({ config })

  // Check if user already exists
  const existing = await payload.find({
    collection: 'users',
    where: {
      email: {
        equals: user.email,
      },
    },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const existingUser = {
      ...user,
      id: existing.docs[0].id,
    }
    // Register for cleanup even if it already existed
    if (existingUser.id) {
      testUserRegistry.add(existingUser.id)
    }
    return existingUser
  }

  // Create new user
  // Payload automatically hashes passwords when creating via Local API
  // Add name field (required by some hooks)
  const created = await payload.create({
    collection: 'users',
    data: {
      name: user.email.split('@')[0] || 'Test User', // Extract name from email
      email: user.email,
      password: user.password, // Payload will hash this automatically
      role,
    },
  })

  // Register for cleanup
  if (created.id) {
    testUserRegistry.add(created.id)
  }

  return {
    ...user,
    id: created.id,
  }
}

/**
 * Authenticate a user via signup page
 * This creates the user if they don't exist and logs them in
 */
export async function authenticateViaSignup(page: Page, user: TestUser): Promise<void> {
  // Navigate to signup page
  await page.goto('/signup')
  await page.waitForLoadState('networkidle')

  // Wait for form to be visible
  await page.waitForSelector('input[name="name"]', { timeout: 10000 })

  // Fill signup form
  await page.fill('input[name="name"]', user.email.split('@')[0])
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.fill('input[name="confirmPassword"]', user.password)

  // Submit form - wait for navigation or error
  await Promise.race([
    page.waitForURL(/\//, { timeout: 15000 }), // Success: redirect to home
    page
      .waitForSelector('text=/account created|already exists|error/i', { timeout: 5000 })
      .catch(() => null), // Error message
  ])

  // Check if we're on home page (success) or still on signup (might be error)
  const currentUrl = page.url()
  if (!currentUrl.includes('/signup')) {
    // Successfully redirected
    return
  }

  // If still on signup page, check for error - might be duplicate email
  const errorText = await page.locator('body').textContent()
  if (errorText?.includes('already exists') || errorText?.includes('already registered')) {
    // User exists, will need to login instead
    throw new Error('User already exists')
  }

  // Wait a bit more for redirect
  await page.waitForTimeout(2000)
  if (!page.url().includes('/signup')) {
    return
  }

  throw new Error('Signup failed - still on signup page')
}

/**
 * Authenticate a user via Payload's login API and set cookie
 * This is more reliable than browser-based login
 */
export async function authenticateViaAPI(page: Page, user: TestUser): Promise<void> {
  const payload = await getPayload({ config })

  try {
    // Use Payload's login method to get a token
    const loginResult = await payload.login({
      collection: 'users',
      data: {
        email: user.email,
        password: user.password,
      },
    })

    if (!loginResult || !('token' in loginResult) || !loginResult.token) {
      throw new Error('Login failed - no token returned')
    }

    // Set the auth cookie in the browser context
    await page.context().addCookies([
      {
        name: 'payload-token',
        value: loginResult.token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false, // localhost doesn't need secure
        sameSite: 'Lax',
      },
    ])

    // Verify cookie was set
    const cookies = await page.context().cookies()
    const hasAuthCookie = cookies.some((c) => c.name === 'payload-token')
    if (!hasAuthCookie) {
      throw new Error('Failed to set auth cookie')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid')) {
      throw new Error('Invalid credentials')
    }
    throw error
  }
}

/**
 * Authenticate a user via admin login (Payload's built-in auth)
 * This requires the user to already exist
 * @deprecated Use authenticateViaAPI instead - more reliable
 */
export async function authenticateViaAdminLogin(page: Page, user: TestUser): Promise<void> {
  // Use API-based authentication instead
  return authenticateViaAPI(page, user)
}

/**
 * Delete a test user and all associated data
 */
export async function deleteTestUser(userId: string): Promise<void> {
  if (!userId) return

  const payload = await getPayload({ config })

  try {
    // Delete associated memory items
    const memories = await payload.find({
      collection: 'memory_items',
      where: { userId: { equals: userId } },
      limit: 1000, // Adjust if needed
    })
    for (const mem of memories.docs) {
      await payload.delete({
        collection: 'memory_items',
        id: mem.id,
      })
    }

    // Delete associated conversations
    const conversations = await payload.find({
      collection: 'conversations',
      where: { user: { equals: userId } },
      limit: 1000,
    })
    for (const conv of conversations.docs) {
      await payload.delete({
        collection: 'conversations',
        id: conv.id,
      })
    }

    // Delete the user
    await payload.delete({
      collection: 'users',
      id: userId,
    })

    // Remove from registry
    testUserRegistry.delete(userId)
  } catch (error) {
    console.warn(`Failed to delete test user ${userId}:`, error)
  }
}

/**
 * Clean up all registered test users
 * Call this in afterAll hooks
 */
export async function cleanupTestUsers(): Promise<void> {
  const userIds = Array.from(testUserRegistry)
  testUserRegistry.clear()

  await Promise.all(userIds.map((id) => deleteTestUser(id)))
}

/**
 * Get or create a test user and authenticate them via browser
 * @param page - Playwright page
 * @param user - User data
 * @param role - User role (defaults to 'student')
 */
export async function setupAuthenticatedUser(
  page: Page,
  user: TestUser,
  role: 'admin' | 'student' = 'student',
): Promise<TestUser> {
  // Create user if needed (via Local API) - this ensures user exists
  const testUser = await createTestUser(user, role)

  // Use API-based authentication (most reliable)
  try {
    await authenticateViaAPI(page, testUser)
    return testUser
  } catch (_error) {
    // If API login fails, the user might have been created but password doesn't match
    // Try signup to recreate with correct password
    try {
      await authenticateViaSignup(page, testUser)
      return testUser
    } catch (_signupError) {
      // If signup also fails, try API login one more time (user might have been created by signup)
      await authenticateViaAPI(page, testUser)
      return testUser
    }
  }
}
