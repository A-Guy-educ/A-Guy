// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { loginAction } from '@/app/(frontend)/login/login_authenticate-action'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}))

describe('Login Action (email login disabled)', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload?.db?.destroy) {
      await payload.db.destroy()
    }
  })

  it('rejects email/password login when email auth is disabled', async () => {
    const formData = new FormData()
    formData.set('email', 'user@example.com')
    formData.set('password', 'testpassword123')

    const result = await loginAction(formData, mockCookieStore)

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalidCredentials')
    expect(mockCookieStore.set).not.toHaveBeenCalled()
  })

  it('rejects login with empty fields', async () => {
    const formData = new FormData()
    formData.set('email', '')
    formData.set('password', '')

    const result = await loginAction(formData)

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalidCredentials')
  })
})
