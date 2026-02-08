/**
 * SSE Helper Utilities
 * Pure utility functions for Server-Sent Events formatting
 */

/**
 * SSE event types
 */
export type SSEEventType = 'chunk' | 'done' | 'error'

/**
 * SSE message structure
 */
export interface SSEMessage<T = unknown> {
  event: SSEEventType
  data: T
}

/**
 * Format an SSE message as Uint8Array
 * Format: event: <event>\ndata: <JSON data>\n\n
 */
export function formatSSEMessage(event: SSEEventType, data: unknown): Uint8Array {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  return new TextEncoder().encode(message)
}

/**
 * Format an SSE chunk event with partial text
 */
export function formatChunkEvent(text: string): Uint8Array {
  return formatSSEMessage('chunk', { text })
}

/**
 * Format an SSE done event with metadata
 */
export interface SSEDoneEventData {
  conversationId: string
  contextKey: string
}

export function formatDoneEvent(data: SSEDoneEventData): Uint8Array {
  return formatSSEMessage('done', data)
}

/**
 * Format an SSE error event
 */
export interface SSEErrorEventData {
  error: string
  code: string
}

export function formatErrorEvent(error: string, code: string = 'UNKNOWN_ERROR'): Uint8Array {
  return formatSSEMessage('error', { error, code })
}

/**
 * Create SSE response headers
 */
export function createSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  }
}

/**
 * Parse SSE event line (e.g., "event: chunk" or "data: {...}")
 */
export function parseSSEventLine(
  line: string,
): { type: 'event' | 'data' | 'id' | 'retry'; value: string } | null {
  const eventMatch = line.match(/^event:\s*(.+)$/)
  if (eventMatch) {
    return { type: 'event', value: eventMatch[1].trim() }
  }

  const dataMatch = line.match(/^data:\s*(.+)$/)
  if (dataMatch) {
    return { type: 'data', value: dataMatch[1].trim() }
  }

  const idMatch = line.match(/^id:\s*(.+)$/)
  if (idMatch) {
    return { type: 'id', value: idMatch[1].trim() }
  }

  const retryMatch = line.match(/^retry:\s*(.+)$/)
  if (retryMatch) {
    return { type: 'retry', value: retryMatch[1] }
  }

  return null
}

/**
 * Parse raw SSE data into events
 */
export interface ParsedSSEEvent {
  event: SSEEventType | null
  data: unknown
}

export function parseSSEData(rawData: string): ParsedSSEEvent[] {
  const events: ParsedSSEEvent[] = []
  const lines = rawData.split('\n')
  let currentEvent: SSEEventType | null = null
  let currentData: string[] = []

  for (const line of lines) {
    const parsed = parseSSEventLine(line)

    if (parsed === null) {
      // Empty line or comment
      if (line === '' && currentEvent !== null) {
        try {
          events.push({
            event: currentEvent,
            data: JSON.parse(currentData.join('\n')),
          })
        } catch {
          // Invalid JSON, skip
        }
        currentEvent = null
        currentData = []
      }
      continue
    }

    if (parsed.type === 'event') {
      currentEvent = parsed.value as SSEEventType
    } else if (parsed.type === 'data') {
      currentData.push(parsed.value)
    }
  }

  return events
}
