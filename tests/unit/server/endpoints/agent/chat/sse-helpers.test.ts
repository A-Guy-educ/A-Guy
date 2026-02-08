/**
 * Unit Tests for SSE Helper Utilities
 *
 * @fileType test
 * @domain ai
 */
import {
  createSSEHeaders,
  formatChunkEvent,
  formatDoneEvent,
  formatErrorEvent,
  formatSSEMessage,
  parseSSEventLine,
  type SSEEventType,
} from '@/server/payload/endpoints/agent/chat/sse-helpers'
import { describe, expect, it } from 'vitest'

describe('formatSSEMessage', () => {
  it('formats a valid SSE message', () => {
    const event: SSEEventType = 'chunk'
    const data = { text: 'Hello' }
    const result = formatSSEMessage(event, data)

    const decoded = new TextDecoder().decode(result)
    expect(decoded).toBe('event: chunk\ndata: {"text":"Hello"}\n\n')
  })

  it('handles empty data object', () => {
    const result = formatSSEMessage('done', {})
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toBe('event: done\ndata: {}\n\n')
  })

  it('handles nested objects in data', () => {
    const result = formatSSEMessage('done', {
      conversationId: 'conv-123',
      contextKey: 'exercises:abc',
    })
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toContain('"conversationId":"conv-123"')
    expect(decoded).toContain('"contextKey":"exercises:abc"')
  })
})

describe('formatChunkEvent', () => {
  it('formats a chunk event with text', () => {
    const result = formatChunkEvent('Hello world')
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toBe('event: chunk\ndata: {"text":"Hello world"}\n\n')
  })

  it('handles empty text', () => {
    const result = formatChunkEvent('')
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toBe('event: chunk\ndata: {"text":""}\n\n')
  })

  it('handles special characters', () => {
    const result = formatChunkEvent('Hello\nWorld\t!')
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toContain('Hello\\nWorld\\t!')
  })
})

describe('formatDoneEvent', () => {
  it('formats a done event with metadata', () => {
    const result = formatDoneEvent({
      conversationId: 'conv-456',
      contextKey: 'lessons:xyz',
    })
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toBe(
      'event: done\ndata: {"conversationId":"conv-456","contextKey":"lessons:xyz"}\n\n',
    )
  })
})

describe('formatErrorEvent', () => {
  it('formats an error event with custom error', () => {
    const result = formatErrorEvent('Something went wrong', 'VALIDATION_ERROR')
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toBe(
      'event: error\ndata: {"error":"Something went wrong","code":"VALIDATION_ERROR"}\n\n',
    )
  })

  it('uses default error code when not provided', () => {
    const result = formatErrorEvent('Unknown error')
    const decoded = new TextDecoder().decode(result)
    expect(decoded).toContain('"code":"UNKNOWN_ERROR"')
  })
})

describe('createSSEHeaders', () => {
  it('returns correct SSE headers', () => {
    const headers = createSSEHeaders()

    expect(headers).toEqual({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    })
  })
})

describe('parseSSEventLine', () => {
  it('parses event line', () => {
    const result = parseSSEventLine('event: chunk')
    expect(result).toEqual({ type: 'event', value: 'chunk' })
  })

  it('parses data line', () => {
    const result = parseSSEventLine('data: {"text":"hello"}')
    expect(result).toEqual({ type: 'data', value: '{"text":"hello"}' })
  })

  it('parses id line', () => {
    const result = parseSSEventLine('id: 123')
    expect(result).toEqual({ type: 'id', value: '123' })
  })

  it('parses retry line', () => {
    const result = parseSSEventLine('retry: 5000')
    expect(result).toEqual({ type: 'retry', value: '5000' })
  })

  it('returns null for empty line', () => {
    const result = parseSSEventLine('')
    expect(result).toBeNull()
  })

  it('returns null for comment lines', () => {
    const result = parseSSEventLine(': this is a comment')
    expect(result).toBeNull()
  })

  it('handles event with whitespace', () => {
    const result = parseSSEventLine('event:  chunk  ')
    expect(result).toEqual({ type: 'event', value: 'chunk' })
  })
})
