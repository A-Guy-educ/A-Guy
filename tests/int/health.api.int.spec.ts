import { describe, expect, it } from 'vitest'

describe('GET /api/health', () => {
  it('returns 200 on success', async () => {
    const response = await fetch('http://localhost:3000/api/health')
    expect(response.status).toBe(200)
  })

  it('returns JSON with all required keys', async () => {
    const response = await fetch('http://localhost:3000/api/health')
    const data = await response.json()

    expect(data).toHaveProperty('ok')
    expect(data).toHaveProperty('gitSha')
    expect(data).toHaveProperty('payloadVersion')
    expect(data).toHaveProperty('projectVersion')
    expect(data).toHaveProperty('timestamp')
  })

  it('returns ok as boolean true', async () => {
    const response = await fetch('http://localhost:3000/api/health')
    const data = await response.json()

    expect(typeof data.ok).toBe('boolean')
    expect(data.ok).toBe(true)
  })

  it('returns string values for all fields', async () => {
    const response = await fetch('http://localhost:3000/api/health')
    const data = await response.json()

    expect(typeof data.gitSha).toBe('string')
    expect(typeof data.payloadVersion).toBe('string')
    expect(typeof data.projectVersion).toBe('string')
    expect(typeof data.timestamp).toBe('string')
  })

  it('returns valid ISO-8601 timestamp', async () => {
    const response = await fetch('http://localhost:3000/api/health')
    const data = await response.json()

    expect(() => new Date(data.timestamp)).not.toThrow()
    expect(new Date(data.timestamp)).toBeInstanceOf(Date)
  })
})
