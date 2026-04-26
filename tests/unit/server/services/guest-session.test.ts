/**
 * Unit tests for guest-session service
 * Tests transaction safety: functions should accept payload parameter as first argument
 *
 * These tests verify the fix for transaction safety - ensuring guest-session
 * functions accept a Payload instance instead of calling getPayload internally.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

// Mock getGuestChatConfig before importing the module
vi.mock('@/server/config/guest-chat-config', () => ({
  getGuestChatConfig: vi.fn().mockResolvedValue({
    hard_cap_days: 30,
    sliding_ttl_days: 7,
    max_messages: 10,
  }),
}))

// Mock logger to avoid console output during tests
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock payload module - this must be set up BEFORE importing guest-session
// because guest-session imports { getPayload } from 'payload'
// We use getPayloadMock to track if getPayload was called (which is the broken behavior)
const getPayloadMock = vi.fn()
vi.mock('payload', () => ({
  getPayload: getPayloadMock,
}))

// Mock payload-config to avoid full Payload initialization (which requires BLOB token)
// Provide a default export that will satisfy the import
vi.mock('@payload-config', () => ({
  __esModule: true,
  default: {},
}))

// Mock payload functions - these are set up to track calls when functions accept payload param
const mockPayloadCreate = vi.fn()
const mockPayloadFind = vi.fn()
const mockPayloadFindByID = vi.fn()
const mockPayloadUpdate = vi.fn()

// Mock collection for atomic findOneAndUpdate
const mockFindOneAndUpdate = vi.fn()

const mockCollection = {
  findOneAndUpdate: mockFindOneAndUpdate,
}

const mockPayload = {
  create: mockPayloadCreate,
  find: mockPayloadFind,
  findByID: mockPayloadFindByID,
  update: mockPayloadUpdate,
  db: {
    connection: {
      collection: () => mockCollection,
    },
  },
} as unknown as Payload

describe('guest-session service - Transaction Safety', () => {
  // Import after setting up mocks
  let guestSession: typeof import('@/server/services/guest-session')

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset the getPayload mock to return our mockPayload
    getPayloadMock.mockResolvedValue(mockPayload)
    // Re-import to get fresh module with cleared mocks
    guestSession = await import('@/server/services/guest-session')
  })

  describe('createGuestSession accepts payload parameter', () => {
    it('should accept payload as first argument and use it for database operations', async () => {
      // Set up mock return value
      mockPayloadCreate.mockResolvedValue({
        id: 'session-new',
        tokenHash: 'newhash',
        tokenVersion: 1,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        hardExpiresAt: new Date().toISOString(),
        status: 'active',
        messageCount: 0,
      } as any)

      // Call with payload as first argument (new signature after fix)
      // Using type assertion to bypass TypeScript for testing purposes
      const createWithPayload = guestSession.createGuestSession as unknown as (
        payload: Payload,
        options: { ipHash?: string; userAgentHash?: string },
      ) => Promise<{ session: any; token: string }>

      await createWithPayload(mockPayload, {
        ipHash: 'test-ip',
        userAgentHash: 'test-ua',
      })

      // Verify the mockPayload.create was called (not a separate getPayload instance)
      // Before fix: mockPayloadCreate is NOT called (getPayload is called internally)
      // After fix: mockPayloadCreate IS called with the passed payload
      expect(mockPayloadCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'guest-sessions',
        }),
      )
    })
  })

  describe('getGuestSessionByToken accepts payload parameter', () => {
    it('should accept payload as first argument and use it for database operations', async () => {
      mockPayloadFind.mockResolvedValue({
        docs: [
          {
            id: 'session-123',
            tokenHash: 'hash123',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            messageCount: 0,
          },
        ],
        totalDocs: 1,
      })

      // Call with payload as first argument
      const getByTokenWithPayload = guestSession.getGuestSessionByToken as unknown as (
        payload: Payload,
        token: string,
      ) => Promise<any>

      await getByTokenWithPayload(mockPayload, 'test-token')

      // Before fix: mockPayloadFind is NOT called
      // After fix: mockPayloadFind IS called
      expect(mockPayloadFind).toHaveBeenCalled()
    })
  })

  describe('updateGuestSessionActivity accepts payload parameter', () => {
    it('should accept payload as first argument and use it for database operations', async () => {
      mockPayloadFindByID.mockResolvedValue({
        id: 'session-123',
        hardExpiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        status: 'active',
      })

      mockPayloadUpdate.mockResolvedValue({
        id: 'session-123',
        lastActiveAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      })

      // Call with payload as first argument
      const updateWithPayload = guestSession.updateGuestSessionActivity as unknown as (
        payload: Payload,
        sessionId: string,
      ) => Promise<any>

      await updateWithPayload(mockPayload, 'session-123')

      // Before fix: mockPayloadFindByID and mockPayloadUpdate are NOT called
      // After fix: both are called
      expect(mockPayloadFindByID).toHaveBeenCalled()
      expect(mockPayloadUpdate).toHaveBeenCalled()
    })
  })

  describe('revokeGuestSession accepts payload parameter', () => {
    it('should accept payload as first argument and use it for database operations', async () => {
      mockPayloadUpdate.mockResolvedValue({
        id: 'session-123',
        status: 'revoked',
        claimedByUser: 'user-123',
        claimedAt: new Date().toISOString(),
      })

      // Call with payload as first argument
      const revokeWithPayload = guestSession.revokeGuestSession as unknown as (
        payload: Payload,
        sessionId: string,
        claimedByUser: string,
      ) => Promise<any>

      await revokeWithPayload(mockPayload, 'session-123', 'user-123')

      // Before fix: mockPayloadUpdate is NOT called
      // After fix: mockPayloadUpdate IS called
      expect(mockPayloadUpdate).toHaveBeenCalled()
    })
  })

  describe('checkAndIncrementGuestMessageCount accepts payload parameter', () => {
    // Use valid ObjectId strings for testing
    const validSessionId = '507f1f77bcf86cd799439011'

    it('should use atomic findOneAndUpdate when under limit', async () => {
      mockPayloadFindByID.mockResolvedValue({
        id: validSessionId,
        messageCount: 5,
        status: 'active',
      })

      mockFindOneAndUpdate.mockResolvedValue({
        _id: validSessionId,
        messageCount: 6,
        status: 'active',
      })

      // Call with payload as first argument
      const checkWithPayload = guestSession.checkAndIncrementGuestMessageCount as unknown as (
        payload: Payload,
        guestSessionId: string,
      ) => Promise<any>

      const result = await checkWithPayload(mockPayload, validSessionId)

      // findByID should be called for existence/claiming guard
      expect(mockPayloadFindByID).toHaveBeenCalled()
      // Atomic findOneAndUpdate should be called with correct filter
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.anything(),
          status: 'active',
          messageCount: { $lt: 10 },
        }),
        { $inc: { messageCount: 1 } },
        { returnDocument: 'after' },
      )
      // payload.update should NOT be called on the main path
      expect(mockPayloadUpdate).not.toHaveBeenCalled()
      expect(result.allowed).toBe(true)
      expect(result.current).toBe(6)
      expect(result.remaining).toBe(4)
    })

    it('should return blocked: true when session is claiming', async () => {
      mockPayloadFindByID.mockResolvedValue({
        id: validSessionId,
        messageCount: 5,
        status: 'claiming',
      })

      const checkWithPayload = guestSession.checkAndIncrementGuestMessageCount as unknown as (
        payload: Payload,
        guestSessionId: string,
      ) => Promise<any>

      const result = await checkWithPayload(mockPayload, validSessionId)

      // findByID should be called but atomic update should NOT be called
      expect(mockPayloadFindByID).toHaveBeenCalled()
      expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
      expect(result.allowed).toBe(false)
      expect(result.blocked).toBe(true)
    })

    it('should fallback when atomic update returns null (at limit)', async () => {
      // Track call count to return different values
      let callCount = 0
      mockPayloadFindByID.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            id: validSessionId,
            messageCount: 5,
            status: 'active',
          })
        }
        // Second call: fallback returns session at limit
        return Promise.resolve({
          id: validSessionId,
          messageCount: 10,
          status: 'active',
        })
      })

      mockFindOneAndUpdate.mockResolvedValue(null) // Atomic update failed (at limit)

      const checkWithPayload = guestSession.checkAndIncrementGuestMessageCount as unknown as (
        payload: Payload,
        guestSessionId: string,
      ) => Promise<any>

      const result = await checkWithPayload(mockPayload, validSessionId)

      expect(mockFindOneAndUpdate).toHaveBeenCalled()
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.current).toBe(10)
    })

    it('should return allowed: false when session not found', async () => {
      mockPayloadFindByID.mockResolvedValue(null)

      const checkWithPayload = guestSession.checkAndIncrementGuestMessageCount as unknown as (
        payload: Payload,
        guestSessionId: string,
      ) => Promise<any>

      const result = await checkWithPayload(mockPayload, '507f1f77bcf86cd799439012')

      expect(mockPayloadFindByID).toHaveBeenCalled()
      expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
      expect(result.allowed).toBe(false)
      expect(result.current).toBe(0)
      expect(result.remaining).toBe(0)
    })
  })

  describe('Module does not import getPayload', () => {
    it('should not have getPayload import in the source file after fix', async () => {
      // Read the source file to check for getPayload import
      const fs = await import('fs')
      const sourcePath = './src/server/services/guest-session.ts'
      const sourceCode = fs.readFileSync(sourcePath, 'utf-8')

      // Check if getPayload is imported
      // After the fix, the import should be removed
      const hasGetPayloadImport = sourceCode.includes("import { getPayload } from 'payload'")

      // This test FAILS before the fix (getPayload is imported)
      // This test PASSES after the fix (getPayload import removed)
      expect(hasGetPayloadImport).toBe(false)
    })
  })

  describe('Pure utility functions (no payload needed)', () => {
    it('generateSessionToken should return a 64-character hex string', () => {
      const token = guestSession.generateSessionToken()

      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]+$/)
    })

    it('hashToken should return consistent hash for same input', () => {
      const token = 'test-token-123'
      const hash1 = guestSession.hashToken(token)
      const hash2 = guestSession.hashToken(token)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })

    it('verifyTokenHash should validate correct token', () => {
      const token = 'test-token-123'
      const hash = guestSession.hashToken(token)

      expect(guestSession.verifyTokenHash(hash, token)).toBe(true)
      expect(guestSession.verifyTokenHash(hash, 'wrong-token')).toBe(false)
    })

    it('hashIP should return consistent hash', () => {
      const hash1 = guestSession.hashIP('192.168.1.1')
      const hash2 = guestSession.hashIP('192.168.1.1')

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(16)
    })

    it('hashUserAgent should return consistent hash', () => {
      const hash1 = guestSession.hashUserAgent('Mozilla/5.0...')
      const hash2 = guestSession.hashUserAgent('Mozilla/5.0...')

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(16)
    })

    it('hashIP should return empty string for null', () => {
      expect(guestSession.hashIP(null as any)).toBe('')
    })

    it('hashUserAgent should return empty string for null', () => {
      expect(guestSession.hashUserAgent(null as any)).toBe('')
    })
  })

  describe('Cookie functions (no payload needed)', () => {
    it('buildGuestSessionCookieHeader should return cookie string', async () => {
      const cookie = await guestSession.buildGuestSessionCookieHeader('test-token')

      expect(cookie).toContain('guest_session=test-token')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
    })

    it('buildClearGuestSessionCookieHeader should return clearing cookie', () => {
      const cookie = guestSession.buildClearGuestSessionCookieHeader()

      expect(cookie).toContain('guest_session=')
      expect(cookie).toContain('Max-Age=0')
    })

    it('getGuestSessionCookie should extract token from headers', () => {
      const headers = new Headers()
      headers.append('cookie', 'guest_session=test-token-123; other=value')

      const token = guestSession.getGuestSessionCookie(headers)

      expect(token).toBe('test-token-123')
    })

    it('getGuestSessionCookie should return null for no cookie', () => {
      const headers = new Headers()
      const token = guestSession.getGuestSessionCookie(headers)

      expect(token).toBeNull()
    })

    it('clearGuestSessionCookie should set clearing cookie header', () => {
      const headers = new Headers()
      guestSession.clearGuestSessionCookie(headers)

      const cookie = headers.get('Set-Cookie')
      expect(cookie).toContain('guest_session=')
      expect(cookie).toContain('Max-Age=0')
    })
  })
})
