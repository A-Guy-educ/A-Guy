/**
 * Unit tests for remote agent auth middleware
 */
import { describe, it, expect, vi } from 'vitest'

// Mock config module before importing auth
vi.mock('../../../../scripts/remote-agent/config', () => ({
  REMOTE_AGENT_KEY: 'test-secret-key',
  REMOTE_AGENT_PORT: 3456,
  REMOTE_AGENT_ALLOWED_ROOTS: [],
  EXEC_MAX_BYTES: 512 * 1024,
  READ_MAX_BYTES: 1024 * 1024,
  LS_MAX_ENTRIES: 500,
  EXEC_TIMEOUT_MS: 30000,
  EXEC_DENY_LIST: ['sudo', 'rm -rf /'],
}))

import {
  isAuthorized,
  timingSafeEqual,
  rejectUnauthorized,
} from '../../../../scripts/remote-agent/auth'
import type { IncomingMessage, ServerResponse } from 'http'

function makeReq(authHeader?: string): IncomingMessage {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as IncomingMessage
}

describe('isAuthorized', () => {
  it('returns true for valid Bearer token', () => {
    const req = makeReq('Bearer test-secret-key')
    expect(isAuthorized(req)).toBe(true)
  })

  it('returns false when no Authorization header', () => {
    const req = makeReq()
    expect(isAuthorized(req)).toBe(false)
  })

  it('returns false for wrong token', () => {
    const req = makeReq('Bearer wrong-key')
    expect(isAuthorized(req)).toBe(false)
  })

  it('returns false for non-Bearer scheme', () => {
    const req = makeReq('Basic dXNlcjpwYXNz')
    expect(isAuthorized(req)).toBe(false)
  })
})

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
  })

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false)
  })

  it('returns false for different length strings', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('rejectUnauthorized', () => {
  it('sends 401 with JSON error body', () => {
    const writeHead = vi.fn()
    const end = vi.fn()
    const res = { writeHead, end } as unknown as ServerResponse

    rejectUnauthorized(res)

    expect(writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
    expect(end).toHaveBeenCalledWith(JSON.stringify({ error: 'Unauthorized' }))
  })
})
