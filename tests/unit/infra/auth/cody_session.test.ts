/**
 * Unit tests for cody_session.ts — JWT session helpers
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Set PAYLOAD_SECRET before importing the module
const TEST_SECRET = 'test-payload-secret-for-unit-tests'

describe('cody_session', () => {
  beforeEach(() => {
    process.env.PAYLOAD_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.PAYLOAD_SECRET = undefined as unknown as string
  })

  describe('createCodySession + verifyCodySession', () => {
    it('creates a JWT cookie and verifies it back', async () => {
      const { createCodySession, verifyCodySession, CODY_SESSION_COOKIE } =
        await import('@/infra/auth/cody_session')

      const identity = {
        login: 'aguyaharonyair',
        avatar_url: 'https://github.com/aguyaharonyair.png',
        githubId: 12345,
      }

      // Create session
      const res = new NextResponse(null)
      await createCodySession(res, identity)

      // Extract the cookie value
      const cookieHeader = res.headers.get('set-cookie') ?? ''
      const tokenMatch = cookieHeader.match(new RegExp(`${CODY_SESSION_COOKIE}=([^;]+)`))
      expect(tokenMatch).not.toBeNull()
      const token = tokenMatch![1]

      // Verify via request
      const req = new NextRequest('http://localhost/cody', {
        headers: { cookie: `${CODY_SESSION_COOKIE}=${token}` },
      })
      const verified = await verifyCodySession(req)

      expect(verified).not.toBeNull()
      expect(verified!.login).toBe('aguyaharonyair')
      expect(verified!.avatar_url).toBe('https://github.com/aguyaharonyair.png')
      expect(verified!.githubId).toBe(12345)
    })

    it('returns null when cookie is missing', async () => {
      const { verifyCodySession } = await import('@/infra/auth/cody_session')
      const req = new NextRequest('http://localhost/cody')
      const result = await verifyCodySession(req)
      expect(result).toBeNull()
    })

    it('returns null for a tampered token', async () => {
      const { verifyCodySession, CODY_SESSION_COOKIE } = await import('@/infra/auth/cody_session')
      const req = new NextRequest('http://localhost/cody', {
        headers: { cookie: `${CODY_SESSION_COOKIE}=tampered.jwt.token` },
      })
      const result = await verifyCodySession(req)
      expect(result).toBeNull()
    })
  })

  describe('verifyCodySessionToken', () => {
    it('returns null for undefined token', async () => {
      const { verifyCodySessionToken } = await import('@/infra/auth/cody_session')
      const result = await verifyCodySessionToken(undefined)
      expect(result).toBeNull()
    })

    it('verifies a valid raw token', async () => {
      const { createCodySession, verifyCodySessionToken, CODY_SESSION_COOKIE } =
        await import('@/infra/auth/cody_session')

      const identity = {
        login: 'testuser',
        avatar_url: 'https://github.com/testuser.png',
        githubId: 99,
      }
      const res = new NextResponse(null)
      await createCodySession(res, identity)

      const cookieHeader = res.headers.get('set-cookie') ?? ''
      const tokenMatch = cookieHeader.match(new RegExp(`${CODY_SESSION_COOKIE}=([^;]+)`))
      expect(tokenMatch).not.toBeNull()

      const result = await verifyCodySessionToken(tokenMatch![1])
      expect(result).not.toBeNull()
      expect(result!.login).toBe('testuser')
    })
  })

  describe('clearCodySession', () => {
    it('sets maxAge=0 on the cookie', async () => {
      const { clearCodySession, CODY_SESSION_COOKIE } = await import('@/infra/auth/cody_session')
      const res = new NextResponse(null)
      clearCodySession(res)
      const cookie = res.cookies.get(CODY_SESSION_COOKIE)
      expect(cookie?.value).toBe('')
    })
  })
})
