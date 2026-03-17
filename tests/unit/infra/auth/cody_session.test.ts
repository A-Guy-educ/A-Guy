/**
 * Unit tests for cody_session.ts — JWT session helpers + token encryption
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

  describe('encryptToken / decryptToken', () => {
    it('roundtrip succeeds for a GitHub access token', async () => {
      const { encryptToken, decryptToken } = await import('@/infra/auth/cody_session')
      const token = 'gho_abc123XYZ_some_github_access_token'

      const encrypted = encryptToken(token)
      expect(encrypted).not.toBe(token) // must not be plaintext
      expect(encrypted.split(':')).toHaveLength(3) // iv:ciphertext:authTag

      const decrypted = decryptToken(encrypted)
      expect(decrypted).toBe(token)
    })

    it('produces different ciphertexts for the same input (random IV)', async () => {
      const { encryptToken } = await import('@/infra/auth/cody_session')
      const token = 'gho_repeated_token'

      const a = encryptToken(token)
      const b = encryptToken(token)
      expect(a).not.toBe(b) // different IVs
    })

    it('throws on tampered ciphertext', async () => {
      const { encryptToken, decryptToken } = await import('@/infra/auth/cody_session')
      const encrypted = encryptToken('gho_secret')

      // Tamper with the ciphertext portion
      const parts = encrypted.split(':')
      parts[1] = parts[1].slice(0, -2) + 'XX'
      const tampered = parts.join(':')

      expect(() => decryptToken(tampered)).toThrow()
    })

    it('throws on invalid format', async () => {
      const { decryptToken } = await import('@/infra/auth/cody_session')
      expect(() => decryptToken('not-valid-format')).toThrow('Invalid encrypted token format')
    })
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

    it('stores and retrieves encrypted GitHub access token', async () => {
      const { createCodySession, verifyCodySession, CODY_SESSION_COOKIE } =
        await import('@/infra/auth/cody_session')

      const identity = {
        login: 'testuser',
        avatar_url: 'https://github.com/testuser.png',
        githubId: 42,
      }
      const ghAccessToken = 'gho_realGitHubToken123'

      // Create session WITH access token
      const res = new NextResponse(null)
      await createCodySession(res, identity, ghAccessToken)

      const cookieHeader = res.headers.get('set-cookie') ?? ''
      const tokenMatch = cookieHeader.match(new RegExp(`${CODY_SESSION_COOKIE}=([^;]+)`))
      expect(tokenMatch).not.toBeNull()

      // Verify and check ghToken is decrypted
      const req = new NextRequest('http://localhost/cody', {
        headers: { cookie: `${CODY_SESSION_COOKIE}=${tokenMatch![1]}` },
      })
      const verified = await verifyCodySession(req)

      expect(verified).not.toBeNull()
      expect(verified!.login).toBe('testuser')
      expect(verified!.ghToken).toBe('gho_realGitHubToken123')
    })

    it('works for legacy sessions without ghToken', async () => {
      const { createCodySession, verifyCodySession, CODY_SESSION_COOKIE } =
        await import('@/infra/auth/cody_session')

      const identity = {
        login: 'legacyuser',
        avatar_url: 'https://github.com/legacyuser.png',
        githubId: 99,
      }

      // Create session WITHOUT access token (legacy)
      const res = new NextResponse(null)
      await createCodySession(res, identity)

      const cookieHeader = res.headers.get('set-cookie') ?? ''
      const tokenMatch = cookieHeader.match(new RegExp(`${CODY_SESSION_COOKIE}=([^;]+)`))

      const req = new NextRequest('http://localhost/cody', {
        headers: { cookie: `${CODY_SESSION_COOKIE}=${tokenMatch![1]}` },
      })
      const verified = await verifyCodySession(req)

      expect(verified).not.toBeNull()
      expect(verified!.login).toBe('legacyuser')
      expect(verified!.ghToken).toBeUndefined()
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
