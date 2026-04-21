/**
 * Unit tests for HTTP retry utilities
 *
 * @fileType test
 * @domain infra
 * @pattern retry
 */
import { fetchBuffer } from '@/infra/utils/http'
import { describe, expect, it, vi } from 'vitest'

// Mock fetch for HTTP tests
global.fetch = vi.fn()

describe('fetchBuffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return buffer on successful fetch', async () => {
    const mockData = Buffer.from('test content')
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData.buffer),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

    const result = await fetchBuffer('https://example.com/file.pdf')

    expect(result).toBeInstanceOf(Buffer)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should retry on 5xx errors with exponential backoff', async () => {
    const mockData = Buffer.from('test content')
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData.buffer),
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response)
      .mockResolvedValueOnce(mockResponse as unknown as Response)

    const result = await fetchBuffer('https://example.com/file.pdf')

    expect(result).toBeInstanceOf(Buffer)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('should NOT retry on 4xx errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)

    await expect(fetchBuffer('https://example.com/missing.pdf')).rejects.toThrow(
      'HTTP 404 Not Found',
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should throw after exhausting all retries', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response)

    await expect(fetchBuffer('https://example.com/error.pdf')).rejects.toThrow(
      'HTTP 500 Internal Server Error',
    )
    expect(fetch).toHaveBeenCalledTimes(4) // Initial + 3 retries
  })

  it('should retry on network errors with exponential backoff', async () => {
    const mockData = Buffer.from('test content')
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData.buffer),
    }
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(mockResponse as unknown as Response)

    const result = await fetchBuffer('https://example.com/file.pdf')

    expect(result).toBeInstanceOf(Buffer)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('should throw after exhausting retries on network errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(fetchBuffer('https://example.com/error.pdf')).rejects.toThrow('ECONNREFUSED')
    expect(fetch).toHaveBeenCalledTimes(4) // Initial + 3 retries
  })

  it('should use custom timeout', async () => {
    const mockData = Buffer.from('test content')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData.buffer),
    } as unknown as Response)

    await fetchBuffer('https://example.com/file.pdf', 5000)

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/file.pdf',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('should pass custom headers', async () => {
    const mockData = Buffer.from('test content')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData.buffer),
    } as unknown as Response)

    const headers = { Authorization: 'Bearer token123' }
    await fetchBuffer('https://example.com/file.pdf', 30000, headers)

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/file.pdf',
      expect.objectContaining({ headers }),
    )
  })
})
