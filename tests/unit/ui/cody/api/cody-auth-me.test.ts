/**
 * Unit tests for GET /api/cody/auth/me
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockIdentity = {
  login: 'aguyaharonyair',
  avatar_url: 'https://github.com/aguyaharonyair.png',
  githubId: 12345,
}

vi.mock('@/infra/auth/cody_session', () => ({
  verifyCodySession: vi.fn(),
}))

import { verifyCodySession } from '@/infra/auth/cody_session'

describe('GET /api/cody/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns authenticated user when session is valid', async () => {
    vi.mocked(verifyCodySession).mockResolvedValue(mockIdentity)

    const { GET } = await import('@/app/api/cody/auth/me/route')
    const req = new NextRequest('http://localhost/api/cody/auth/me')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.authenticated).toBe(true)
    expect(body.user.login).toBe('aguyaharonyair')
    expect(body.user.githubId).toBe(12345)
  })

  it('returns 401 when session is missing', async () => {
    vi.mocked(verifyCodySession).mockResolvedValue(null)

    const { GET } = await import('@/app/api/cody/auth/me/route')
    const req = new NextRequest('http://localhost/api/cody/auth/me')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.authenticated).toBe(false)
  })
})
