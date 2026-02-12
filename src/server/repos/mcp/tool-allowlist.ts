import { logger } from '@/infra/utils/logger'
import type { MCPTool } from './client/types'

const ALLOWED_TOOL_NAMES = new Set([
  'findCourses',
  'findChapters',
  'findLessons',
  'findExercises',
  'findMedia',
  'createCourses',
  'createChapters',
  'createLessons',
  'courses_create',
  'chapters_create',
  'lessons_create',
  'courses:create',
  'chapters:create',
  'lessons:create',
  // Student-specific tools for chat context grounding
  'getActiveExerciseContext',
])

/**
 * Student-specific allowed tool names
 * Students are restricted to only tools that fetch their current context
 */
export const STUDENT_ALLOWED_TOOL_NAMES = new Set(['getActiveExerciseContext'])

const BLOCKLIST_KEYWORDS = [
  'update',
  'delete',
  'insert',
  'remove',
  'modify',
  'patch',
  'put',
  'post',
]

export function isAllowedToolName(toolName: string): boolean {
  if (ALLOWED_TOOL_NAMES.has(toolName)) {
    return true
  }

  const lower = toolName.toLowerCase()
  for (const keyword of BLOCKLIST_KEYWORDS) {
    if (lower.includes(keyword)) {
      return false
    }
  }

  logger.warn({ toolName }, '[MCP] Unknown tool pattern rejected')
  return false
}

/**
 * Check if a tool name is allowed for student use
 *
 * @param toolName - The tool name to check
 * @returns true if the tool is in the student allowlist
 */
export function isStudentAllowedToolName(toolName: string): boolean {
  return STUDENT_ALLOWED_TOOL_NAMES.has(toolName)
}

/**
 * Filter MCP tools to only include those allowed for students
 *
 * @param tools - Array of MCP tools from the server
 * @returns Array of tools that students are allowed to use
 */
export function discoverStudentAllowedTools(tools: MCPTool[]): MCPTool[] {
  const allowed: MCPTool[] = []

  logger.info(
    { totalTools: tools.length, toolNames: tools.map((t) => t.name) },
    '[MCP] Discovering student-allowed tools from MCP server',
  )

  for (const tool of tools) {
    if (isStudentAllowedToolName(tool.name)) {
      allowed.push(tool)
      logger.info({ toolName: tool.name }, '[MCP] Student tool allowed')
    }
  }

  logger.info(
    { allowedCount: allowed.length, allowed: allowed.map((t) => t.name) },
    '[MCP] Student tool discovery complete',
  )

  return allowed
}

export function discoverAllowedTools(tools: MCPTool[]): Set<string> {
  const allowed = new Set<string>()

  logger.info(
    { totalTools: tools.length, toolNames: tools.map((t) => t.name) },
    '[MCP] Discovering allowed tools from MCP server',
  )

  for (const tool of tools) {
    if (isAllowedToolName(tool.name)) {
      allowed.add(tool.name)
      logger.info({ toolName: tool.name }, '[MCP] Tool allowed')
    }
  }

  logger.info(
    { allowedCount: allowed.size, allowed: Array.from(allowed) },
    '[MCP] Tool discovery complete',
  )

  return allowed
}
