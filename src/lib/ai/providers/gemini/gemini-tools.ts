import type { FunctionDeclaration } from '@google/generative-ai'

import type { MCPTool } from '@/lib/mcp/client/types'

export function mcpToolsToGeminiFunctionDeclarations(
  tools: MCPTool[],
  allowedToolNames: Set<string>,
): FunctionDeclaration[] {
  return tools
    .filter((tool) => allowedToolNames.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema as FunctionDeclaration['parameters'],
    }))
}
