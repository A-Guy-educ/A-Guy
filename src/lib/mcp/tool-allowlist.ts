import { logger } from '@/utilities/logger'
import type { MCPTool } from './client/types'

const ALLOWED_TOOL_NAMES = new Set([
  'findCourses',
  'findChapters',
  'findLessons',
  'findExercises',
  'findMedia',
])

const BLOCKLIST_KEYWORDS = [
  'create',
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
  const lower = toolName.toLowerCase()
  for (const keyword of BLOCKLIST_KEYWORDS) {
    if (lower.includes(keyword)) {
      return false
    }
  }

  if (!ALLOWED_TOOL_NAMES.has(toolName)) {
    logger.warn({ toolName }, '[MCP] Unknown tool pattern rejected')
    return false
  }

  return true
}

export function discoverAllowedTools(tools: MCPTool[]): Set<string> {
  const allowed = new Set<string>()

  for (const tool of tools) {
    if (isAllowedToolName(tool.name)) {
      allowed.add(tool.name)
    }
  }

  return allowed
}
