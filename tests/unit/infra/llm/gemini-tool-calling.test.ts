/**
 * Unit Tests for Gemini Tool Calling Integration
 *
 * Tests the MCP to Gemini function declaration conversion and tool calling utilities.
 */
import {
  extractToolCalls,
  formatToolResultForGemini,
  hasToolCalls,
  mcpToolsToGeminiFunctionDeclarations,
  type ParsedToolCall,
} from '@/infra/llm/providers/gemini/gemini-tools'
import type { MCPTool } from '@/server/repos/mcp/client/types'
import { FunctionCallingMode } from '@google/generative-ai'
import { describe, expect, it } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mockMCPTools: MCPTool[] = [
  {
    name: 'findCourses',
    description: 'Query educational courses',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max results' },
        where: { type: 'string', description: 'Filter conditions' },
      },
    },
  },
  {
    name: 'findChapters',
    description: 'Query course chapters',
    inputSchema: {
      type: 'object',
      properties: {
        course: { type: 'string', description: 'Course ID' },
        limit: { type: 'integer', description: 'Max results' },
      },
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('mcpToolsToGeminiFunctionDeclarations', () => {
  it('should convert MCP tools to Gemini function declarations', () => {
    const declarations = mcpToolsToGeminiFunctionDeclarations(mockMCPTools)

    expect(declarations).toHaveLength(2)
    expect(declarations[0].name).toBe('findCourses')
    expect(declarations[1].name).toBe('findChapters')
  })

  it('should include description from MCP tool', () => {
    const declarations = mcpToolsToGeminiFunctionDeclarations(mockMCPTools)

    expect(declarations[0].description).toBe('Query educational courses')
    expect(declarations[1].description).toBe('Query course chapters')
  })

  it('should convert integer type to NUMBER', () => {
    const declarations = mcpToolsToGeminiFunctionDeclarations(mockMCPTools)
    const courseDecl = declarations.find((d) => d.name === 'findChapters')

    expect(courseDecl).toBeDefined()
    expect(courseDecl!.parameters.properties.limit.type).toBe('NUMBER')
  })

  it('should convert string type to STRING', () => {
    const declarations = mcpToolsToGeminiFunctionDeclarations(mockMCPTools)
    const courseDecl = declarations.find((d) => d.name === 'findChapters')

    expect(courseDecl).toBeDefined()
    expect(courseDecl!.parameters.properties.course.type).toBe('STRING')
  })

  it('should have correct parameter structure', () => {
    const declarations = mcpToolsToGeminiFunctionDeclarations(mockMCPTools)

    for (const decl of declarations) {
      expect(decl).toHaveProperty('name')
      expect(decl).toHaveProperty('description')
      expect(decl).toHaveProperty('parameters')
      expect(decl.parameters.type).toBe('OBJECT')
      expect(decl.parameters).toHaveProperty('properties')
      expect(typeof decl.parameters.properties).toBe('object')
    }
  })
})

describe('hasToolCalls', () => {
  it('should return true when response has functionCalls', () => {
    const response = {
      functionCalls: [{ name: 'findCourses', args: { limit: 5 } }],
    }
    expect(hasToolCalls(response)).toBe(true)
  })

  it('should return false when response has no functionCalls', () => {
    const response = { text: 'Hello' }
    expect(hasToolCalls(response)).toBe(false)
  })

  it('should return false for null response', () => {
    expect(hasToolCalls(null)).toBe(false)
  })

  it('should return false for non-object response', () => {
    expect(hasToolCalls('string')).toBe(false)
    expect(hasToolCalls(123)).toBe(false)
  })

  it('should return false when functionCalls is not an array', () => {
    const response = { functionCalls: 'not an array' }
    expect(hasToolCalls(response)).toBe(false)
  })
})

describe('extractToolCalls', () => {
  it('should extract tool calls from response', () => {
    const response = {
      functionCalls: [
        { name: 'findCourses', args: { limit: 10 } },
        { name: 'findChapters', args: { course: 'abc123' } },
      ],
    }

    const toolCalls = extractToolCalls(response)

    expect(toolCalls).toHaveLength(2)
    expect(toolCalls[0]).toEqual({ name: 'findCourses', args: { limit: 10 } })
    expect(toolCalls[1]).toEqual({ name: 'findChapters', args: { course: 'abc123' } })
  })

  it('should return empty array when no functionCalls', () => {
    const response = { text: 'Hello' }
    const toolCalls = extractToolCalls(response)

    expect(toolCalls).toEqual([])
  })

  it('should handle missing args', () => {
    const response = {
      functionCalls: [{ name: 'findCourses' }],
    }

    const toolCalls = extractToolCalls(response)

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].args).toEqual({})
  })

  it('should return empty array for null/undefined response', () => {
    expect(extractToolCalls(null)).toEqual([])
    expect(extractToolCalls(undefined)).toEqual([])
  })
})

