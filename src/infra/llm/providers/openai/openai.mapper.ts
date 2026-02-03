/**
 * OpenAI Message Mapper
 * Converts between internal ChatMessage format and OpenAI API format
 *
 * @internal This module is used by openai.provider.ts only
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * OpenAI role type
 */
export type OpenAIRole = 'user' | 'assistant' | 'system'

/**
 * Convert internal role to OpenAI format
 */
export function toOpenAIRole(role: 'user' | 'assistant' | 'system'): OpenAIRole {
  return role
}

/**
 * Map internal messages to OpenAI chat completion format
 *
 * @param messages - Internal message array
 * @returns OpenAI chat completion messages
 */
export function mapMessagesToOpenAIFormat(
  messages: ChatMessage[],
): Array<{ role: OpenAIRole; content: string }> {
  return messages.map((msg) => ({
    role: toOpenAIRole(msg.role),
    content: msg.content,
  }))
}

/**
 * Extract text from OpenAI response
 */
export function extractTextFromOpenAIResponse(response: {
  choices: Array<{ message: { content: string | null } }>
}): string {
  const choice = response.choices[0]
  if (!choice || !choice.message) {
    return ''
  }
  return choice.message.content || ''
}

/**
 * Check if response contains tool calls
 */
export function hasToolCalls(response: unknown): response is {
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
export function extractToolCalls(
  response: unknown,
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  if (!hasToolCalls(response)) {
    return []
  }

  const choice = response.choices[0] as {
    message: { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
  }
  const toolCalls = choice.message.tool_calls || []

  return toolCalls.map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments || '{}'),
  }))
}

/**
 * Convert MCP tools to OpenAI function declarations
 */
export function mcpToolsToOpenAIFunctions(
  tools: Array<{
    name: string
    description?: string
    inputSchema?: Record<string, unknown>
  }>,
): Array<{
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}> {
  return tools.map((tool) => {
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    if (tool.inputSchema && typeof tool.inputSchema === 'object') {
      const schema = tool.inputSchema as Record<string, unknown>

      if ('properties' in schema && schema.properties && typeof schema.properties === 'object') {
        for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
          const param = convertJSONSchemaToOpenAIProperty(value)
          if (param) {
            properties[key] = param
          }
        }

        if ('required' in schema && Array.isArray(schema.required)) {
          required.push(...(schema.required.filter((r) => typeof r === 'string') as string[]))
        }
      }
    }

    return {
      type: 'object' as const,
      properties,
      required: required.length > 0 ? required : undefined,
    }
  })
}

/**
 * Convert JSON Schema to OpenAI property format
 */
function convertJSONSchemaToOpenAIProperty(schema: unknown): Record<string, unknown> | null {
  if (!schema || typeof schema !== 'object') {
    return null
  }

  const s = schema as Record<string, unknown>

  let type = 'string'
  const jsonType = s.type

  if (jsonType === 'integer' || jsonType === 'number') {
    type = 'number'
  } else if (jsonType === 'boolean') {
    type = 'boolean'
  } else if (jsonType === 'array') {
    type = 'array'
  } else if (jsonType === 'object') {
    type = 'object'
  }

  const property: Record<string, unknown> = { type }

  if (typeof s.description === 'string') {
    property.description = s.description
  }

  if (s.enum && Array.isArray(s.enum)) {
    property.enum = s.enum
  }

  return property
}
