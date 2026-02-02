/**
 * Gemini Tool Calling Provider
 *
 * Extends the Gemini provider with tool calling support for MCP integration.
 * Enables the admin chat to query the database using natural language.
 *
 * @fileType provider-extension
 * @domain ai
 * @pattern tool-calling, function-calling, mcp-integration
 */
import { logger } from '@/infra/utils/logger'
import { getGeminiClient } from '@/server/llm/gemini.client'
import type { MCPTool } from '@/server/repos/mcp/client/types'
import type { Tool as GeminiTool } from '@google/generative-ai'
import type { Payload } from 'payload'
import { mcpToolsToGeminiFunctionDeclarations, type ParsedToolCall } from './gemini-tools'
import { isRetryableError, wrapGeminiError } from './gemini.errors'
import { extractResponseText, mapMessagesToGeminiHistory } from './gemini.mapper'
import type { AIModel, ChatMessage, GenerateChatOutput } from './gemini.provider'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolCallingInput {
  system: string
  messages: ChatMessage[]
  model: AIModel
  acknowledgment: string
  tools: MCPTool[]
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>
  timeoutMs?: number
}

export interface ToolCallingOutput extends GenerateChatOutput {
  toolCalls?: ParsedToolCall[]
}

interface ToolCallResponse {
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>
  response?: { text: () => string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 60_000 // Longer timeout for tool calling
const MAX_TOOL_ITERATIONS = 5 // Prevent infinite loops

// ─────────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a chat completion with tool calling support
 *
 * Features:
 * - Converts MCP tools to Gemini function declarations
 * - Executes tool calls and returns results to Gemini
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Loop detection to prevent infinite tool calls
 *
 * @param input - Chat input with tools and executor function
 * @param payload - Payload instance for config access
 * @returns Chat output with response text and any tool calls made
 */
export async function generateChatCompletionWithTools(
  input: ToolCallingInput,
  payload: Payload,
): Promise<ToolCallingOutput> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      return await executeToolCallingWithTimeout(input, timeoutMs, payload)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const geminiError = wrapGeminiError(lastError)

      // Don't retry non-retryable errors
      if (!isRetryableError(lastError)) {
        logger.error({ err: lastError, attempt }, '[GeminiToolCalling] Non-retryable error')
        throw geminiError
      }

      // Retry with exponential backoff
      if (attempt < 2) {
        const delay = 1000 * Math.pow(2, attempt)
        logger.warn(
          { err: lastError, attempt, delay, retrying: true },
          '[GeminiToolCalling] Retrying after error',
        )
        await sleep(delay)
      }
    }
  }

  logger.error({ err: lastError }, '[GeminiToolCalling] All retries exhausted')
  throw wrapGeminiError(lastError ?? new Error('Unknown error'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Implementation
// ─────────────────────────────────────────────────────────────────────────────

async function executeToolCallingWithTimeout(
  input: ToolCallingInput,
  timeoutMs: number,
  payload: Payload,
): Promise<ToolCallingOutput> {
  const client = await getGeminiClient(payload)

  // Convert MCP tools to Gemini function declarations
  const functionDeclarations = mcpToolsToGeminiFunctionDeclarations(input.tools)

  logger.debug(
    { toolCount: functionDeclarations.length, tools: functionDeclarations.map((t) => t.name) },
    '[GeminiToolCalling] Converted tools to function declarations',
  )

  const model = client.getGenerativeModel({
    model: input.model.name,
    generationConfig: {
      temperature: input.model.temperature,
      maxOutputTokens: input.model.maxOutputTokens,
    },
    // Cast to Gemini Tool type via unknown
    tools:
      functionDeclarations.length > 0
        ? ([{ functionDeclarations }] as unknown as GeminiTool[])
        : undefined,
  })

  // Build messages array
  const allMessages: ChatMessage[] = [{ role: 'system', content: input.system }, ...input.messages]

  // Get the current user message
  const userMessages = input.messages.filter((m) => m.role === 'user')
  const currentMessage =
    userMessages.length > 0 ? userMessages[userMessages.length - 1].content : ''

  // Map to Gemini format
  const { history, currentMessage: finalMessage } = mapMessagesToGeminiHistory(
    allMessages,
    currentMessage,
    input.acknowledgment,
  )

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Tool calling request timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  // Start chat with tools
  const chat = model.startChat({ history })

  // Execute the first turn
  const initialResult = (await Promise.race([
    chat.sendMessage(finalMessage),
    timeoutPromise,
  ])) as ToolCallResponse

  // Check for tool calls and execute them
  const allToolCalls: ParsedToolCall[] = []

  let currentResponse = initialResult
  let iterations = 0

  while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0) {
    iterations++

    // Prevent infinite loops
    if (iterations > MAX_TOOL_ITERATIONS) {
      logger.warn('[GeminiToolCalling] Max tool iterations reached, stopping')
      break
    }

    // Execute each tool call
    for (const call of currentResponse.functionCalls) {
      const toolCall: ParsedToolCall = {
        name: call.name,
        args: call.args || {},
      }
      allToolCalls.push(toolCall)

      logger.debug(
        { toolName: toolCall.name, args: toolCall.args },
        '[GeminiToolCalling] Executing tool call',
      )

      try {
        const resultText = await input.toolExecutor(toolCall.name, toolCall.args)

        // Send tool result back to Gemini
        const functionResponse = { result: resultText }
        const result = await Promise.race([
          chat.sendMessage(JSON.stringify([{ functionResponse }])),
          timeoutPromise,
        ])

        // Check if more tool calls
        currentResponse = result as ToolCallResponse
      } catch (error) {
        logger.error(
          { err: error, toolName: toolCall.name },
          '[GeminiToolCalling] Tool execution failed',
        )

        // Send error result
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const functionResponse = { error: errorMessage }
        await Promise.race([
          chat.sendMessage(JSON.stringify([{ functionResponse }])),
          timeoutPromise,
        ])

        // Break out of loop on error
        break
      }
    }
  }

  // Get final text response
  const response = currentResponse.response || initialResult.response
  const text = response ? extractResponseText(response) : ''

  logger.debug(
    { textLength: text.length, toolCallCount: allToolCalls.length },
    '[GeminiToolCalling] Tool calling completed',
  )

  return {
    text,
    raw: currentResponse,
    toolCalls: allToolCalls,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