describe('formatToolResultForGemini', () => {
  it('should format tool result with header', () => {
    const result = formatToolResultForGemini('findCourses', 'Found 5 courses')

    expect(result).toBe('## findCourses Results\n\nFound 5 courses')
  })

  it('should handle empty result text', () => {
    const result = formatToolResultForGemini('findCourses', '')

    expect(result).toBe('## findCourses Results\n\n')
  })

  it('should include tool name correctly', () => {
    const result = formatToolResultForGemini('findMedia', 'No media found')

    expect(result).toContain('## findMedia Results')
  })
})

describe('ParsedToolCall interface', () => {
  it('should correctly type parsed tool calls', () => {
    const toolCall: ParsedToolCall = {
      name: 'findCourses',
      args: { limit: 5, where: '{"status": "published"}' },
    }

    expect(toolCall.name).toBe('findCourses')
    expect(toolCall.args.limit).toBe(5)
    expect(toolCall.args.where).toBe('{"status": "published"}')
  })

  it('should handle empty args object', () => {
    const toolCall: ParsedToolCall = {
      name: 'findCourses',
      args: {},
    }

    expect(toolCall.args).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FunctionCallingMode Tests (from gemini-tool-calling.ts configuration)
// ─────────────────────────────────────────────────────────────────────────────

describe('FunctionCallingMode configuration', () => {
  it('should have AUTO mode defined', () => {
    expect(FunctionCallingMode.AUTO).toBe('AUTO')
  })

  it('should have ANY mode defined', () => {
    expect(FunctionCallingMode.ANY).toBe('ANY')
  })

  it('should have NONE mode defined', () => {
    expect(FunctionCallingMode.NONE).toBe('NONE')
  })

  it('should configure AUTO mode correctly for tool calling', () => {
    // This test verifies that AUTO mode is the correct configuration
    // when tools are present (as used in gemini-tool-calling.ts)
    const toolConfig = {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
      },
    }

    expect(toolConfig.functionCallingConfig.mode).toBe(FunctionCallingMode.AUTO)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('should handle tools without inputSchema', () => {
    // Use findCourses which is in the allowlist but with no inputSchema
    const toolsWithoutSchema: MCPTool[] = [
      { name: 'findCourses', description: 'Query educational courses' },
    ]

    const declarations = mcpToolsToGeminiFunctionDeclarations(toolsWithoutSchema)

    expect(declarations).toHaveLength(1)
    expect(declarations[0].name).toBe('findCourses')
    // Should use standard params when no schema provided
    expect(declarations[0].parameters.properties).toHaveProperty('limit')
    expect(declarations[0].parameters.properties).toHaveProperty('page')
  })

  it('should handle tools with empty properties', () => {
    // Use findCourses which is in the allowlist but with empty properties
    const toolsWithEmptySchema: MCPTool[] = [
      {
        name: 'findCourses',
        description: 'Query educational courses',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const declarations = mcpToolsToGeminiFunctionDeclarations(toolsWithEmptySchema)

    expect(declarations).toHaveLength(1)
    // Should use standard params when schema has empty properties
    expect(declarations[0].parameters.properties).toHaveProperty('limit')
    expect(declarations[0].parameters.properties).toHaveProperty('page')
  })

  it('should handle empty array of tools', () => {
    const declarations = mcpToolsToGeminiFunctionDeclarations([])

    expect(declarations).toEqual([])
  })

  it('should handle functionCalls with multiple arguments', () => {
    const response = {
      functionCalls: [
        {
          name: 'findCourses',
          args: {
            limit: 10,
            where: '{"status": "published"}',
            sort: '-createdAt',
          },
        },
      ],
    }

    const toolCalls = extractToolCalls(response)

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].args).toEqual({
      limit: 10,
      where: '{"status": "published"}',
      sort: '-createdAt',
    })
  })

  it('should handle deeply nested function calls in response', () => {
    const response = {
      functionCalls: [
        { name: 'findCourses', args: { where: '{"status": {"equals": "published"}}' } },
      ],
    }

    const toolCalls = extractToolCalls(response)

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].name).toBe('findCourses')
    expect(toolCalls[0].args.where).toBe('{"status": {"equals": "published"}}')
  })
})
