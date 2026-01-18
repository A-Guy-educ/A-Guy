import { beforeEach, describe, expect, it, vi } from 'vitest'

import { logoutAction } from '@/app/(frontend)/actions/auth-action'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}))

describe('Logout Action', () => {
  beforeEach(() => {
    mockCookieStore.delete.mockClear()
  })

  it('deletes payload-token cookie', async () => {
    const result = await logoutAction()

    expect(result.success).toBe(true)
    expect(mockCookieStore.delete).toHaveBeenCalledWith('payload-token')
  })
})
