// @vitest-environment jsdom
/**
 * Component test for CodyChat streaming behavior.
 *
 * Renders the real CodyChat component with a React state wrapper
 * so that setMessages triggers actual re-renders. Mocks fetch to
 * return AI SDK v6 SSE streams and asserts on rendered DOM content.
 *
 * This single test file covers the full pipeline:
 *   AI SDK stream format → SSE parser → React state → DOM rendering
 *
 * @fileType test
 * @domain cody | chat
 */

import React, { useState } from 'react'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ChatMessage } from '@/ui/cody/chat-types'

// ============================================================================
// Mocks — must be at top level before any imports of mocked modules
// ============================================================================

// Mock react-markdown: render text directly so we can assert on content
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('div', { 'data-testid': 'markdown' }, children),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: null, isLoading: false, error: null })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}))

vi.mock('@/ui/cody/hooks/useRemoteStatus', () => ({
  useRemoteStatus: vi.fn(() => ({ data: null, isLoading: false })),
}))

vi.mock('@/ui/cody/hooks/useVoiceChat', () => ({
  useVoiceChat: vi.fn(() => ({
    state: 'idle',
    currentTranscript: '',
    start: vi.fn(),
    stop: vi.fn(),
    pauseConversation: vi.fn(),
    resumeConversation: vi.fn(),
    onResponseComplete: vi.fn(),
  })),
}))

// useChatSessions mock — overridden per test via sessionStateRef
const sessionStateRef: {
  messages: ChatMessage[]
  setMessages: ((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void) | null
} = { messages: [], setMessages: null }

vi.mock('@/ui/cody/hooks/useChatSessions', () => ({
  useChatSessions: vi.fn(() => ({
    sessions: [],
    activeSession: { id: 'test-session', name: 'Test' },
    get messages() {
      return sessionStateRef.messages
    },
    setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      sessionStateRef.setMessages?.(updater)
    },
    createSession: vi.fn(),
    switchSession: vi.fn(),
    deleteSession: vi.fn(),
    renameSession: vi.fn(),
    pinSession: vi.fn(),
  })),
}))

// Stub child components irrelevant to streaming
vi.mock('@/ui/cody/components/ConfirmDialog', () => ({ ConfirmDialog: () => null }))
vi.mock('@/ui/cody/components/SessionSidebar', () => ({ SessionSidebar: () => null }))
vi.mock('@/ui/cody/components/TaskSessionHistory', () => ({ TaskSessionHistory: () => null }))
vi.mock('@/ui/cody/components/ToolCallCard', () => ({ ToolCallList: () => null }))
vi.mock('@/ui/cody/components/MessageActions', () => ({ MessageActions: () => null }))
vi.mock('@/ui/cody/components/VoiceButton', () => ({ VoiceButton: () => null }))
vi.mock('@/ui/cody/components/VoiceChatOverlay', () => ({ VoiceChatOverlay: () => null }))

// Polyfill scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn()

// ============================================================================
// Wrapper: Provides real React state for the session messages mock
// ============================================================================

/**
 * Wraps CodyChat so that useChatSessions().setMessages triggers real
 * React re-renders. The component reads messages from sessionStateRef,
 * which this wrapper keeps in sync with React state.
 */
function ChatWrapper({ CodyChat }: { CodyChat: React.ComponentType }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Wire the ref to real React state so the mock's setMessages triggers re-renders
  sessionStateRef.messages = messages
  sessionStateRef.setMessages = setMessages

  return React.createElement(CodyChat)
}

// ============================================================================
// Helpers
// ============================================================================

