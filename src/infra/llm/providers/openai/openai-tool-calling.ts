/**
 * OpenAI Tool Calling Provider
 *
 * Extends the OpenAI provider with tool calling support for MCP integration.
 * Enables the admin chat to query the database using natural language.
 *
 * @fileType provider-extension
 * @domain ai
 * @pattern tool-calling, function-calling, mcp-integration
 */
import { createErrorClassifier, LLM_DEFAULTS, withRetry } from '@/infra/llm/providers/shared'
import { logger } from '@/infra/utils/logger'
import type { MCPTool } from '@/server/repos/mcp/client/types'
import type { Payload } from 'payload'
import { getOpenAIClient } from './openai.client'
import {
  extractTextFromOpenAIResponse,
  extractToolCalls,
  mapMessagesToOpenAIFormat,
  mcpToolsToOpenAIFunctions,
  type ChatMessage,
  type OpenAIRole,
} from './openai.mapper'
import type { AIModel, GenerateChatOutput } from './openai.provider'

// Provider identification for logging
const PROVIDER_NAME = 'openai-compatible'
const PROVIDER_VERSION = '1.0'

// Error classifier for OpenAI
const { isRetryable: isRetryableError, wrapError: wrapOpenAIError } =
  createErrorClassifier('openai')

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolCallingInput {
  system: string
  messages: ChatMessage[]
  model: AIModel
  acknowledgment?: string
  tools: MCPTool[]
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>
  timeoutMs?: number
}

export interface ToolCallingOutput extends GenerateChatOutput {
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TOOL_ITERATIONS = 5 // Prevent infinite loops

// ─────────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a chat completion with tool calling support
 *
 * Features:
 * - Converts MCP tools to OpenAI function tools
 * - Executes tool calls and returns results to the model
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
  const timeoutMs = input.timeoutMs ?? LLM_DEFAULTS.toolTimeoutMs

  return withRetry<ToolCallingOutput, Error>(
    () => executeToolCallingWithTimeout(input, timeoutMs, payload),
    {
      maxRetries: LLM_DEFAULTS.maxRetries,
      delayMs: LLM_DEFAULTS.retryDelayMs,
      isRetryable: isRetryableError,
      wrapError: (e: Error) => wrapOpenAIError(e),
      logPrefix: '[OpenAIToolCalling]',
      onRetry: (error: Error, attempt: number) => {
        logger.warn(
          { err: error, attempt, retrying: true },
          '[OpenAIToolCalling] Retrying after error',
        )
      },
    },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Implementation
// ─────────────────────────────────────────────────────────────────────────────

async function executeToolCallingWithTimeout(
  input: ToolCallingInput,
  timeoutMs: number,
  payload: Payload,
): Promise<ToolCallingOutput> {
  const client = await getOpenAIClient(payload)

  // Convert MCP tools to OpenAI function tools with required name field
  // OpenAI requires parameters with at least { type: 'object' }
  const functions: Array<{
    type: 'function'
    function: { name: string; description: string; parameters: Record<string, unknown> }
  }> = mcpToolsToOpenAIFunctions(input.tools)
    .map((f, index) => {
      const tool = input.tools[index]
      const functionDef = {
        name: tool?.name || `function_${index}`,
        description: tool?.description || 'A tool function',
      }

      // Always include parameters - OpenAI requires it
      const parameters =
        Object.keys(f.properties).length > 0 ? f : { type: 'object' as const, properties: {} }

      return {
        type: 'function' as const,
        function: {
          ...functionDef,
          parameters,
        },
      }
    })
    .filter((f) => {
      // Filter out tools without input schema
      const hasInputSchema = input.tools.find((t) => t.name === f.function.name)?.inputSchema
      if (!hasInputSchema) {
        logger.debug(
          { toolName: f.function.name },
          '[OpenAIToolCalling] Filtering out tool without inputSchema',
        )
        return false
      }
      return true
    })

  logger.debug(
    {
      inputToolCount: input.tools.length,
      allowedToolCount: functions.length,
      inputToolNames: input.tools.map((t) => t.name),
    },
    '[OpenAIToolCalling] Tools loaded and converted',
  )

  if (functions.length === 0) {
    logger.warn(
      { inputTools: input.tools.map((t) => t.name) },
      '[OpenAIToolCalling] No valid tools after schema validation!',
    )
  }

  // Build messages array
  const allMessages: ChatMessage[] = [{ role: 'system', content: input.system }, ...input.messages]

  const messages = mapMessagesToOpenAIFormat(allMessages)

  // Log provider details for the tool calling request
  logger.info(
    {
      provider: PROVIDER_NAME,
      providerVersion: PROVIDER_VERSION,
      model: input.model.name,
      temperature: input.model.temperature,
      maxOutputTokens: input.model.maxOutputTokens,
      capabilities: input.model.capabilities ?? [],
      toolCount: functions.length,
      messageCount: messages.length,
      timeoutMs,
      currentMessagePreview: allMessages[allMessages.length - 1]?.content?.substring(0, 100) ?? '',
    },
    '[OpenAIToolCalling] Tool calling request',
  )

  const startTime = Date.now()

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutError = new Error(`Tool calling request timed out after ${timeoutMs}ms`)
    timeoutError.name = 'TimeoutError'
    setTimeout(() => reject(timeoutError), timeoutMs)
  })

