// @vitest-environment jsdom
import React from 'react'
import { HealthBadge } from '@/components/ui/HealthBadge'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface HealthResponse {
  ok: boolean
  gitSha: string
  payloadVersion: string
  projectVersion: string
  timestamp: string
}

const healthyResponse: HealthResponse = {
  ok: true,
  gitSha: 'abc123def456',
  payloadVersion: '3.73.0',
  projectVersion: '0.6.0',
  timestamp: '2026-07-02T12:00:00.000Z',
}

const unhealthyResponse: HealthResponse = {
  ok: false,
  gitSha: 'abc123def456',
  payloadVersion: '3.73.0',
  projectVersion: '0.6.0',
  timestamp: '2026-07-02T12:00:00.000Z',
}

const renderHealthBadge = (showVersion = false) => {
  return render(React.createElement(HealthBadge, { showVersion }))
}

describe('HealthBadge component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