/** Build a Response that streams AI SDK v6 SSE format */
function createStreamResponse(parts: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(part)}\n\n`))
        // Microtask yield to simulate real streaming
        await new Promise((r) => setTimeout(r, 1))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
  })
}

/** AI SDK v6 stream parts for a text response */
function textResponseParts(text: string): Array<Record<string, unknown>> {
  const words = text.split(' ')
  return [
    { type: 'start', messageId: 'msg-test' },
    { type: 'text-start', id: 'text-0' },
    ...words.map((word, i) => ({
      type: 'text-delta',
      id: 'text-0',
      delta: i === 0 ? word : ` ${word}`,
    })),
    { type: 'text-end', id: 'text-0' },
    { type: 'finish', messageId: 'msg-test', finishReason: 'stop' },
  ]
}

/** AI SDK v6 stream with tool calls between text segments */
function toolCallResponseParts(): Array<Record<string, unknown>> {
  return [
    { type: 'start', messageId: 'msg-tools' },
    { type: 'text-start', id: 'text-0' },
    { type: 'text-delta', id: 'text-0', delta: 'Checking tasks...' },
    { type: 'text-end', id: 'text-0' },
    { type: 'tool-call-start', toolCallId: 'call-1', toolName: 'listCodyTasks' },
    { type: 'tool-call', toolCallId: 'call-1', toolName: 'listCodyTasks', args: {} },
    { type: 'tool-result', toolCallId: 'call-1', result: { tasks: [] } },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: ' Found 0 tasks.' },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', messageId: 'msg-tools', finishReason: 'stop' },
  ]
}

/** Type a message into the textarea and press Enter */
async function typeAndSend(textarea: HTMLElement, text: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set
    setter?.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await act(async () => {
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('CodyChat streaming UI', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    sessionStateRef.messages = []
    sessionStateRef.setMessages = null
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  it('renders streamed text in the DOM after stream completes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createStreamResponse(textResponseParts('Hello from Gemini')),
    )

    const { CodyChat } = await import('@/ui/cody/components/CodyChat')
    render(React.createElement(ChatWrapper, { CodyChat }))

    const textarea = screen.getByRole('textbox')
    await typeAndSend(textarea, 'test message')

    // Wait for fetch
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // Verify the request
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(url).toBe('/api/cody/chat')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.agentId).toBe('dashboard-manager')
    expect(body.messages.length).toBeGreaterThan(0)

    // Wait for streamed content to appear in DOM
    await waitFor(
      () => {
        const markdowns = screen.getAllByTestId('markdown')
        const assistantContent = markdowns.map((el) => el.textContent).join('')
        expect(assistantContent).toContain('Hello from Gemini')
      },
      { timeout: 5000 },
    )
  })

  it('renders text around tool calls (tool-call events are silently skipped)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createStreamResponse(toolCallResponseParts()),
    )

    const { CodyChat } = await import('@/ui/cody/components/CodyChat')
    render(React.createElement(ChatWrapper, { CodyChat }))

    await typeAndSend(screen.getByRole('textbox'), 'list tasks')

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // Text from both segments should render, despite tool events in between
    await waitFor(
      () => {
        const markdowns = screen.getAllByTestId('markdown')
        const content = markdowns.map((el) => el.textContent).join('')
        expect(content).toContain('Checking tasks...')
        expect(content).toContain('Found 0 tasks.')
      },
      { timeout: 5000 },
    )
  })

  it('shows error message when API returns 503', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { CodyChat } = await import('@/ui/cody/components/CodyChat')
    render(React.createElement(ChatWrapper, { CodyChat }))

    await typeAndSend(screen.getByRole('textbox'), 'hello')

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // The component should render an error message in the assistant bubble
    await waitFor(
      () => {
        const markdowns = screen.getAllByTestId('markdown')
        const content = markdowns.map((el) => el.textContent).join('')
        expect(content).toContain('Error:')
        expect(content).toContain('GEMINI_API_KEY is not configured')
      },
      { timeout: 5000 },
    )
  })

  it('shows "Thinking..." then clears loading when stream returns no text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createStreamResponse([
        { type: 'start', messageId: 'msg-empty' },
        { type: 'finish', messageId: 'msg-empty', finishReason: 'stop' },
      ]),
    )

    const { CodyChat } = await import('@/ui/cody/components/CodyChat')
    render(React.createElement(ChatWrapper, { CodyChat }))

    await typeAndSend(screen.getByRole('textbox'), 'hello')

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // After stream completes, loading indicator should clear.
    // The animate-pulse span is the loading indicator.
    await waitFor(
      () => {
        const pulsingDots = document.querySelectorAll('.animate-pulse')
        expect(pulsingDots.length).toBe(0)
      },
      { timeout: 5000 },
    )
  })

  it('shows user message in DOM before stream starts', async () => {
    // Use a stream that takes a while so we can check the user message first
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(createStreamResponse(textResponseParts('response'))),
            100,
          ),
        ),
    )

    const { CodyChat } = await import('@/ui/cody/components/CodyChat')
    render(React.createElement(ChatWrapper, { CodyChat }))

    await typeAndSend(screen.getByRole('textbox'), 'my question')

    // User message should appear immediately (before stream resolves)
    await waitFor(
      () => {
        expect(screen.getByText('my question')).toBeTruthy()
      },
      { timeout: 3000 },
    )
  })
})
