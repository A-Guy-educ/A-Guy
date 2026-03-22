/**
 * Tests for SSE stream parsing — verifying compatibility between
 * AI SDK v6 toUIMessageStreamResponse() output and the frontend parser.
 *
 * These tests reproduce the "no response from LLM" bug by testing
 * the actual stream format produced by AI SDK v6 against the parser.
 *
 * @fileType test
 * @domain cody | chat
 */

import { describe, expect, it, vi } from 'vitest'
import { parseSSEChunk, consumeSSEStream, type ParseSSECallbacks } from '@/ui/cody/parse-sse-stream'

// ============================================================================
// Helpers
// ============================================================================

function createCallbacks(): ParseSSECallbacks & { deltas: string[]; tools: string[]; errors: string[] } {
  const deltas: string[] = []
  const tools: string[] = []
  const errors: string[] = []
  return {
    deltas,
    tools,
    errors,
    onTextDelta: (delta) => deltas.push(delta),
    onToolInputStart: (name) => tools.push(name),
    onToolOutputAvailable: vi.fn(),
    onError: (err) => errors.push(err),
  }
}

/**
 * Encode a string as a ReadableStream<Uint8Array>, simulating
 * how a Response.body stream delivers data.
 */
function stringToStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

/**
 * Encode text as a stream that delivers one byte at a time,
 * simulating worst-case chunking.
 */
function byteByByteStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < bytes.length) {
        controller.enqueue(new Uint8Array([bytes[i]]))
        i++
      } else {
        controller.close()
      }
    },
  })
}

// ============================================================================
// AI SDK v6 Stream Format Fixtures
// ============================================================================

/**
 * This is the ACTUAL format produced by AI SDK v6's toUIMessageStreamResponse().
 *
 * The JsonToSseTransformStream wraps each object as:
 *   data: <JSON.stringify(part)>\n\n
 *
 * The toUIMessageStream() emits these part types in order:
 *   1. {type: "start", messageId: "..."}          (when sendStart=true)
 *   2. {type: "text-start", id: "..."}             (before first text)
 *   3. {type: "text-delta", id: "...", delta: "x"} (for each text chunk)
 *   4. {type: "text-end", id: "..."}               (after last text chunk)
 *   5. {type: "finish", messageId: "...", ...}     (when sendFinish=true)
 *   6. [DONE]                                       (stream termination)
 */
const AI_SDK_V6_STREAM = [
  'data: {"type":"start","messageId":"msg-abc123"}\n\n',
  'data: {"type":"text-start","id":"text-0"}\n\n',
  'data: {"type":"text-delta","id":"text-0","delta":"Hello"}\n\n',
  'data: {"type":"text-delta","id":"text-0","delta":" from"}\n\n',
  'data: {"type":"text-delta","id":"text-0","delta":" Gemini"}\n\n',
  'data: {"type":"text-end","id":"text-0"}\n\n',
  'data: {"type":"finish","messageId":"msg-abc123","finishReason":"stop"}\n\n',
  'data: [DONE]\n\n',
].join('')

/**
 * This is the format used in the existing mock (cody-chat.int.spec.ts line 62-85).
 * It lacks the start/text-start/text-end/finish events that the real SDK sends.
 */
const MOCK_STREAM_FORMAT = [
  'data: {"type":"text-delta","delta":"Hello"}\n',
  'data: {"type":"text-delta","delta":" there"}\n',
  'data: {"type":"text-delta","delta":"!"}\n',
  'data: [DONE]\n',
].join('')

/**
 * Stream with tool calls in AI SDK v6 format.
 * The real SDK sends tool-call-start, tool-call-delta, tool-call events,
 * NOT "tool-input-start" which the frontend expects.
 */
const AI_SDK_V6_TOOL_STREAM = [
  'data: {"type":"start","messageId":"msg-xyz"}\n\n',
  'data: {"type":"text-start","id":"text-0"}\n\n',
  'data: {"type":"text-delta","id":"text-0","delta":"Let me check"}\n\n',
  'data: {"type":"text-end","id":"text-0"}\n\n',
  'data: {"type":"tool-call-start","toolCallId":"call-1","toolName":"listCodyTasks"}\n\n',
  'data: {"type":"tool-call-delta","toolCallId":"call-1","argsTextDelta":"{}"}\n\n',
  'data: {"type":"tool-call","toolCallId":"call-1","toolName":"listCodyTasks","args":{}}\n\n',
  'data: {"type":"tool-result","toolCallId":"call-1","result":"[task1, task2]"}\n\n',
  'data: {"type":"text-start","id":"text-1"}\n\n',
  'data: {"type":"text-delta","id":"text-1","delta":"Here are the tasks."}\n\n',
  'data: {"type":"text-end","id":"text-1"}\n\n',
  'data: {"type":"finish","messageId":"msg-xyz","finishReason":"stop"}\n\n',
  'data: [DONE]\n\n',
].join('')

