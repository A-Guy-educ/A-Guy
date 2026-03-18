/**
 * @fileType utility
 * @domain cody | system-test | mock-llm
 * @ai-summary Shared type definitions for the LLM mock tool
 */

export type Mode = 'record' | 'replay'

export interface MockLLMConfig {
  mode: Mode
  port: number
  recordingsDir: string
  upstreamUrl?: string // Required for record mode
  apiKey?: string // For record mode upstream auth
  timeout?: number // Upstream timeout in ms (default: 120000)
}

export interface RecordedCall {
  index: number
  timestamp: string
  request: {
    method: string
    path: string
    headers: Record<string, string>
    body: unknown
  }
  response: {
    status: number
    headers: Record<string, string>
    body: unknown
  }
}

export interface ScenarioMetadata {
  scenario: string
  recordedAt: string
  upstreamUrl: string
  model: string
  totalCalls: number
}

export interface ServerStats {
  mode: Mode
  callCount: number
  totalRecordings: number
  startTime: string
}

export interface ChatCompletionRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: 'stop' | 'length'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ErrorResponse {
  error: {
    message: string
    type: string
    code?: string
  }
}
