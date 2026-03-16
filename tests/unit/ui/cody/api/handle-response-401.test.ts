/**
 * @fileType test
 * @domain cody | ui
 * @pattern bug-fix
 * @ai-summary Tests that handleResponse distinguishes server token 401 from session auth 401
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { handleResponse, NoTokenError, SessionExpiredError } from '@/ui/cody/api'

/** Helper to build a mock Response with JSON body */
function mockResponse(status: number, body: Record<string, unknown>): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response
}

describe('handleResponse — 401 handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws NoTokenError when server returns error=no_token', async () => {
    const res = mockResponse(401, {
      error: 'no_token',
      message: 'GitHub token is not configured. Set CODY_BOT_TOKEN or GITHUB_TOKEN.',
    })

    await expect(handleResponse(res)).rejects.toThrow(NoTokenError)
  })

  it('includes the server message in NoTokenError', async () => {
    const res = mockResponse(401, {
      error: 'no_token',
      message: 'GitHub token is not configured. Set CODY_BOT_TOKEN or GITHUB_TOKEN.',
    })

    await expect(handleResponse(res)).rejects.toMatchObject({
      name: 'NoTokenError',
      message: 'GitHub token is not configured. Set CODY_BOT_TOKEN or GITHUB_TOKEN.',
    })
  })

  it('throws SessionExpiredError (not NoTokenError) for session auth 401', async () => {
    const res = mockResponse(401, {
      message: 'Not authenticated. Please log in to access the dashboard.',
    })

    await expect(handleResponse(res)).rejects.toThrow(SessionExpiredError)
    await expect(
      handleResponse(
        mockResponse(401, {
          message: 'Not authenticated. Please log in to access the dashboard.',
        }),
      ),
    ).rejects.not.toThrow(NoTokenError)
  })

  it('does NOT redirect on session 401 (avoids infinite loop)', async () => {
    const mockLocation = { pathname: '/cody/839/preview/comments', href: '' }
    vi.stubGlobal('window', { location: mockLocation })

    const res = mockResponse(401, {
      message: 'Not authenticated. Please log in to access the dashboard.',
    })

    await expect(handleResponse(res)).rejects.toThrow(SessionExpiredError)

    // Must NOT have redirected — that causes infinite loops
    expect(mockLocation.href).toBe('')
  })

  it('preserves server message in SessionExpiredError', async () => {
    const res = mockResponse(401, {
      message: 'Not authenticated. Please log in to access the dashboard.',
    })

    try {
      await handleResponse(res)
    } catch (e) {
      expect(e).toBeInstanceOf(SessionExpiredError)
      expect((e as SessionExpiredError).message).toBe(
        'Not authenticated. Please log in to access the dashboard.',
      )
    }
  })

  it('uses fallback message when server returns empty body on session 401', async () => {
    const res = mockResponse(401, {})

    try {
      await handleResponse(res)
    } catch (e) {
      expect(e).toBeInstanceOf(SessionExpiredError)
      expect((e as SessionExpiredError).message).toBe(
        'Your session has expired. Please log in again.',
      )
    }
  })

  it('does NOT throw NoTokenError for generic 401 without error=no_token', async () => {
    const res = mockResponse(401, { error: 'unauthorized', message: 'Bad credentials' })

    await expect(handleResponse(res)).rejects.toThrow(SessionExpiredError)
    await expect(
      handleResponse(mockResponse(401, { error: 'unauthorized', message: 'Bad credentials' })),
    ).rejects.not.toThrow(NoTokenError)
  })
})