/**
 * Stream that contains an error event in AI SDK v6 format.
 * The real SDK sends {type: "error", errorText: "..."}.
 */
const AI_SDK_V6_ERROR_STREAM = [
  'data: {"type":"start","messageId":"msg-err"}\n\n',
  'data: {"type":"error","errorText":"Model returned an error"}\n\n',
  'data: [DONE]\n\n',
].join('')

/**
 * Empty stream — model returns nothing (no text-delta events).
 */
const AI_SDK_V6_EMPTY_RESPONSE = [
  'data: {"type":"start","messageId":"msg-empty"}\n\n',
  'data: {"type":"finish","messageId":"msg-empty","finishReason":"stop"}\n\n',
  'data: [DONE]\n\n',
].join('')

// ============================================================================
// Tests: parseSSEChunk
// ============================================================================

describe('parseSSEChunk', () => {
  describe('AI SDK v6 format compatibility', () => {
    it('parses text-delta events from real AI SDK v6 stream', () => {
      const cb = createCallbacks()
      parseSSEChunk(AI_SDK_V6_STREAM, cb)

      expect(cb.deltas).toEqual(['Hello', ' from', ' Gemini'])
    })

    it('parses the mock format used in existing integration tests', () => {
      const cb = createCallbacks()
      parseSSEChunk(MOCK_STREAM_FORMAT, cb)

      expect(cb.deltas).toEqual(['Hello', ' there', '!'])
    })

    it('ignores start, text-start, text-end, finish events without error', () => {
      const cb = createCallbacks()
      // Should not throw and should not produce unexpected callbacks
      parseSSEChunk(AI_SDK_V6_STREAM, cb)

      expect(cb.errors).toEqual([])
      expect(cb.tools).toEqual([])
    })

    it('parses error events from AI SDK v6 stream', () => {
      const cb = createCallbacks()
      parseSSEChunk(AI_SDK_V6_ERROR_STREAM, cb)

      expect(cb.errors).toEqual(['Model returned an error'])
      expect(cb.deltas).toEqual([])
    })

    it('returns no text for empty model response', () => {
      const cb = createCallbacks()
      parseSSEChunk(AI_SDK_V6_EMPTY_RESPONSE, cb)

      expect(cb.deltas).toEqual([])
    })
  })

  describe('tool call handling — format mismatch', () => {
    it('does NOT detect tool calls from AI SDK v6 format (tool-call-start vs tool-input-start)', () => {
      const cb = createCallbacks()
      parseSSEChunk(AI_SDK_V6_TOOL_STREAM, cb)

      // The frontend expects "tool-input-start" events,
      // but AI SDK v6 sends "tool-call-start".
      // This means tool call indicators never appear in the UI.
      expect(cb.tools).toEqual([])
    })

    it('still parses text-delta around tool calls', () => {
      const cb = createCallbacks()
      parseSSEChunk(AI_SDK_V6_TOOL_STREAM, cb)

      expect(cb.deltas).toEqual(['Let me check', 'Here are the tasks.'])
    })

    it('would detect tool calls if they used the expected format', () => {
      const cb = createCallbacks()
      const customToolStream =
        'data: {"type":"tool-input-start","toolName":"listCodyTasks"}\n\n'
      parseSSEChunk(customToolStream, cb)

      expect(cb.tools).toEqual(['listCodyTasks'])
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      const cb = createCallbacks()
      parseSSEChunk('', cb)

      expect(cb.deltas).toEqual([])
    })

    it('handles lines without data: prefix', () => {
      const cb = createCallbacks()
      parseSSEChunk('event: message\nid: 123\nretry: 5000\n', cb)

      expect(cb.deltas).toEqual([])
    })

    it('skips malformed JSON gracefully', () => {
      const cb = createCallbacks()
      parseSSEChunk('data: {invalid json}\ndata: {"type":"text-delta","delta":"ok"}\n', cb)

      expect(cb.deltas).toEqual(['ok'])
    })

    it('handles data: [DONE] terminator', () => {
      const cb = createCallbacks()
      parseSSEChunk('data: [DONE]\n', cb)

      expect(cb.deltas).toEqual([])
      expect(cb.errors).toEqual([])
    })

    it('handles text-delta with undefined delta field', () => {
      const cb = createCallbacks()
      parseSSEChunk('data: {"type":"text-delta"}\n', cb)

      // delta is undefined, so accumulated content gets "undefined" string
      expect(cb.deltas).toEqual([undefined])
    })
  })
})

