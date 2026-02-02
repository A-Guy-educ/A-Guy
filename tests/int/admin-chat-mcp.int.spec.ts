/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for Admin Chat MCP flow
 * Tests: Tool allowlist filtering, MCP auth override for admin users,
 * Tool execution flow, error handling, Gemini tool conversion
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountRole } from '@/server/payload/collections/Users/roles'

// Sample MCP tool definitions
const mockMCPTools = [
  {
    name: 'findCourses',
    description: 'Query courses in the database',
    inputSchema: {
      type: 'object',
      properties: {
        where: {
          type: 'string',
          description: 'JSON-encoded where clause',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
        },
      },
    },
  },
  {
    name: 'findChapters',
    description: 'Query chapters',
    inputSchema: {
      type: 'object',
      properties: {
        where: {
          type: 'string',
          description: 'JSON-encoded where clause',
        },
      },
    },
  },
]

describe('Admin Chat MCP Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Tool Allowlist', () => {
    it('should only allow specific read-only tool names', async () => {
      const { isAllowedToolName } = await import('@/server/repos/mcp/tool-allowlist')

      // Allowed tools
      expect(isAllowedToolName('findCourses')).toBe(true)
      expect(isAllowedToolName('findChapters')).toBe(true)
      expect(isAllowedToolName('findLessons')).toBe(true)
      expect(isAllowedToolName('findExercises')).toBe(true)
      expect(isAllowedToolName('findMedia')).toBe(true)

      // Blocked tools (write operations)
      expect(isAllowedToolName('createCourse')).toBe(false)
      expect(isAllowedToolName('updateCourse')).toBe(false)
      expect(isAllowedToolName('deleteCourse')).toBe(false)
      expect(isAllowedToolName('insertCourse')).toBe(false)
      expect(isAllowedToolName('removeCourse')).toBe(false)
      expect(isAllowedToolName('modifyCourse')).toBe(false)
      expect(isAllowedToolName('patchCourse')).toBe(false)
      expect(isAllowedToolName('putCourse')).toBe(false)
      expect(isAllowedToolName('postCourse')).toBe(false)
    })

    it('should filter MCP tools based on allowlist', async () => {
      const { discoverAllowedTools } = await import('@/server/repos/mcp/tool-allowlist')

      const tools = [
        { name: 'findCourses', inputSchema: {} },
        { name: 'createCourse', inputSchema: {} },
        { name: 'findChapters', inputSchema: {} },
        { name: 'updateChapter', inputSchema: {} },
      ]

      const allowedTools = discoverAllowedTools(tools)

      expect(allowedTools.has('findCourses')).toBe(true)
      expect(allowedTools.has('findChapters')).toBe(true)
      expect(allowedTools.has('createCourse')).toBe(false)
      expect(allowedTools.has('updateChapter')).toBe(false)
      expect(allowedTools.size).toBe(2)
    })

    it('should handle case sensitivity in tool names', async () => {
      const { isAllowedToolName } = await import('@/server/repos/mcp/tool-allowlist')

      expect(isAllowedToolName('findCourses')).toBe(true)
      expect(isAllowedToolName('FINCOURSES')).toBe(false)
      expect(isAllowedToolName('FindCourses')).toBe(false)
    })

    it('should handle edge cases for tool names', async () => {
      const { isAllowedToolName } = await import('@/server/repos/mcp/tool-allowlist')

      expect(isAllowedToolName('')).toBe(false)
      expect(isAllowedToolName('find')).toBe(false)
      expect(isAllowedToolName('courses')).toBe(false)
      expect(isAllowedToolName('findcourses')).toBe(false)
    })
  })

  describe('MCP Plugin Auth Override', () => {
    it('should return access settings for admin users without calling default', async () => {
      const { overrideAuth } = await import('@/server/payload/plugins/mcp')

      const mockReq = {
        user: {
          id: 'test-admin-user-id',
          role: AccountRole.Admin,
          collection: 'users',
        },
      } as unknown as import('payload').PayloadRequest

      const mockDefaultAuth = vi.fn()

      const result = await overrideAuth(mockReq as any, mockDefaultAuth)

      // Admin users should get direct access (not fall back to default auth)
      expect(mockDefaultAuth).not.toHaveBeenCalled()
      expect(result).toBeDefined()
      expect(result.user).toBeDefined()
      expect((result.user as any)?.id).toBe('test-admin-user-id')
    })

    it('should call default auth for non-admin users', async () => {
      const { overrideAuth } = await import('@/server/payload/plugins/mcp')

      const mockReq = {
        user: {
          id: 'non-admin-user',
          role: AccountRole.Student,
          collection: 'users',
        },
      } as unknown as import('payload').PayloadRequest

      const mockDefaultAuthResult = {
        user: mockReq.user,
        create: false,
        read: true,
        update: false,
        delete: false,
      }

      const mockDefaultAuth = vi.fn().mockResolvedValue(mockDefaultAuthResult)

      const result = await overrideAuth(mockReq as any, mockDefaultAuth)

      // Should call default auth for non-admin users
      expect(mockDefaultAuth).toHaveBeenCalled()
      expect(result.read).toBe(true)
    })

    it('should call default auth for API key authentication', async () => {
      const { overrideAuth } = await import('@/server/payload/plugins/mcp')

      const mockReq = {
        user: {
          id: 'api-key-id',
          collection: 'payload-mcp-api-keys',
        },
      } as unknown as import('payload').PayloadRequest

      const mockDefaultAuthResult = {
        user: { id: 'api-key-id', collection: 'payload-mcp-api-keys' },
        create: false,
        read: true,
        update: false,
        delete: false,
      }

      const mockDefaultAuth = vi.fn().mockResolvedValue(mockDefaultAuthResult)

      const result = await overrideAuth(mockReq as any, mockDefaultAuth)

      // Should call default auth for API keys
      expect(mockDefaultAuth).toHaveBeenCalled()
      expect(result.read).toBe(true)
      expect(result.create).toBe(false)
    })
  })

  describe('Tool Execution Flow', () => {
    it('should reject disallowed tool names', async () => {
      const { executeToolCall } = await import('@/server/repos/mcp/chat-integration')

      const mockReq = {
        user: { id: 'test-user-id' },
        headers: new Headers(),
      } as unknown as import('payload').PayloadRequest

      const toolCall = {
        name: 'createCourse', // Not allowed
        args: {
          title: 'New Course',
        },
      }

      await expect(
        executeToolCall({
          toolCall,
          tenantId: 'test-tenant',
          req: mockReq,
          requestId: 'test-request-id',
        }),
      ).rejects.toThrow('Tool createCourse is not allowed')
    })

    it('should reject invalid JSON in where clause', async () => {
      const { executeToolCall } = await import('@/server/repos/mcp/chat-integration')

      const mockReq = {
        user: { id: 'test-user-id' },
        headers: new Headers(),
      } as unknown as import('payload').PayloadRequest

      const toolCall = {
        name: 'findExercises',
        args: {
          where: 'invalid json',
        },
      }

      // Invalid JSON in where clause should be rejected
      await expect(
        executeToolCall({
          toolCall,
          tenantId: 'test-tenant',
          req: mockReq,
          requestId: 'test-request-id',
        }),
      ).rejects.toThrow('Where must be valid JSON')
    })
  })

  describe('Gemini Tool Conversion', () => {
    it('should convert MCP tools to Gemini function declarations', async () => {
      const { mcpToolsToGeminiFunctionDeclarations } =
        await import('@/infra/llm/providers/gemini/gemini-tools')

      const declarations = mcpToolsToGeminiFunctionDeclarations(mockMCPTools)

      expect(declarations).toHaveLength(2)
      expect(declarations[0].name).toBe('findCourses')
      expect(declarations[0].description).toBe('Query courses in the database')
      expect(declarations[1].name).toBe('findChapters')
      expect(declarations[1].description).toBe('Query chapters')
    })

    it('should filter out disallowed tools in conversion', async () => {
      const { mcpToolsToGeminiFunctionDeclarations } =
        await import('@/infra/llm/providers/gemini/gemini-tools')

      const toolsWithDisallowed = [
        ...mockMCPTools,
        { name: 'createCourse', description: 'Create a course', inputSchema: {} },
        { name: 'deleteCourse', description: 'Delete a course', inputSchema: {} },
      ]

      const declarations = mcpToolsToGeminiFunctionDeclarations(toolsWithDisallowed)

      expect(declarations).toHaveLength(2)
      expect(declarations.find((d) => d.name === 'createCourse')).toBeUndefined()
      expect(declarations.find((d) => d.name === 'deleteCourse')).toBeUndefined()
    })

    it('should handle empty tools array', async () => {
      const { mcpToolsToGeminiFunctionDeclarations } =
        await import('@/infra/llm/providers/gemini/gemini-tools')

      const declarations = mcpToolsToGeminiFunctionDeclarations([])

      expect(declarations).toHaveLength(0)
    })

    it('should format tool results for Gemini consumption', async () => {
      const { formatToolResultForGemini } =
        await import('@/infra/llm/providers/gemini/gemini-tools')

      const toolResult = JSON.stringify([
        { id: 'course-1', title: 'TypeScript Course' },
        { id: 'course-2', title: 'React Course' },
      ])

      const formatted = formatToolResultForGemini('findCourses', toolResult)

      expect(formatted).toContain('findCourses Results')
      expect(formatted).toContain('course-1')
      expect(formatted).toContain('TypeScript Course')
    })

    it('should detect tool calls in response', async () => {
      const { hasToolCalls } = await import('@/infra/llm/providers/gemini/gemini-tools')

      const responseWithCalls = {
        functionCalls: [{ name: 'findCourses', args: { limit: 10 } }],
      }

      const responseWithoutCalls = {
        text: 'Hello, how can I help you?',
      }

      expect(hasToolCalls(responseWithCalls)).toBe(true)
      expect(hasToolCalls(responseWithoutCalls)).toBe(false)
      expect(hasToolCalls(null)).toBe(false)
      expect(hasToolCalls({})).toBe(false)
    })

    it('should extract tool calls from response', async () => {
      const { extractToolCalls } = await import('@/infra/llm/providers/gemini/gemini-tools')

      const response = {
        functionCalls: [
          { name: 'findCourses', args: { limit: 10 } },
          { name: 'findChapters', args: { course: 'course-123' } },
        ],
      }

      const toolCalls = extractToolCalls(response)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0].name).toBe('findCourses')
      expect(toolCalls[0].args).toEqual({ limit: 10 })
      expect(toolCalls[1].name).toBe('findChapters')
      expect(toolCalls[1].args).toEqual({ course: 'course-123' })
    })

    it('should return empty array when no tool calls', async () => {
      const { extractToolCalls } = await import('@/infra/llm/providers/gemini/gemini-tools')

      const response = {
        text: 'Hello!',
      }

      const toolCalls = extractToolCalls(response)

      expect(toolCalls).toHaveLength(0)
    })
  })

  describe('Authentication Header Building', () => {
    it('should extract cookies from request headers', () => {
      const mockReq = {
        headers: new Headers({
          cookie: 'session=abc123; token=xyz789',
        }),
      } as unknown as import('payload').PayloadRequest

      const cookie = mockReq.headers.get('cookie')
      expect(cookie).toBe('session=abc123; token=xyz789')
    })

    it('should extract authorization header from request', () => {
      const mockReq = {
        headers: new Headers({
          authorization: 'Bearer test-token-123',
        }),
      } as unknown as import('payload').PayloadRequest

      const authorization = mockReq.headers.get('authorization')
      expect(authorization).toBe('Bearer test-token-123')
    })

    it('should handle missing headers gracefully', () => {
      const mockReq = {
        headers: new Headers(),
      } as unknown as import('payload').PayloadRequest

      const cookie = mockReq.headers.get('cookie')
      const authorization = mockReq.headers.get('authorization')

      expect(cookie).toBeNull()
      expect(authorization).toBeNull()
    })
  })

  describe('Event Stream Parsing', () => {
    it('should parse JSON-RPC responses correctly', () => {
      const mockMCPToolResult = {
        jsonrpc: '2.0',
        id: '1',
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify([{ id: 'course-1', title: 'Introduction to TypeScript' }]),
            },
          ],
        },
      }

      const eventStream = `data: ${JSON.stringify(mockMCPToolResult)}\n\n`

      // Simulate parseEventStream logic
      const lines = eventStream.split(/\r?\n/)
      const dataLines = lines.filter((line) => line.startsWith('data:'))
      const lastDataLine = dataLines[dataLines.length - 1]
      const jsonText = lastDataLine.replace(/^data:\s*/, '')
      const result = JSON.parse(jsonText)

      expect(result.jsonrpc).toBe('2.0')
      expect(result.id).toBe('1')
      expect(result.result).toBeDefined()
      expect(Array.isArray(result.result.content)).toBe(true)
    })
  })
})
