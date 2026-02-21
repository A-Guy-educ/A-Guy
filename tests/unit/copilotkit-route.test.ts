import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('CopilotKit API route', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return 500 when no API keys configured', async () => {
    // Mock server-init to no-op
    vi.mock('@/infra/config/server-init', () => ({}))
    vi.mock('@/infra/utils/logger/logger', () => ({
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    }))

    const { POST } = await import('@/app/api/copilotkit/route')

    // Create a mock NextRequest-like object
    const mockRequest = {
      headers: new Headers(),
    } as unknown as import('next/server').NextRequest

    const response = await POST(mockRequest)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toMatch(/API key/i)
    expect(body.requestId).toBeDefined()
  })
})
