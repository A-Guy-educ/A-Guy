/**
 * Unit Tests for MCP Tool Allowlist
 *
 * Tests the tool allowlist functionality that filters MCP tools
 * to only allow read-only operations (find* methods) and block
 * destructive operations (create, update, delete, etc.)
 */
import type { MCPTool } from '@/server/repos/mcp/client/types'
import { discoverAllowedTools, isAllowedToolName } from '@/server/repos/mcp/tool-allowlist'
import { describe, expect, it } from 'vitest'

describe('isAllowedToolName', () => {
  describe('allowed tool names', () => {
    it('allows findCourses', () => {
      expect(isAllowedToolName('findCourses')).toBe(true)
    })

    it('allows findChapters', () => {
      expect(isAllowedToolName('findChapters')).toBe(true)
    })

    it('allows findLessons', () => {
      expect(isAllowedToolName('findLessons')).toBe(true)
    })

    it('allows findExercises', () => {
      expect(isAllowedToolName('findExercises')).toBe(true)
    })

    it('allows findMedia', () => {
      expect(isAllowedToolName('findMedia')).toBe(true)
    })
  })

  describe('blocklisted keywords - create operations', () => {
    it('rejects createCourses', () => {
      expect(isAllowedToolName('createCourses')).toBe(false)
    })

    it('rejects createChapters', () => {
      expect(isAllowedToolName('createChapters')).toBe(false)
    })

    it('rejects createLessons', () => {
      expect(isAllowedToolName('createLessons')).toBe(false)
    })

    it('rejects createExercises', () => {
      expect(isAllowedToolName('createExercises')).toBe(false)
    })

    it('rejects createMedia', () => {
      expect(isAllowedToolName('createMedia')).toBe(false)
    })
  })

  describe('blocklisted keywords - update operations', () => {
    it('rejects updateCourses', () => {
      expect(isAllowedToolName('updateCourses')).toBe(false)
    })

    it('rejects updateChapters', () => {
      expect(isAllowedToolName('updateChapters')).toBe(false)
    })

    it('rejects updateLessons', () => {
      expect(isAllowedToolName('updateLessons')).toBe(false)
    })

    it('rejects updateExercises', () => {
      expect(isAllowedToolName('updateExercises')).toBe(false)
    })
  })

  describe('blocklisted keywords - delete operations', () => {
    it('rejects deleteCourses', () => {
      expect(isAllowedToolName('deleteCourses')).toBe(false)
    })

    it('rejects deleteChapters', () => {
      expect(isAllowedToolName('deleteChapters')).toBe(false)
    })

    it('rejects deleteLessons', () => {
      expect(isAllowedToolName('deleteLessons')).toBe(false)
    })

    it('rejects deleteExercises', () => {
      expect(isAllowedToolName('deleteExercises')).toBe(false)
    })
  })

  describe('blocklisted keywords - other operations', () => {
    it('rejects insertCourses', () => {
      expect(isAllowedToolName('insertCourses')).toBe(false)
    })

    it('rejects removeCourses', () => {
      expect(isAllowedToolName('removeCourses')).toBe(false)
    })

    it('rejects modifyCourses', () => {
      expect(isAllowedToolName('modifyCourses')).toBe(false)
    })

    it('rejects patchCourses', () => {
      expect(isAllowedToolName('patchCourses')).toBe(false)
    })

    it('rejects putCourses', () => {
      expect(isAllowedToolName('putCourses')).toBe(false)
    })
  })

  describe('unknown tool patterns', () => {
    it('rejects unknown tool names not in allowlist', () => {
      expect(isAllowedToolName('findSomething')).toBe(false)
    })

    it('rejects getCourses (not in allowlist)', () => {
      expect(isAllowedToolName('getCourses')).toBe(false)
    })

    it('rejects queryCourses', () => {
      expect(isAllowedToolName('queryCourses')).toBe(false)
    })

    it('rejects listCourses', () => {
      expect(isAllowedToolName('listCourses')).toBe(false)
    })
  })

  describe('case sensitivity', () => {
    it('is case-insensitive for blocklist keywords', () => {
      expect(isAllowedToolName('CREATE')).toBe(false)
      expect(isAllowedToolName('Create')).toBe(false)
      expect(isAllowedToolName('create')).toBe(false)
      expect(isAllowedToolName('CrEaTe')).toBe(false)
    })

    it('preserves case for allowlist lookup', () => {
      // Allowlist uses exact match
      expect(isAllowedToolName('findcourses')).toBe(false)
      expect(isAllowedToolName('FINDCOURSES')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(isAllowedToolName('')).toBe(false)
    })

    it('handles tool names with partial blocklist matches', () => {
      // "create" appears in "recreate" - should be blocked
      expect(isAllowedToolName('recreateCourses')).toBe(false)
    })

    it('handles tool names with similar prefixes', () => {
      expect(isAllowedToolName('findOrCreateCourses')).toBe(false)
    })
  })
})

describe('discoverAllowedTools', () => {
  const createMockTool = (name: string): MCPTool => ({
    name,
    description: `Tool for ${name}`,
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max results' },
      },
    },
  })

  it('filters array correctly - allows valid tools', () => {
    const tools = [
      createMockTool('findCourses'),
      createMockTool('findChapters'),
      createMockTool('findLessons'),
    ]

    const allowed = discoverAllowedTools(tools)

    expect(allowed.size).toBe(3)
    expect(allowed.has('findCourses')).toBe(true)
    expect(allowed.has('findChapters')).toBe(true)
    expect(allowed.has('findLessons')).toBe(true)
  })

  it('filters array correctly - rejects invalid tools', () => {
    const tools = [
      createMockTool('findCourses'),
      createMockTool('createCourses'),
      createMockTool('findChapters'),
      createMockTool('deleteChapters'),
    ]

    const allowed = discoverAllowedTools(tools)

    expect(allowed.size).toBe(2)
    expect(allowed.has('findCourses')).toBe(true)
    expect(allowed.has('findChapters')).toBe(true)
    expect(allowed.has('createCourses')).toBe(false)
    expect(allowed.has('deleteChapters')).toBe(false)
  })

  it('handles empty array', () => {
    const allowed = discoverAllowedTools([])

    expect(allowed.size).toBe(0)
  })

  it('handles array with only invalid tools', () => {
    const tools = [
      createMockTool('createCourses'),
      createMockTool('updateChapters'),
      createMockTool('deleteLessons'),
    ]

    const allowed = discoverAllowedTools(tools)

    expect(allowed.size).toBe(0)
  })

  it('returns a Set with unique tool names', () => {
    const tools = [
      createMockTool('findCourses'),
      createMockTool('findCourses'), // Duplicate
      createMockTool('findChapters'),
    ]

    const allowed = discoverAllowedTools(tools)

    expect(allowed.size).toBe(2)
  })

  it('handles tools without inputSchema', () => {
    const tools: MCPTool[] = [{ name: 'findCourses', description: 'Query courses' }]

    const allowed = discoverAllowedTools(tools)

    expect(allowed.size).toBe(1)
    expect(allowed.has('findCourses')).toBe(true)
  })

  it('handles tools with complex inputSchema', () => {
    const tools = [
      createMockTool('findCourses'),
      {
        name: 'findExercises',
        description: 'Query exercises',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            where: { type: 'string' },
            sort: { type: 'string' },
          },
          required: ['where'],
        },
      },
    ]

    const allowed = discoverAllowedTools(tools)

    expect(allowed.size).toBe(2)
  })
})
