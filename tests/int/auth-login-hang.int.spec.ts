/**
 * Regression test: loginAction must not hang indefinitely if claimGuestConversations hangs.
 *
 * Bug: When a guest session upgrade (claimGuestConversations) hangs (e.g., due to a slow
 * or stuck database operation), loginAction would wait forever and never return. The
 * client-side button would show "Logging in..." forever with no error and no redirect.
 *
 * Fix: Wrap claimGuestConversations with a timeout. If it doesn't complete in time,
 * log a warning and continue so the login itself still succeeds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockClaimGuestConversations = vi.hoisted(() => vi.fn())

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(() => ({ value: 'fake-guest-token' })),
  delete: vi.fn(),
}))

const mockGetPayload = vi.hoisted(() => vi.fn())

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: mockGetPayload,
  }
})

vi.mock('@/server/services/guest-session-upgrade', () => ({
  claimGuestConversations: mockClaimGuestConversations,
  GuestSessionClaimingInProgressError: class GuestSessionClaimingInProgressError extends Error {
    constructor() {
      super('Guest session is currently being claimed by another user. Please try again.')
      this.name = 'GuestSessionClaimingInProgressError'
    }
  },
}))

vi.mock('@/infra/utils/logger', () => ({
  logger: mockLogger,
  createRequestLogger: () => mockLogger,
}))

import { loginAction } from '@/app/(frontend)/login/login_authenticate-action'

function makePayloadStub(loginImpl: () => Promise<unknown>) {
  return {
    collections: { users: { config: { auth: {} } } },
    config: { cookiePrefix: 'payload' },
    login: vi.fn().mockImplementation(loginImpl),
  }
}

function buildFormData(email: string, password: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  fd.set('password', password)
  return fd
}

describe('loginAction timeout on guest session claim hang', () => {
  beforeEach(() => {
    mockLogger.error.mockClear()
    mockLogger.warn.mockClear()
    mockGetPayload.mockReset()
    mockClaimGuestConversations.mockClear()
    mockCookieStore.set.mockClear()
    mockCookieStore.delete.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns success within a reasonable time even if claimGuestConversations hangs', async () => {
    // Mock payload.login to succeed
    mockGetPayload.mockResolvedValue(
      makePayloadStub(async () => ({
        token: 'fake-token',
        user: { id: 'user-123' },
      })),
    )

    // Mock claimGuestConversations to NEVER resolve (simulates a hang)
    mockClaimGuestConversations.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves - simulates a hang
        }),
    )

    const formData = buildFormData('qa@example.com', 'testPassword123')
    const startTime = Date.now()

    // loginAction should NOT hang forever - it should timeout and return success
    // We expect it to return within 10 seconds even if claimGuestConversations hangs
    const timeoutMs = 10000

    // Use Promise.race to detect if loginAction hangs
    const result = await Promise.race([
      loginAction(formData, mockCookieStore),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('loginAction hung for too long')), timeoutMs),
      ),
    ])

    const elapsed = Date.now() - startTime

    // Should have returned a result, not null (null would mean the timeout fired)
    expect(result).not.toBeNull()

    // Should have completed within the timeout period
    expect(elapsed).toBeLessThan(timeoutMs)

    // Should have called cookie store set
    expect(mockCookieStore.set).toHaveBeenCalled()
  })
})