// ============================================================================
// Tests: consumeSSEStream (full streaming round-trip)
// ============================================================================

describe('consumeSSEStream', () => {
  it('accumulates text from AI SDK v6 stream', async () => {
    const stream = stringToStream(AI_SDK_V6_STREAM)
    const cb = createCallbacks()
    const result = await consumeSSEStream(stream, cb)

    expect(result).toBe('Hello from Gemini')
  })

  it('accumulates text from mock format', async () => {
    const stream = stringToStream(MOCK_STREAM_FORMAT)
    const cb = createCallbacks()
    const result = await consumeSSEStream(stream, cb)

    expect(result).toBe('Hello there!')
  })

  it('returns empty string for empty model response', async () => {
    const stream = stringToStream(AI_SDK_V6_EMPTY_RESPONSE)
    const cb = createCallbacks()
    const result = await consumeSSEStream(stream, cb)

    expect(result).toBe('')
  })

  it('handles byte-by-byte streaming (worst-case chunking)', async () => {
    const stream = byteByByteStream(AI_SDK_V6_STREAM)
    const cb = createCallbacks()
    const result = await consumeSSEStream(stream, cb)

    expect(result).toBe('Hello from Gemini')
  })

  it('accumulates text around tool calls', async () => {
    const stream = stringToStream(AI_SDK_V6_TOOL_STREAM)
    const cb = createCallbacks()
    const result = await consumeSSEStream(stream, cb)

    expect(result).toBe('Let me checkHere are the tasks.')
  })

  it('reports errors from stream', async () => {
    const stream = stringToStream(AI_SDK_V6_ERROR_STREAM)
    const cb = createCallbacks()
    await consumeSSEStream(stream, cb)

    expect(cb.errors).toEqual(['Model returned an error'])
  })

  describe('chunked delivery', () => {
    it('handles data split across chunks', async () => {
      // Simulate the stream being split in the middle of a data line
      const encoder = new TextEncoder()
      const fullText = AI_SDK_V6_STREAM
      const midpoint = Math.floor(fullText.length / 2)
      const chunk1 = fullText.slice(0, midpoint)
      const chunk2 = fullText.slice(midpoint)

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(chunk1))
          controller.enqueue(encoder.encode(chunk2))
          controller.close()
        },
      })

      const cb = createCallbacks()
      const result = await consumeSSEStream(stream, cb)

      expect(result).toBe('Hello from Gemini')
    })
  })
})

// ============================================================================
// Tests: Integration test mock accuracy
// ============================================================================

describe('integration test mock accuracy', () => {
  it('existing mock (createMockStreamResponse) format matches what parseSSEChunk expects', () => {
    // This passes — proving the mock is self-consistent
    const cb = createCallbacks()
    parseSSEChunk(MOCK_STREAM_FORMAT, cb)
    expect(cb.deltas.join('')).toBe('Hello there!')
  })

  it('real AI SDK v6 format ALSO works with parseSSEChunk', () => {
    // If this fails, the stream format is the root cause of "no response"
    const cb = createCallbacks()
    parseSSEChunk(AI_SDK_V6_STREAM, cb)
    expect(cb.deltas.join('')).toBe('Hello from Gemini')
  })

  it('mock format lacks start/text-start/text-end/finish events that real SDK sends', () => {
    // This highlights that the mock is a simplified version,
    // which could mask issues with event ordering or state management
    const mockCb = createCallbacks()
    parseSSEChunk(MOCK_STREAM_FORMAT, mockCb)

    const realCb = createCallbacks()
    parseSSEChunk(AI_SDK_V6_STREAM, realCb)

    // Both produce text deltas, but only because the parser ignores unknown types.
    // The real stream has 8 events, mock has 4.
    const mockEventCount = MOCK_STREAM_FORMAT.split('\n').filter((l) => l.startsWith('data: ')).length
    const realEventCount = AI_SDK_V6_STREAM.split('\n').filter((l) => l.startsWith('data: ')).length

    expect(mockEventCount).toBe(4) // 3 text-delta + DONE
    expect(realEventCount).toBe(8) // start + text-start + 3 text-delta + text-end + finish + DONE
  })

  it('tool-call events use different type names in SDK vs frontend parser', () => {
    // This IS a real discrepancy: the frontend expects "tool-input-start"
    // but the SDK sends "tool-call-start". Tool indicators won't show in UI.
    const cb = createCallbacks()
    parseSSEChunk(AI_SDK_V6_TOOL_STREAM, cb)

    // No tools detected despite tool events in the stream
    expect(cb.tools).toEqual([])
  })
})
