/**
 * Student Tool-Calling Helper
 *
 * Provides reusable tool-calling functionality for student chat sessions.
 * Enables AI to use context-grounding tools like getActiveExerciseContext.
 *
 * @fileType helper
 * @domain ai
 * @pattern tool-calling, student-context, mcp-integration
 *
 * Used by:
 * - Exercise chat endpoint for student tool-calling
 * - Streaming exercise chat endpoint
 */
import { logger } from '@/infra/utils/logger'
import type { UnifiedLLMProvider } from '@/infra/llm/providers/factory'
import type { Payload } from 'payload'
import type { MCPClient } from '@/server/repos/mcp/client/mcp-client'
import { validateStudentToolArgs } from '@/server/repos/mcp/validation/student-tool-validator'

/**
 * Tool definition for student chat
 */
export interface StudentChatTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/**
 * Result from tool-calling chat completion
 */
export interface StudentToolCallingResult {
  text: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  raw?: unknown
}

/**
 * Result from streaming tool-calling chat completion
 */
export interface StudentStreamingResult {
  stream: AsyncIterable<{ text: string }>
  response: Promise<{
    text: string
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  }>
}

/**
 * Request context for student tool validation
 */
export interface StudentToolRequestContext {
  /** The active exercise ID from the chat request */
  exerciseId?: string
}

/**
 * Build the tool executor function for MCP tool calls
 *
 * @param mcpClient - MCP client instance for tool execution
 * @param authHeaders - Authentication headers for MCP requests
 * @param logger_ - Logger instance for debugging
 * @param requestContext - Request context for validation (e.g., active exercise ID)
 * @returns Tool executor function that validates args before calling MCP
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildStudentToolExecutor(
  mcpClient: MCPClient,
  authHeaders: Record<string, string>,
  logger_: any,
  requestContext: StudentToolRequestContext,
): (toolName: string, args: Record<string, unknown>) => Promise<string> {
  return async (toolName: string, args: Record<string, unknown>) => {
    logger_.debug({ toolName, args }, 'Validating student MCP tool call')
    try {
      // Validate tool args against request context before executing
      validateStudentToolArgs(toolName, args, requestContext)

      logger_.debug({ toolName, args }, 'Executing student MCP tool')
      const toolResult = await mcpClient.callTool(toolName, args, authHeaders)
      const content = toolResult.content
      if (Array.isArray(content)) {
        return content.map((c) => (c as { text?: string }).text).join('\n')
      }
      return JSON.stringify(content)
    } catch (error) {
      logger_.error({ err: error, toolName, args }, 'Student tool execution failed')
      return `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Execute non-streaming chat completion with tools for student context
 *
 * @param provider - LLM provider instance
 * @param payload - Payload instance
 * @param systemPrompt - System prompt for the conversation
 * @param messages - Conversation messages
 * @param tools - Available tools for the AI to use
 * @param toolExecutor - Function to execute tools
 * @returns Chat completion result with text and tool calls
 */
export async function chatWithStudentTools(
  provider: UnifiedLLMProvider,
  payload: Payload,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  tools: StudentChatTool[],
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>,
): Promise<StudentToolCallingResult> {
  const reqLogger = logger.child({ operation: 'student-tool-calling' })

  // Get model config for EXERCISE_CHAT
  const { getProviderModelConfig } = await import('@/infra/llm/providers/factory')
  const modelConfig = await getProviderModelConfig(
    (await import('@/infra/llm/providers/factory')).LLMProviderType.GEMINI,
    'EXERCISE_CHAT',
  )

  reqLogger.debug({ toolCount: tools.length }, 'Executing student chat with tools')

  const result = await provider.generateChatCompletionWithTools(
    {
      system: systemPrompt,
      messages,
      model: modelConfig,
      acknowledgment: 'Understood.',
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
      toolExecutor,
    },
    payload,
  )

  reqLogger.debug({ textLength: result.text.length }, 'Student chat with tools completed')

  return {
    text: result.text,
    toolCalls: result.toolCalls,
    raw: result.raw,
  }
}

/**
 * Execute streaming chat completion with tools for student context
 *
 * @param provider - LLM provider instance
 * @param payload - Payload instance
 * @param systemPrompt - System prompt for the conversation
 * @param messages - Conversation messages
 * @param tools - Available tools for the AI to use
 * @param toolExecutor - Function to execute tools
 * @returns Streaming result with stream and response promise
 */
export async function streamingChatWithStudentTools(
  provider: UnifiedLLMProvider,
  payload: Payload,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  tools: StudentChatTool[],
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>,
): Promise<StudentStreamingResult> {
  const reqLogger = logger.child({ operation: 'student-tool-calling-streaming' })

  // Get model config for EXERCISE_CHAT
  const { getProviderModelConfig } = await import('@/infra/llm/providers/factory')
  const modelConfig = await getProviderModelConfig(
    (await import('@/infra/llm/providers/factory')).LLMProviderType.GEMINI,
    'EXERCISE_CHAT',
  )

  reqLogger.debug({ toolCount: tools.length }, 'Executing streaming student chat with tools')

  // Check if streaming with tools is supported
  if (provider.generateStreamingChatCompletionWithTools) {
    const result = await provider.generateStreamingChatCompletionWithTools(
      {
        system: systemPrompt,
        messages,
        model: modelConfig,
        acknowledgment: 'Understood.',
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
        toolExecutor,
      },
      payload,
    )

    reqLogger.debug({}, 'Streaming student chat with tools initiated')
    return result
  }

  // Fallback: Use non-streaming with tools
  reqLogger.warn({}, 'Streaming with tools not supported, falling back to non-streaming')

  const nonStreamingResult = await provider.generateChatCompletionWithTools(
    {
      system: systemPrompt,
      messages,
      model: modelConfig,
      acknowledgment: 'Understood.',
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
      toolExecutor,
    },
    payload,
  )

  // Wrap non-streaming result as a streaming-like response
  return {
    stream: {
      [Symbol.asyncIterator]: () => {
        let done = false
        return {
          async next() {
            if (done) return { done: true, value: undefined }
            done = true
            return { done: false, value: { text: nonStreamingResult.text } }
          },
        }
      },
    },
    response: Promise.resolve({
      text: nonStreamingResult.text,
      toolCalls: nonStreamingResult.toolCalls,
    }),
  }
}

/**
 * Student-specific tools configuration
 * Defines which tools are available to students during chat
 */
export const STUDENT_CHAT_TOOLS: StudentChatTool[] = [
  {
    name: 'getActiveExerciseContext',
    description:
      'Fetch the exercise content currently displayed to the student. Returns the exercise title, blocks (prompts, questions, options) with answer keys removed. Use this to understand what the student is looking at and help them with their questions.',
    inputSchema: {
      type: 'object',
      properties: {
        exerciseId: {
          type: 'string',
          description: 'The ID of the exercise to fetch context for',
        },
        activeBlockId: {
          type: 'string',
          description: 'Optional ID of the specific block the student is currently working on',
        },
      },
      required: ['exerciseId'],
    },
  },
]
