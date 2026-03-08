/**
 * @fileType test
 * @domain inspector
 * @ai-summary Tests for the Slack webhook client
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createSlackClient } from '../../../../scripts/inspector/clients/slack'

describe('createSlackClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should report unconfigured when no webhook URL', () => {
    const client = createSlackClient()
    expect(client.isConfigured()).toBe(false)
  })

  it('should report configured when webhook URL provided', () => {
    const client = createSlackClient('https://hooks.slack.com/services/xxx')
    expect(client.isConfigured()).toBe(true)
  })

  it('should no-op postMessage when not configured', async () => {
    const client = createSlackClient()
    const _fetchSpy = vi.stubGlobal('fetch', vi.fn())

    await client.postMessage('test')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should POST to webhook when configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const client = createSlackClient('https://hooks.slack.com/services/xxx')
    await client.postMessage('Hello from inspector')

    expect(fetch).toHaveBeenCalledWith('https://hooks.slack.com/services/xxx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello from inspector' }),
    })
  })

  it('should not throw on Slack API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' }),
    )

    const client = createSlackClient('https://hooks.slack.com/services/xxx')

    // Should not throw
    await expect(client.postMessage('test')).resolves.toBeUndefined()
  })

  it('should not throw on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const client = createSlackClient('https://hooks.slack.com/services/xxx')

    // Should not throw
    await expect(client.postMessage('test')).resolves.toBeUndefined()
  })
})
