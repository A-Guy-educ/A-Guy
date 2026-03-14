/**
 * Unit tests for remote tools injection in the chat route
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies
vi.mock('@/ui/cody/auth', () => ({
  requireDashboardAuth: vi.fn(() => ({
    authenticated: true,
    user: { id: '1', email: 'test@test.com' },
  })),
}))

vi.mock('@/ui/cody/remote-config', () => ({
  isRemoteEnabled: vi.fn(),
  getRemoteConfig: vi.fn(),
}))

vi.mock('@/ui/cody/github-client', () => ({
  fetchIssue: vi.fn(),
  fetchIssues: vi.fn(),
  fetchComments: vi.fn(),
  getStatusFromBranch: vi.fn(),
  findTaskBranch: vi.fn(),
  fetchWorkflowRuns: vi.fn(),
  findAssociatedPR: vi.fn(),
  getOctokit: vi.fn(() => ({ repos: { getContent: vi.fn() } })),
}))

vi.mock('@ai-sdk/mcp', () => ({
  createMCPClient: vi.fn(() =>
    Promise.resolve({
      tools: vi.fn(() => Promise.resolve({})),
    }),
  ),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => (model: string) => ({ model })),
}))

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: vi.fn(() => new Response('stream')),
  })),
  tool: vi.fn((config) => config),
  stepCountIs: vi.fn(),
}))

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { isRemoteEnabled } from '@/ui/cody/remote-config'
import { streamText } from 'ai'
import { NextRequest } from 'next/server'

describe('chat route — remote tools injection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
    process.env.GH_PAT = 'test-token'
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
  })

  it('does NOT inject remote tools when user has no remote config', async () => {
    vi.mocked(isRemoteEnabled).mockReturnValue(false)

    const { POST } = await import('@/app/api/cody/chat/route')

    const req = new NextRequest('http://localhost/api/cody/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }],
        actorLogin: 'alice',
      }),
    })

    await POST(req)

    expect(streamText).toHaveBeenCalled()
    const callArgs = vi.mocked(streamText).mock.calls[0][0]
    const toolKeys = Object.keys(callArgs.tools ?? {})
    expect(toolKeys).not.toContain('remoteExec')
    expect(toolKeys).not.toContain('remoteRead')
  })

  it('injects remote tools when user has remote config', async () => {
    vi.mocked(isRemoteEnabled).mockReturnValue(true)

    const { POST } = await import('@/app/api/cody/chat/route')

    const req = new NextRequest('http://localhost/api/cody/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }],
        actorLogin: 'alice',
      }),
    })

    await POST(req)

    expect(streamText).toHaveBeenCalled()
    const callArgs = vi.mocked(streamText).mock.calls[0][0]
    const toolKeys = Object.keys(callArgs.tools ?? {})
    expect(toolKeys).toContain('remoteExec')
    expect(toolKeys).toContain('remoteRead')
    expect(toolKeys).toContain('remoteWrite')
    expect(toolKeys).toContain('remoteLs')
  })

  it('appends REMOTE_SYSTEM_PROMPT_EXTENSION to system prompt when enabled', async () => {
    vi.mocked(isRemoteEnabled).mockReturnValue(true)

    const { POST } = await import('@/app/api/cody/chat/route')

    const req = new NextRequest('http://localhost/api/cody/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }],
        actorLogin: 'alice',
      }),
    })

    await POST(req)

    const callArgs = vi.mocked(streamText).mock.calls[0][0]
    expect(callArgs.system).toContain('Remote Dev Environment')
    expect(callArgs.system).toContain('remoteExec')
  })
})
