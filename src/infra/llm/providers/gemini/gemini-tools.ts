/**
 * Gemini Tool Calling Integration
 *
 * Converts MCP tools to Gemini function declarations for tool calling support.
 *
 * @fileType utility
 * @domain ai
 * @pattern tool-calling, function-declaration, mcp-to-gemini
 */

import type { MCPTool } from '@/server/repos/mcp/client/types'
import { discoverAllowedTools } from '@/server/repos/mcp/tool-allowlist'

/**
 * Represents a function declaration for Gemini API
 */
export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT'
    properties: Record<string, GeminiFunctionParameter>
    required?: string[]
  }
}

/**
 * Represents a parameter in a function declaration
 */
interface GeminiFunctionParameter {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'
  description?: string
  enum?: string[]
  properties?: Record<string, GeminiFunctionParameter>
}

/**
 * Convert MCP tools to Gemini function declarations
 *
 * @param tools - Array of MCP tools from the MCP client
 * @returns Array of Gemini function declarations
 */
export function mcpToolsToGeminiFunctionDeclarations(
  tools: MCPTool[],
): GeminiFunctionDeclaration[] {
  const allowedTools = discoverAllowedTools(tools)

  const declarations: GeminiFunctionDeclaration[] = []

  for (const tool of tools) {
    if (!allowedTools.has(tool.name)) {
      continue
    }

    const declaration = convertMCPToolToGeminiFunction(tool)
    if (declaration) {
      declarations.push(declaration)
    }
  }

  return declarations
}

/**
 * Convert a single MCP tool to a Gemini function declaration
 */
function convertMCPToolToGeminiFunction(tool: MCPTool): GeminiFunctionDeclaration | null {
  // Build properties from input schema
  const properties: Record<string, GeminiFunctionParameter> = {}
  const required: string[] = []

  if (tool.inputSchema && typeof tool.inputSchema === 'object') {
    const schema = tool.inputSchema

    if ('properties' in schema && schema.properties && typeof schema.properties === 'object') {
      for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
        const param = convertJSONSchemaToGeminiParam(value)
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
      properties: properties,
      required: required.length > 0 ? required : undefined,
    },
  }
}

/**
 * Get standard parameters for known tool names, or default params for unknown tools
 */
function getStandardToolParams(toolName: string): {
  properties: Record<string, GeminiFunctionParameter>
  required: string[]
} {
  const baseParams: Record<string, GeminiFunctionParameter> = {
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
  const collectionParams: Record<string, Record<string, GeminiFunctionParameter>> = {
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
 * Convert JSON Schema to Gemini parameter format
 */
function convertJSONSchemaToGeminiParam(schema: unknown): GeminiFunctionParameter | null {
  if (!schema || typeof schema !== 'object') {
    return null
  }

  const s = schema as Record<string, unknown>

  // Handle type
  let type: GeminiFunctionParameter['type'] = 'STRING'
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

  const param: GeminiFunctionParameter = {
    type,
    description: typeof s.description === 'string' ? s.description : undefined,
  }

  if (enumValues) {
    param.enum = enumValues
  }

  return param
}

/**
 * Parse tool call result from Gemini response
 */
export interface ParsedToolCall {
  name: string
  args: Record<string, unknown>
}

/**
 * Check if a response contains tool calls
 */
export function hasToolCalls(
  response: unknown,
): response is { functionCalls?: Array<{ name: string; args: Record<string, unknown> }> } {
  if (!response || typeof response !== 'object') {
    return false
  }

  const r = response as Record<string, unknown>
  return 'functionCalls' in r && Array.isArray(r.functionCalls)
}

/**
 * Extract tool calls from Gemini response
 */
export function extractToolCalls(response: unknown): ParsedToolCall[] {
  if (!hasToolCalls(response)) {
    return []
  }

  const toolCalls = response.functionCalls || []
  return toolCalls.map((call) => ({
    name: call.name,
    args: call.args || {},
  }))
}

/**
 * Format tool results for Gemini
 */
export function formatToolResultForGemini(toolName: string, resultText: string): string {
  return `## ${toolName} Results\n\n${resultText}`
}
