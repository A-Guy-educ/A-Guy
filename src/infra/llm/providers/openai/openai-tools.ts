/**
 * OpenAI Tool Calling Integration
 *
 * Converts MCP tools to OpenAI function declarations for tool calling support.
 *
 * @fileType utility
 * @domain ai
 * @pattern tool-calling, function-declaration, mcp-to-openai
 */

import type { MCPTool } from '@/server/repos/mcp/client/types'
import { discoverAllowedTools } from '@/server/repos/mcp/tool-allowlist'

/**
 * Represents a function declaration for OpenAI API
 */
export interface OpenAIFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT'
    properties: Record<string, OpenAIFunctionParameter>
    required?: string[]
  }
}

/**
 * Represents a parameter in a function declaration
 */
interface OpenAIFunctionParameter {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'
  description?: string
  enum?: string[]
  properties?: Record<string, OpenAIFunctionParameter>
}

/**
 * Convert MCP tools to OpenAI function declarations
 *
 * @param tools - Array of MCP tools from the MCP client
 * @returns Array of OpenAI function declarations
 */
export function mcpToolsToOpenAIFunctionDeclarations(
  tools: MCPTool[],
): OpenAIFunctionDeclaration[] {
  const allowedTools = discoverAllowedTools(tools)

  const declarations: OpenAIFunctionDeclaration[] = []

  for (const tool of tools) {
    if (!allowedTools.has(tool.name)) {
      continue
    }

    const declaration = convertMCPToolToOpenAIFunction(tool)
    if (declaration) {
      declarations.push(declaration)
    }
  }

  return declarations
}

/**
 * Convert a single MCP tool to an OpenAI function declaration
 */
function convertMCPToolToOpenAIFunction(tool: MCPTool): OpenAIFunctionDeclaration | null {
  // Build properties from input schema
  const properties: Record<string, OpenAIFunctionParameter> = {}
  const required: string[] = []

  if (tool.inputSchema && typeof tool.inputSchema === 'object') {
    const schema = tool.inputSchema

    if ('properties' in schema && schema.properties && typeof schema.properties === 'object') {
      for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
        const param = convertJSONSchemaToOpenAIParam(value)
        if (param) {
          properties[key] = param

          // Check if required
          if (
            'required' in schema &&
            Array.isArray(schema.required) &&
            schema.required.includes(key)
          ) {
            required.push(key)
          }
        }
      }
    }
  }

  // For our read-only tools, we have well-known parameter structures
  // Fall back to standard parameters if no schema provided or schema is empty
  if (Object.keys(properties).length === 0) {
    const standardParams = getStandardToolParams(tool.name)
    return {
      name: tool.name,
      description: tool.description || `Query ${tool.name.replace('find', '').toLowerCase()}`,
      parameters: {
        type: 'OBJECT',
        properties: standardParams.properties,
        required: standardParams.required,
      },
    }
  }

  return {
    name: tool.name,
    description: tool.description || `Query ${tool.name.replace('find', '').toLowerCase()}`,
    parameters: {
      type: 'OBJECT',
      properties,
      required: required.length > 0 ? required : undefined,
    },
  }
}

/**
 * Get standard parameters for known tool names, or default params for unknown tools
 */
