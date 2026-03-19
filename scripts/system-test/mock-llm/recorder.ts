/**
 * @fileType utility
 * @domain cody | system-test | mock-llm
 * @ai-summary Record mode - proxies to real API and saves responses
 */

import * as fs from 'fs'
import * as path from 'path'
import type {
  RecordedCall,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ErrorResponse,
} from './types.js'

export interface RecorderOptions {
  recordingsDir: string
  upstreamUrl: string
  apiKey: string
  timeout?: number
}

export interface Recorder {
  /**
   * Get current stats
   */
  getStats(): { callCount: number }

  /**
   * Record a request: forward to upstream, save response, return response
   */
  record(request: { body: unknown }): Promise<ChatCompletionResponse | ErrorResponse>

  /**
   * Save metadata and cleanup
   */
  shutdown(): Promise<void>
}

export function createRecorder(options: RecorderOptions): Recorder {
  const { recordingsDir, upstreamUrl, apiKey, timeout = 120000 } = options
  let callCount = 0

  // Ensure recordings directory exists
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true })
  }

  return {
    getStats(): { callCount: number } {
      return { callCount }
    },

    async record(request: {
      method: string
      headers: Record<string, string>
      body: unknown
    }): Promise<ChatCompletionResponse | ErrorResponse> {
      const currentIndex = callCount
      callCount++

      const requestModel = (request.body as ChatCompletionRequest)?.model || 'unknown'
      console.log(
        `[mock-llm] RECORD #${currentIndex + 1} POST /v1/chat/completions model=${requestModel}`,
      )

      const timestamp = new Date().toISOString()

      try {
        // Forward request to upstream
        const upstreamResponse = await fetch(upstreamUrl + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(request.body),
          signal: AbortSignal.timeout(timeout),
        })

        const contentType = upstreamResponse.headers.get('content-type') || ''
        let responseBody: unknown

        // Handle SSE streaming responses
        if (contentType.includes('text/event-stream')) {
          responseBody = await assembleSSE(upstreamResponse)
        } else {
          responseBody = await upstreamResponse.json()
        }

        // Build recorded call
        const recordedCall: RecordedCall = {
          index: currentIndex,
          timestamp,
          request: {
            method: request.method,
            path: '/v1/chat/completions',
            headers: sanitizeHeaders(request.headers as Record<string, string>),
            body: request.body,
          },
          response: {
            status: upstreamResponse.status,
            headers: (() => {
              const headers: Record<string, string> = {}
              upstreamResponse.headers.forEach((value, key) => {
                headers[key] = value
              })
              return sanitizeHeaders(headers)
            })(),
            body: responseBody,
          },
        }

        // Save to file (padded index for sorting)
        const fileName = String(currentIndex).padStart(3, '0') + '.json'
        const filePath = path.join(recordingsDir, fileName)
        fs.writeFileSync(filePath, JSON.stringify(recordedCall, null, 2))

        console.log(`[mock-llm] Saved recording #${currentIndex + 1} to ${fileName}`)

        // Return the response to the client
        return responseBody as ChatCompletionResponse
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'

        // If upstream is unreachable, return 502
        const errorResponse: ErrorResponse = {
          error: {
            message: `Upstream error: ${errorMessage}`,
            type: 'upstream_error',
          },
        }

        // Still save the error response for debugging
        const recordedCall: RecordedCall = {
          index: currentIndex,
          timestamp,
          request: {
            method: request.method,
            path: '/v1/chat/completions',
            headers: sanitizeHeaders(request.headers as Record<string, string>),
            body: request.body,
          },
          response: {
            status: 502,
            headers: { 'content-type': 'application/json' },
            body: errorResponse,
          },
        }

        const fileName = String(currentIndex).padStart(3, '0') + '.json'
        const filePath = path.join(recordingsDir, fileName)
        fs.writeFileSync(filePath, JSON.stringify(recordedCall, null, 2))

        console.error(`[mock-llm] ERROR recording #${currentIndex + 1}: ${errorMessage}`)

        return errorResponse
      }
    },

    async shutdown(): Promise<void> {
      // Save metadata
      const metadata = {
        recordedAt: new Date().toISOString(),
        totalCalls: callCount,
        upstreamUrl,
      }

      const metadataPath = path.join(recordingsDir, 'metadata.json')
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

      console.log(`[mock-llm] Saved metadata: ${callCount} calls recorded`)
    },
  }
}

/**
 * Assemble SSE streaming response into a single JSON response
 */
async function assembleSSE(response: Response): Promise<ChatCompletionResponse> {
  const text = await response.text()
  const lines = text.split('\n')

  let fullContent = ''
  let finishReason: 'stop' | 'length' = 'stop'
  let totalTokens = 0
  let promptTokens = 0
  let completionTokens = 0

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue

    const data = line.slice(6).trim()
    if (data === '[DONE]') continue

    try {
      const parsed = JSON.parse(data)

      // Accumulate content
      if (parsed.choices?.[0]?.delta?.content) {
        fullContent += parsed.choices[0].delta.content
      }

      // Get finish reason
      if (parsed.choices?.[0]?.finish_reason) {
        finishReason = parsed.choices[0].finish_reason
      }

      // Get usage if available
      if (parsed.usage) {
        promptTokens = parsed.usage.prompt_tokens || 0
        completionTokens = parsed.usage.completion_tokens || 0
        totalTokens = parsed.usage.total_tokens || 0
      }
    } catch {
      // Skip invalid JSON
    }
  }

  // Build the non-streaming response
  return {
    id: `chatcmpl-${generateId()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'llama-3.3-70b-versatile', // Default, can be extracted from first event
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: fullContent,
        },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens || fullContent.length, // Fallback
    },
  }
}

/**
 * Sanitize headers - remove sensitive data
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized = { ...headers }
  if (sanitized.authorization) {
    sanitized.authorization = '[REDACTED]'
  }
  return sanitized
}

/**
 * Generate a random ID similar to OpenAI's format
 */
function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
