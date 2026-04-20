/**
 * Integration tests for GET /api/cron/warmup
 *
 * Verifies the Vercel warmup cron endpoint.
 *
 * @fileType integration-test
 * @domain infra.warmup
 */

import { GET } from '@/app/api/cron/warmup/route'
import { describe, expect, it } from 'vitest'

describe('GET /api/cron/warmup', () => {
  it('returns 200', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('returns warm: true', async () => {
    const response = await GET()
    const data = (await response.json()) as { warm: boolean; ts: string }

    expect(data.warm).toBe(true)
  })

  it('returns ISO timestamp', async () => {
    const response = await GET()
    const data = (await response.json()) as { ts: string }

    expect(() => new Date(data.ts)).not.toThrow()
    expect(new Date(data.ts)).toBeInstanceOf(Date)
  })

  it('sets no-cache headers to prevent proxy caching', async () => {
    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    expect(response.headers.get('X-Warmup')).toBe('true')
  })

  it('returns consistent timestamp format', async () => {
    const response1 = await GET()
    const response2 = await GET()
    const data1 = (await response1.json()) as { ts: string }
    const data2 = (await response2.json()) as { ts: string }

    // Both should be valid ISO-8601
    expect(new Date(data1.ts).toISOString()).toBe(data1.ts)
    expect(new Date(data2.ts).toISOString()).toBe(data2.ts)
  })
})
