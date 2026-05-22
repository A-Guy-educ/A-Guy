// @vitest-environment jsdom
import { HealthBadge } from '@/ui/web/components/HealthBadge'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface HealthResponse {
  ok: boolean
  gitSha: string
  version: string
  timestamp: string
}

const healthyResponse: HealthResponse = {
  ok: true,
  gitSha: 'abc123def456',
  version: '0.6.0',
  timestamp: '2026-07-02T12:00:00.000Z',
}

const unhealthyResponse: HealthResponse = {
  ok: false,
  gitSha: 'abc123def456',
  version: '0.6.0',
  timestamp: '2026-07-02T12:00:00.000Z',
}

const renderHealthBadge = (showVersion = false) => {
  const result = render(React.createElement(HealthBadge, { showVersion }))
  return result
}

describe('HealthBadge component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows loading state before fetch resolves', async () => {
      let resolveFetch!: (value: Response) => void
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })

      vi.spyOn(global, 'fetch').mockImplementation(() => fetchPromise)

      renderHealthBadge()

      expect(screen.getByText('Checking API...')).toBeTruthy()
      expect(screen.getByText('●')).toBeTruthy()

      resolveFetch(new Response(JSON.stringify(healthyResponse), { status: 200 }))
      await fetchPromise
    })
  })

  describe('healthy state', () => {
    it('shows healthy state when API returns 200 with ok: true', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(healthyResponse), { status: 200 }),
      )

      renderHealthBadge()

      expect(await screen.findByText('API OK')).toBeTruthy()
      expect(screen.getByText('●')).toBeTruthy()
    })

    it('does not show version info when showVersion is false', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(healthyResponse), { status: 200 }),
      )

      renderHealthBadge(false)

      expect(await screen.findByText('API OK')).toBeTruthy()
      expect(screen.queryByText('0.6.0')).toBeNull()
    })

    it('shows version info when showVersion is true', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(healthyResponse), { status: 200 }),
      )

      renderHealthBadge(true)

      expect(await screen.findByText('API OK')).toBeTruthy()
      expect(screen.getByText(/0\.6\.0/)).toBeTruthy()
      expect(screen.getByText(/abc123d/)).toBeTruthy()
    })

    it('does not show ambiguous (unknown) text when API returns actual response format', async () => {
      // Actual health endpoint returns: { ok, checks, version, gitSha, timestamp, pool }
      // NOT: { ok, gitSha, payloadVersion, projectVersion, timestamp }
      // The badge must handle this gracefully without showing "(unknown)"
      const actualApiResponse = {
        ok: true,
        checks: { database: true },
        version: '0.6.0',
        gitSha: 'abc123def456',
        timestamp: '2026-07-02T12:00:00.000Z',
      }

      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(actualApiResponse), { status: 200 }),
      )

      renderHealthBadge(true)

      expect(await screen.findByText('API OK')).toBeTruthy()
      // Must not show "(unknown)" anywhere - that's the bug
      expect(screen.queryByText(/\(unknown\)/)).toBeNull()
    })

    it('does not show (unknown) when projectVersion is missing and gitSha is unknown', async () => {
      // This is the production scenario: version="unknown" from env, no projectVersion field,
      // gitSha="unknown" from env - resulting in confusing "(unknown)" suffix
      const productionResponse = {
        ok: true,
        checks: { database: true },
        version: 'unknown',
        gitSha: 'unknown',
        timestamp: '2026-07-02T12:00:00.000Z',
      }

      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(productionResponse), { status: 200 }),
      )

      renderHealthBadge(true)

      expect(await screen.findByText('API OK')).toBeTruthy()
      // The bug shows "(unknown)" when projectVersion is missing/unknown and gitSha is "unknown"
      // Should NOT show "(unknown)" - it's confusing
      expect(screen.queryByText(/\(unknown\)/)).toBeNull()
    })
  })

  describe('unhealthy state', () => {
    it('shows unhealthy state when API returns 200 with ok: false', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(unhealthyResponse), { status: 200 }),
      )

      renderHealthBadge()

      expect(await screen.findByText('API DOWN')).toBeTruthy()
      expect(screen.getByText('●')).toBeTruthy()
    })

    it('shows unhealthy state when API returns non-200 status', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'Server error' }), { status: 500 }),
      )

      renderHealthBadge()

      expect(await screen.findByText('API DOWN')).toBeTruthy()
    })
  })

  describe('error state', () => {
    it('shows error state when fetch throws', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

      renderHealthBadge()

      expect(await screen.findByText('API ERROR')).toBeTruthy()
    })

    it('shows error state when response is not valid JSON', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(new Response('invalid json', { status: 200 }))

      renderHealthBadge()

      expect(await screen.findByText('API ERROR')).toBeTruthy()
    })
  })
})