  // Initial chat completion request
  const completionPromise = client.chat.completions.create({
    model: input.model.name,
    messages,
    temperature: input.model.temperature,
    max_tokens: input.model.maxOutputTokens,
    tools: functions.length > 0 ? functions : undefined,
  })

  let completion = (await Promise.race([completionPromise, timeoutPromise])) as {
    choices: Array<{
      message: {
        content: string | null
        tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
      }
    }>
  }

  // Check for tool calls and execute them
  const allToolCalls: Array<{ name: string; args: Record<string, unknown> }> = []

  let toolCalls = extractToolCalls(completion)
  let iterations = 0

  // Accumulate conversation history including tool results and assistant responses
  // Use type assertion to satisfy OpenAI SDK's ChatCompletionMessageParam union types
  const conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool'
    content?: string
    tool_call_id?: string
    name?: string
  }> = [...messages] as Array<{
    role: 'system' | 'user' | 'assistant' | 'tool'
    content?: string
    tool_call_id?: string
    name?: string
  }>

  logger.debug(
    {
      hasToolCalls: toolCalls.length > 0,
      count: toolCalls.length,
      initialText: extractTextFromOpenAIResponse(completion).substring(0, 200),
    },
    '[OpenAIToolCalling] Initial response received',
  )

  while (toolCalls.length > 0) {
    iterations++

    // Prevent infinite loops
    if (iterations > MAX_TOOL_ITERATIONS) {
      logger.warn('[OpenAIToolCalling] Max tool iterations reached, stopping')
      break
    }

    // Get the current batch of tool calls from this completion
    const currentToolCalls = [...toolCalls]
    const assistantResponse = completion.choices[0]?.message

    // Add assistant message with ALL tool calls to history once
    if (assistantResponse) {
      const assistantMessage: {
        role: 'assistant'
        content?: string
        tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
      } = {
        role: 'assistant',
      }
      if (assistantResponse.content !== null) {
        assistantMessage.content = assistantResponse.content || undefined
      }
      if (assistantResponse.tool_calls && assistantResponse.tool_calls.length > 0) {
        assistantMessage.tool_calls = assistantResponse.tool_calls
      }
      conversationHistory.push(assistantMessage)
    }

    // Execute ALL tool calls in this batch first, collecting results
    const toolResults: Array<{
      role: OpenAIRole
      tool_call_id: string
      name: string
      content: string
    }> = []

    for (const call of currentToolCalls) {
      allToolCalls.push({ name: call.name, args: call.arguments })

      logger.debug(
        { toolName: call.name, callId: call.id, args: call.arguments },
        '[OpenAIToolCalling] Executing tool call',
      )

      try {
        const resultText = await input.toolExecutor(call.name, call.arguments)

        logger.debug(
          { toolName: call.name, resultLength: resultText.length },
          '[OpenAIToolCalling] Tool execution completed',
        )

        toolResults.push({
          role: 'tool' as OpenAIRole,
          tool_call_id: call.id,
          name: call.name,
          content: resultText,
        })
      } catch (error) {
        logger.error(
          { err: error, toolName: call.name, callId: call.id },
          '[OpenAIToolCalling] Tool execution failed',
        )

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        toolResults.push({
          role: 'tool' as OpenAIRole,
          tool_call_id: call.id,
          name: call.name,
          content: `Error: ${errorMessage}`,
        })
      }
    }

    // Add ALL tool results to conversation history
    conversationHistory.push(...toolResults)

    // Get the next completion with full conversation history
    const nextCompletionPromise = client.chat.completions.create({
      model: input.model.name,
      messages: conversationHistory as any,
      temperature: input.model.temperature,
      max_tokens: input.model.maxOutputTokens,
      tools: functions.length > 0 ? functions : undefined,
    })

    completion = (await Promise.race([nextCompletionPromise, timeoutPromise])) as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
      }>
    }

    // Check if more tool calls
    toolCalls = extractToolCalls(completion)

    logger.debug(
      { newToolCallCount: toolCalls.length },
      '[OpenAIToolCalling] Checked for new tool calls',
    )
  }

  // Get final text response
  const text = extractTextFromOpenAIResponse(completion)
  const processingTimeMs = Date.now() - startTime

  // Log successful completion
  logger.info(
    {
      provider: PROVIDER_NAME,
      providerVersion: PROVIDER_VERSION,
      model: input.model.name,
      processingTimeMs,
      responseLength: text.length,
      toolCallCount: allToolCalls.length,
    },
    '[OpenAIToolCalling] Tool calling completed',
  )

  return {
    text,
    raw: completion,
    toolCalls: allToolCalls,
  }
}
