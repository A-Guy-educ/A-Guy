/**
 * Genkit Tools Module
 * Provides tool calling abstraction for Genkit with MCP integration
 *
 * @fileType module
 * @domain ai
 * @pattern genkit-tools, tool-calling, mcp-integration
 */
import { logger } from '@/infra/utils/logger'
import type { Genkit } from 'genkit'

/**
 * Tool definition for Genkit
 */
export interface GenkitToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Tool executor function type
 */
export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>

/**
 * Tool calling result from Genkit
 */
export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

/**
 * Map MCP tools to Genkit tool definitions
 * @param mcpTools - Array of MCP tool definitions
 * @returns Array of Genkit-compatible tool definitions
 */
export function mapMCPToolsToGenkit(
  mcpTools: Array<{
    name: string
    description?: string
    inputSchema?: Record<string, unknown>
  }>,
): GenkitToolDefinition[] {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || `Execute ${tool.name}`,
    inputSchema: {
      type: 'object' as const,
      properties: (tool.inputSchema as Record<string, unknown>) || {},
      required: [],
    },
  }))
}

/**
 * Execute tools using the provided executor
 * @param calls - Array of tool calls from Genkit
 * @param executor - Function to execute tools
 * @returns Map of tool name to result
 */
export async function executeToolCalls(
  calls: ToolCall[],
  executor: ToolExecutor,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}

  for (const call of calls) {
    try {
      logger.debug({ toolName: call.name, args: call.args }, 'Executing tool call')
      const result = await executor(call.name, call.args)
      results[call.name] = result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ toolName: call.name, error: errorMessage }, 'Tool execution failed')
      results[call.name] = `Error: ${errorMessage}`
    }
  }

  return results
}

/**
 * Create a Genkit prompt with tools
 * @param tools - Array of Genkit tool definitions
 * @returns Formatted tool string for prompt
 */
export function formatToolsForPrompt(tools: GenkitToolDefinition[]): string {
  if (tools.length === 0) {
    return ''
  }

  const toolDescriptions = tools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description}\n  Input: ${JSON.stringify(tool.inputSchema.properties)}`,
    )
    .join('\n')

  return `\n\nAvailable tools:\n${toolDescriptions}`
}

/**
 * Check if Genkit supports the current tool set
 * Genkit 1.x+ has built-in tool support
 */
export function isToolCallingSupported(ai: Genkit): boolean {
  // Genkit 1.x supports tools via the `tools` parameter in generate()
  // Check if the generate function accepts tools
  return typeof ai.generate === 'function'
}

/**
 * Wrap tool executor for Genkit's expected format
 * Genkit expects tool responses as Part objects
 */
export function wrapToolExecutorForGenkit(
  executor: ToolExecutor,
): (name: string, args: Record<string, unknown>) => Promise<Array<{ text: string }>> {
  return async (name: string, args: Record<string, unknown>) => {
    const result = await executor(name, args)
    return [{ text: result }]
  }
}
