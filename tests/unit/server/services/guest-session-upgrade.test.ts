/**
 * Unit tests for guest-session-upgrade service
 * Tests transaction safety: functions should accept payload parameter as first argument
 *
 * These tests verify the fix for transaction safety - ensuring guest-session-upgrade
 * functions accept a Payload instance instead of calling getPayload internally.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

// Mock logger to avoid console output during tests
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock payload module - this must be set up BEFORE importing the module
// because guest-session-upgrade imports { getPayload } from 'payload'
// We use getPayloadMock to track if getPayload was called (which is the broken behavior)
const getPayloadMock = vi.fn()
vi.mock('payload', () => ({
  getPayload: getPayloadMock,
}))

// Mock payload-config to avoid full Payload initialization
vi.mock('@payload-config', () => ({
  __esModule: true,
  default: {},
}))

// Mock guest-session module - we need to track if payload is passed to these functions
const mockGetGuestSessionByToken = vi.fn()
const mockGetGuestSessionByTokenForClaim = vi.fn()
const mockRevokeGuestSession = vi.fn()
const mockAcquireClaimLock = vi.fn()
const mockCompleteClaimLock = vi.fn()
const mockClearGuestSessionCookie = vi.fn()

vi.mock('@/server/services/guest-session', () => ({
  getGuestSessionByToken: (...args: unknown[]) => mockGetGuestSessionByToken(...args),
  getGuestSessionByTokenForClaim: (...args: unknown[]) =>
    mockGetGuestSessionByTokenForClaim(...args),
  revokeGuestSession: (...args: unknown[]) => mockRevokeGuestSession(...args),
  acquireClaimLock: (...args: unknown[]) => mockAcquireClaimLock(...args),
  completeClaimLock: (...args: unknown[]) => mockCompleteClaimLock(...args),
  clearGuestSessionCookie: (...args: unknown[]) => mockClearGuestSessionCookie(...args),
}))

// Mock payload functions - these are set up to track calls when functions accept payload param
const mockPayloadFind = vi.fn()
const mockPayloadUpdate = vi.fn()
const mockPayloadCount = vi.fn()

const mockPayload = {
  find: mockPayloadFind,
  update: mockPayloadUpdate,
  count: mockPayloadCount,
} as unknown as Payload

describe('guest-session-upgrade service - Transaction Safety', () => {
  // Import after setting up mocks
  let guestSessionUpgrade: typeof import('@/server/services/guest-session-upgrade')

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset the getPayload mock to return our mockPayload
    getPayloadMock.mockResolvedValue(mockPayload)

    // Set up default mock returns
    mockGetGuestSessionByToken.mockResolvedValue({
      id: 'session-123',
      tokenHash: 'hash123',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
      messageCount: 0,
    })

    mockGetGuestSessionByTokenForClaim.mockResolvedValue({
      id: 'session-123',
      tokenHash: 'hash123',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
      messageCount: 0,
    })

    mockRevokeGuestSession.mockResolvedValue({
      id: 'session-123',
      status: 'revoked',
    })

    mockAcquireClaimLock.mockResolvedValue({
      locked: true,
      session: {
        id: 'session-123',
        status: 'claiming',
      },
    })

    mockCompleteClaimLock.mockResolvedValue({
      id: 'session-123',
      status: 'revoked',
    })

    mockClearGuestSessionCookie.mockImplementation(() => {})

    mockPayloadFind.mockResolvedValue({
      docs: [
        { id: 'conv-1', user: null, guestSession: 'session-123' },
        { id: 'conv-2', user: null, guestSession: 'session-123' },
      ],
      totalDocs: 2,
    })

    mockPayloadUpdate.mockResolvedValue({})

    // Default count is 0 (simulating successful transfer)
    // Tests that need different behavior will override
    mockPayloadCount.mockResolvedValue({
      totalDocs: 0,
    })

    // Re-import to get fresh module with cleared mocks
    guestSessionUpgrade = await import('@/server/services/guest-session-upgrade')
  })

  describe('claimGuestConversations accepts payload parameter', () => {
    it('should accept payload as first argument and use it for database operations', async () => {
      // Call with payload as first argument (new signature after fix)
      // Using type assertion to bypass TypeScript for testing purposes
      const claimWithPayload = guestSessionUpgrade.claimGuestConversations as unknown as (
        payload: Payload,
        userId: string,
        sessionToken: string,
        headers?: Headers,
      ) => Promise<{ claimed: number; headers: Headers }>

      const headers = new Headers()
      const result = await claimWithPayload(mockPayload, 'user-123', 'test-token', headers)

      // Before fix: mockPayloadFind is NOT called (getPayload is called internally)
      // After fix: mockPayloadFind IS called with the passed payload
      expect(mockPayloadFind).toHaveBeenCalled()

      // Verify conversations were claimed
      expect(result.claimed).toBe(2)
    })

    it('should return claimed count of 0 when no guest session exists', async () => {
      // Override mock to return null (no session)
      mockGetGuestSessionByTokenForClaim.mockResolvedValue(null)

      const claimWithPayload = guestSessionUpgrade.claimGuestConversations as unknown as (
        payload: Payload,
        userId: string,
        sessionToken: string,
        headers?: Headers,
      ) => Promise<{ claimed: number; headers: Headers }>

      const headers = new Headers()
      const result = await claimWithPayload(mockPayload, 'user-123', 'invalid-token', headers)

      // Should return 0 claimed
      expect(result.claimed).toBe(0)
      expect(mockPayloadFind).not.toHaveBeenCalled()
    })
  })

  describe('hasPendingGuestConversations accepts payload parameter', () => {
    it('should accept payload as first argument and use it for database operations', async () => {
      // Override count to return > 0 (there are pending conversations)
      mockPayloadCount.mockResolvedValue({
        totalDocs: 2,
      })

      // Call with payload as first argument
      const checkWithPayload = guestSessionUpgrade.hasPendingGuestConversations as unknown as (
        payload: Payload,
        sessionToken: string,
      ) => Promise<boolean>

      const result = await checkWithPayload(mockPayload, 'test-token')

      // Before fix: mockPayloadCount is NOT called
      // After fix: mockPayloadCount IS called
      expect(mockPayloadCount).toHaveBeenCalled()

      // Should return true because there are pending conversations
      expect(result).toBe(true)
    })

    it('should return false when no guest session exists', async () => {
      mockGetGuestSessionByTokenForClaim.mockResolvedValue(null)

      const checkWithPayload = guestSessionUpgrade.hasPendingGuestConversations as unknown as (
        payload: Payload,
        sessionToken: string,
      ) => Promise<boolean>

      const result = await checkWithPayload(mockPayload, 'invalid-token')

      // Should return false when session doesn't exist
      expect(result).toBe(false)
      expect(mockPayloadCount).not.toHaveBeenCalled()
    })

    it('should return false when no pending conversations exist', async () => {
      mockPayloadCount.mockResolvedValue({
        totalDocs: 0,
      })

      const checkWithPayload = guestSessionUpgrade.hasPendingGuestConversations as unknown as (
        payload: Payload,
        sessionToken: string,
      ) => Promise<boolean>

      const result = await checkWithPayload(mockPayload, 'test-token')

      // Should return false when no pending conversations
      expect(result).toBe(false)
    })
  })

  describe('claimGuestConversations passes payload to inner calls', () => {
    it('should pass payload to getGuestSessionByTokenForClaim', async () => {
      const claimWithPayload = guestSessionUpgrade.claimGuestConversations as unknown as (
        payload: Payload,
        userId: string,
        sessionToken: string,
        headers?: Headers,
      ) => Promise<{ claimed: number; headers: Headers }>

      await claimWithPayload(mockPayload, 'user-123', 'test-token', new Headers())

      // Before fix: mockGetGuestSessionByTokenForClaim receives only token (not payload)
      // After fix: mockGetGuestSessionByTokenForClaim receives payload as first arg
      expect(mockGetGuestSessionByTokenForClaim).toHaveBeenCalled()
      const callArgs = mockGetGuestSessionByTokenForClaim.mock.calls[0]
      // After fix: first argument should be payload
      expect(callArgs[0]).toBe(mockPayload)
      // Second argument should be the token
      expect(callArgs[1]).toBe('test-token')
    })

    it('should pass payload to acquireClaimLock and completeClaimLock', async () => {
      const claimWithPayload = guestSessionUpgrade.claimGuestConversations as unknown as (
        payload: Payload,
        userId: string,
        sessionToken: string,
        headers?: Headers,
      ) => Promise<{ claimed: number; headers: Headers }>

      await claimWithPayload(mockPayload, 'user-123', 'test-token', new Headers())

      // After fix: acquireClaimLock receives (payload, sessionId, userId)
      expect(mockAcquireClaimLock).toHaveBeenCalled()
      const lockCallArgs = mockAcquireClaimLock.mock.calls[0]
      expect(lockCallArgs[0]).toBe(mockPayload)
      expect(lockCallArgs[1]).toBe('session-123')
      expect(lockCallArgs[2]).toBe('user-123')

      // After fix: completeClaimLock receives (payload, sessionId, userId)
      expect(mockCompleteClaimLock).toHaveBeenCalled()
      const completeCallArgs = mockCompleteClaimLock.mock.calls[0]
      expect(completeCallArgs[0]).toBe(mockPayload)
      expect(completeCallArgs[1]).toBe('session-123')
      expect(completeCallArgs[2]).toBe('user-123')
    })

    it('should use payload for conversation updates', async () => {
      const claimWithPayload = guestSessionUpgrade.claimGuestConversations as unknown as (
        payload: Payload,
        userId: string,
        sessionToken: string,
        headers?: Headers,
      ) => Promise<{ claimed: number; headers: Headers }>

      await claimWithPayload(mockPayload, 'user-123', 'test-token', new Headers())

      // Verify payload.update was called (bulk update with where clause)
      expect(mockPayloadUpdate).toHaveBeenCalledTimes(1)
    })
  })

  describe('hasPendingGuestConversations passes payload to inner calls', () => {
    it('should pass payload to getGuestSessionByTokenForClaim', async () => {
      const checkWithPayload = guestSessionUpgrade.hasPendingGuestConversations as unknown as (
        payload: Payload,
        sessionToken: string,
      ) => Promise<boolean>

      await checkWithPayload(mockPayload, 'test-token')

      // After fix: should pass payload as first argument
      expect(mockGetGuestSessionByTokenForClaim).toHaveBeenCalled()
      const callArgs = mockGetGuestSessionByTokenForClaim.mock.calls[0]
      expect(callArgs[0]).toBe(mockPayload)
      expect(callArgs[1]).toBe('test-token')
    })

    it('should use payload for count query', async () => {
      const checkWithPayload = guestSessionUpgrade.hasPendingGuestConversations as unknown as (
        payload: Payload,
        sessionToken: string,
      ) => Promise<boolean>

      await checkWithPayload(mockPayload, 'test-token')

      // After fix: should use payload.count instead of calling getPayload internally
      expect(mockPayloadCount).toHaveBeenCalled()
    })
  })

  describe('Module does not import getPayload', () => {
    it('should not have getPayload import in the source file after fix', async () => {
      // Read the source file to check for getPayload import
      const fs = await import('fs')
      const sourcePath = './src/server/services/guest-session-upgrade.ts'
      const sourceCode = fs.readFileSync(sourcePath, 'utf-8')

      // Check if getPayload is imported
      // After the fix, the import should be removed
      const hasGetPayloadImport = sourceCode.includes("import { getPayload } from 'payload'")

      // This test FAILS before the fix (getPayload is imported)
      // This test PASSES after the fix (getPayload import removed)
      expect(hasGetPayloadImport).toBe(false)
    })
  })

  describe('Module does not import config from @payload-config', () => {
    it('should not have @payload-config import in the source file after fix', async () => {
      // Read the source file to check for payload-config import
      const fs = await import('fs')
      const sourcePath = './src/server/services/guest-session-upgrade.ts'
      const sourceCode = fs.readFileSync(sourcePath, 'utf-8')

      // Check if payload-config is imported
      // After the fix, the import should be removed (no longer needed)
      const hasPayloadConfigImport = sourceCode.includes("import config from '@payload-config'")

      // This test FAILS before the fix (config is imported)
      // This test PASSES after the fix (config import removed)
      expect(hasPayloadConfigImport).toBe(false)
    })
  })
})
