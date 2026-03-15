/**
 * Unit tests for /api/cody/remote/exec and /api/cody/remote/status routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth
vi.mock('@/ui/cody/auth', () => ({
  requireDashboardAuth: vi.fn(() => ({
    authenticated: true,
    user: { id: '1', email: 'test@test.com' },
  })),
}))

// Mock remote-config
vi.mock('@/ui/cody/remote-config', () => ({
  getRemoteConfig: vi.fn(),
  isRemoteEnabled: vi.fn(),
}))

// Mock logger
vi.mock('@/infra/utils/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { getRemoteConfig } from '@/ui/cody/remote-config'

const mockConfig = {
  ghUsername: 'alice',
  key: 'secret-key',
  funnelUrl: 'https://alice.ts.net',
}

describe('POST /api/cody/remote/exec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRemoteConfig).mockReturnValue(undefined)
  })

  it('returns 404 when user is not configured', async () => {
    vi.mocked(getRemoteConfig).mockReturnValue(undefined)
    const { POST } = await import('@/app/api/cody/remote/exec/route')

    const req = new NextRequest('http://localhost/api/cody/remote/exec', {
      method: 'POST',
      body: JSON.stringify({ actorLogin: 'unknown', action: 'exec', payload: {} }),
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('not configured')
  })

  it('returns 400 when actorLogin is missing', async () => {
    const { POST } = await import('@/app/api/cody/remote/exec/route')

    const req = new NextRequest('http://localhost/api/cody/remote/exec', {
      method: 'POST',
      body: JSON.stringify({ action: 'exec', payload: {} }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid action', async () => {
    vi.mocked(getRemoteConfig).mockReturnValue(mockConfig)
    const { POST } = await import('@/app/api/cody/remote/exec/route')

    const req = new NextRequest('http://localhost/api/cody/remote/exec', {
      method: 'POST',
      body: JSON.stringify({ actorLogin: 'alice', action: 'invalid', payload: {} }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('proxies successfully to remote agent', async () => {
    vi.mocked(getRemoteConfig).mockReturnValue(mockConfig)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ stdout: 'hello', exitCode: 0 }),
    }) as unknown as typeof fetch

    const { POST } = await import('@/app/api/cody/remote/exec/route')

    const req = new NextRequest('http://localhost/api/cody/remote/exec', {
      method: 'POST',
      body: JSON.stringify({
        actorLogin: 'alice',
        action: 'exec',
        payload: { command: 'echo hello' },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stdout).toBe('hello')
  })

  it('returns 502 when remote agent is unreachable', async () => {
    vi.mocked(getRemoteConfig).mockReturnValue(mockConfig)
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('Connection refused')) as unknown as typeof fetch

    const { POST } = await import('@/app/api/cody/remote/exec/route')

    const req = new NextRequest('http://localhost/api/cody/remote/exec', {
      method: 'POST',
      body: JSON.stringify({
        actorLogin: 'alice',
        action: 'exec',
        payload: { command: 'echo hello' },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(502)
  })
})

describe('GET /api/cody/remote/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRemoteConfig).mockReturnValue(undefined)
  })

  it('returns 404 when user is not configured', async () => {
    const { GET } = await import('@/app/api/cody/remote/status/route')

    const req = new NextRequest('http://localhost/api/cody/remote/status?actorLogin=unknown')
    const res = await GET(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.configured).toBe(false)
  })
})
