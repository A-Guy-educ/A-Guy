import { GET } from '@/app/api/health/route'
import { describe, expect, it } from 'vitest'

describe('GET /api/health', () => {
  it('returns 200 on success', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('returns JSON with all required keys', async () => {
    const response = await GET()
    const data = (await response.json()) as {
      ok: boolean
      checks: { database: boolean }
      version: string
      gitSha: string
      timestamp: string
    }

    expect(data).toHaveProperty('ok')
    expect(data).toHaveProperty('checks')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('gitSha')
    expect(data).toHaveProperty('timestamp')
  })

  it('returns ok as boolean true', async () => {
    const response = await GET()
    const data = (await response.json()) as { ok: boolean }

    expect(typeof data.ok).toBe('boolean')
    expect(data.ok).toBe(true)
  })

  it('returns string values for all fields', async () => {
    const response = await GET()
    const data = (await response.json()) as {
      version: string
      gitSha: string
      timestamp: string
    }

    expect(typeof data.gitSha).toBe('string')
    expect(typeof data.version).toBe('string')
    expect(typeof data.timestamp).toBe('string')
  })

  it('returns valid ISO-8601 timestamp', async () => {
    const response = await GET()
    const data = (await response.json()) as { timestamp: string }

    expect(() => new Date(data.timestamp)).not.toThrow()
    expect(new Date(data.timestamp)).toBeInstanceOf(Date)
  })
})
