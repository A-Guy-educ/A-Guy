/**
 * Tests that loginAction surfaces unexpected errors via structured logging
 * instead of silently masking them as "invalidCredentials".
 *
 * Background: the bare `catch {}` in login_authenticate-action.ts collapses
 * every failure (DB unreachable, Payload misconfigured, hash mismatch from
 * the historical OAuth password-corruption bug) into the same user-facing
 * "Invalid email or password" message AND emits no log line. Real failures
 * become indistinguishable from a wrong password, which is exactly what
 * made the OAuth-corruption bug so hard to diagnose.
 *
 * Contract:
 *   - Genuine AuthenticationError (wrong password): no error log (would spam logs).
 *   - Any other thrown error: logger.error called with the underlying error.
 *   - Either way: response is `{ success: false, error: 'invalidCredentials' }`
 *     so we don't leak server-state to the client.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(() => undefined),
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

vi.mock('@/infra/utils/logger', () => ({
  logger: mockLogger,
  createRequestLogger: () => mockLogger,
}))

import { loginAction } from '@/app/(frontend)/login/login_authenticate-action'
import { AuthenticationError } from 'payload'

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

describe('loginAction error logging', () => {
  beforeEach(() => {
    mockLogger.error.mockClear()
    mockLogger.warn.mockClear()
    mockGetPayload.mockReset()
  })

  it('logs the underlying error when payload.login throws a non-auth error', async () => {
    mockGetPayload.mockResolvedValue(
      makePayloadStub(async () => {
        throw new Error('Database connection lost')
      }),
    )

    const result = await loginAction(buildFormData('user@example.com', 'whatever'), mockCookieStore)

    expect(result).toEqual({ success: false, error: 'invalidCredentials' })
    expect(mockLogger.error).toHaveBeenCalledTimes(1)
    const [errPayload, msg] = mockLogger.error.mock.calls[0] as [Record<string, unknown>, string]
    // The logged payload must include the underlying error so operators can debug.
    const carriedError = (errPayload.err ?? errPayload.error) as Error | undefined
    expect(carriedError).toBeInstanceOf(Error)
    expect(carriedError?.message).toBe('Database connection lost')
    expect(typeof msg).toBe('string')
  })

  it('does NOT log noisily when payload.login throws AuthenticationError', async () => {
    mockGetPayload.mockResolvedValue(
      makePayloadStub(async () => {
        throw new AuthenticationError()
      }),
    )

    const result = await loginAction(buildFormData('user@example.com', 'wrongpw'), mockCookieStore)

    expect(result).toEqual({ success: false, error: 'invalidCredentials' })
    expect(mockLogger.error).not.toHaveBeenCalled()
  })
})