function getStandardToolParams(toolName: string): {
  properties: Record<string, OpenAIFunctionParameter>
  required: string[]
} {
  const baseParams: Record<string, OpenAIFunctionParameter> = {
    limit: {
      type: 'INTEGER',
      description: 'Maximum number of results to return (1-10)',
    },
    page: {
      type: 'INTEGER',
      description: 'Page number for pagination',
    },
    sort: {
      type: 'STRING',
      description: 'Sort field (prefix with - for descending)',
    },
    where: {
      type: 'STRING',
      description: 'JSON string with filter conditions',
    },
  }

  // Collection-specific params
  const collectionParams: Record<string, Record<string, OpenAIFunctionParameter>> = {
    findCourses: {
      status: { type: 'STRING', description: 'Filter by status (draft/published)' },
      title: { type: 'STRING', description: 'Filter by title (contains)' },
    },
    findChapters: {
      status: { type: 'STRING', description: 'Filter by status' },
      title: { type: 'STRING', description: 'Filter by title (contains)' },
      course: { type: 'STRING', description: 'Filter by course ID' },
    },
    findLessons: {
      status: { type: 'STRING', description: 'Filter by status' },
      title: { type: 'STRING', description: 'Filter by title (contains)' },
      chapter: { type: 'STRING', description: 'Filter by chapter ID' },
    },
    findExercises: {
      status: { type: 'STRING', description: 'Filter by status' },
      title: { type: 'STRING', description: 'Filter by title (contains)' },
      lesson: { type: 'STRING', description: 'Filter by lesson ID' },
    },
    findMedia: {
      filename: { type: 'STRING', description: 'Filter by filename (contains)' },
      mimeType: { type: 'STRING', description: 'Filter by MIME type' },
    },
    // Generic 'any' property filter for all collections - allows querying by any field
    '*': {
      status: { type: 'STRING', description: 'Filter by status' },
      title: { type: 'STRING', description: 'Filter by title (contains)' },
    },
  }

  const extraParams = collectionParams[toolName] || {}

  return {
    properties: { ...baseParams, ...extraParams },
    required: [],
  }
}

/**
 * Convert JSON Schema to OpenAI parameter format
 */
function convertJSONSchemaToOpenAIParam(schema: unknown): OpenAIFunctionParameter | null {
  if (!schema || typeof schema !== 'object') {
    return null
  }

  const s = schema as Record<string, unknown>

  // Handle type
  let type: OpenAIFunctionParameter['type'] = 'STRING'
  const jsonType = s.type

  if (jsonType === 'string') {
    type = 'STRING'
  } else if (jsonType === 'integer' || jsonType === 'number') {
    type = 'NUMBER'
  } else if (jsonType === 'boolean') {
    type = 'BOOLEAN'
  } else if (jsonType === 'array') {
    type = 'ARRAY'
  } else if (jsonType === 'object') {
    type = 'OBJECT'
  }

  // Handle enum
  let enumValues: string[] | undefined
  if (s.enum && Array.isArray(s.enum)) {
    enumValues = s.enum.map((v) => String(v))
  }

  const param: OpenAIFunctionParameter = {
    type,
    description: typeof s.description === 'string' ? s.description : undefined,
  }

  if (enumValues) {
    param.enum = enumValues
  }

  return param
}

/**
 * Parse tool call result from OpenAI response
 */
export interface ParsedToolCall {
  name: string
  args: Record<string, unknown>
}

/**
 * Check if a response contains tool calls
 */
export function hasOpenAIToolCalls(
  response: unknown,
): response is {
  choices: Array<{
    message: { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
  }>
} {
  if (!response || typeof response !== 'object') {
    return false
  }

  const r = response as Record<string, unknown>
  if (!('choices' in r) || !Array.isArray(r.choices)) {
    return false
  }

  const choice = r.choices[0] as Record<string, unknown>
  if (!choice || typeof choice !== 'object') {
    return false
  }

  const message = choice.message as Record<string, unknown> | undefined
  return !!(message && 'tool_calls' in message && Array.isArray(message.tool_calls))
}

/**
 * Extract tool calls from OpenAI response
 */
export function extractOpenAIToolCalls(response: unknown): ParsedToolCall[] {
  if (!hasOpenAIToolCalls(response)) {
    return []
  }

  const choice = response.choices[0] as {
    message: { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
  }
  const toolCalls = choice.message.tool_calls || []

  return toolCalls.map((call) => ({
    name: call.function.name,
    args: JSON.parse(call.function.arguments || '{}'),
  }))
}

/**
 * Format tool results for OpenAI
 */
export function formatToolResultForOpenAI(toolName: string, resultText: string): string {
  return `## ${toolName} Results\n\n${resultText}`
}
