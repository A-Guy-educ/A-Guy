import { logger } from '@/infra/utils/logger'
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
