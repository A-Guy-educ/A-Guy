import { beforeEach, describe, expect, it, vi } from 'vitest'

import { logoutAction } from '@/app/(frontend)/actions/auth-action'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

const mockGetPayload = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}))

vi.mock('payload', () => ({
  getPayload: mockGetPayload,
}))

describe('Logout Action', () => {
  beforeEach(() => {
    mockCookieStore.delete.mockClear()
    mockGetPayload.mockResolvedValue({ config: {} })
  })

  it('deletes payload-token cookie', async () => {
    const result = await logoutAction()

    expect(result.success).toBe(true)
    expect(mockCookieStore.delete).toHaveBeenCalledWith('payload-token')
  })
})
