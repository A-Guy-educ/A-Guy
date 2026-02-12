// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { loginAction } from '@/app/(frontend)/login/login_authenticate-action'
import { createTestUser } from '../factories/user.factory'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}))

describe('Login Action', () => {
  let payload: Payload
  let testUser: { id: string; email: string }
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    mockCookieStore.set.mockClear()
    mockCookieStore.delete.mockClear()

    const user = await createTestUser(payload, {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User',
    })

    testUser = { id: user.id, email: user.email }
  })

  afterEach(async () => {
    try {
      await payload.delete({ collection: 'users', id: testUser.id })
    } catch {
      // Ignore cleanup errors
    }
  })

  afterAll(async () => {
    // Close DB connection to prevent connection leaks
    if (payload?.db?.destroy) {
      await payload.db.destroy()
    }
  })

  it('sets session cookie on successful login', async () => {
    const formData = new FormData()
    formData.set('email', testUser.email)
    formData.set('password', 'testpassword123')

    const result = await loginAction(formData, mockCookieStore)

    expect(result.success).toBe(true)
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'payload-token',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'none',
        path: '/',
      }),
    )
  })

  it('returns invalidCredentials on wrong password', async () => {
    const formData = new FormData()
    formData.set('email', testUser.email)
    formData.set('password', 'wrongpassword')

    const result = await loginAction(formData)

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalidCredentials')
  })

  it('returns invalidCredentials on empty fields', async () => {
    const formData = new FormData()
    formData.set('email', '')
    formData.set('password', '')

    const result = await loginAction(formData)

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalidCredentials')
  })
})
