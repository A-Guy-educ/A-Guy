import type { PayloadRequest } from 'payload'

import { logger } from '@/utilities/logger'
import { getMCPClient } from './client/mcp-client'
import type { MCPToolCall } from './client/types'
import { logMcpCall } from './audit/audit-service'
import { transformToolResult, type TransformedToolResult } from './transforms'
import { validateAndSanitizeArgs } from './validation/argument-validator'
import { isAllowedToolName } from './tool-allowlist'

export async function executeToolCall(params: {
  toolCall: MCPToolCall
  tenantId: string
  req: PayloadRequest
  requestId: string
}): Promise<TransformedToolResult> {
  const { toolCall, tenantId, req, requestId } = params

  if (!isAllowedToolName(toolCall.name)) {
    throw new Error(`Tool ${toolCall.name} is not allowed`)
  }

  const sanitizedArgs = validateAndSanitizeArgs(toolCall.name, toolCall.args)
  const argsWithTenant = injectTenantFilter(sanitizedArgs, tenantId)

  const headers = buildForwardHeaders(req)
  const mcpClient = getMCPClient()

  const start = Date.now()
  let success = false
  try {
    const rawResult = await mcpClient.callTool(
      toolCall.name,
      argsWithTenant as Record<string, unknown>,
      headers,
    )
    const durationMs = Date.now() - start
    const transformed = transformToolResult(toolCall.name, rawResult)
    const resultCount = transformed.items.length

    success = true
    void logMcpCall({
      req,
      adminUserId: req.user?.id as string,
      tenantId,
      toolName: toolCall.name,
      args: argsWithTenant,
      resultCount,
      success: true,
      durationMs,
      requestId,
    })

    return transformed
  } catch (error) {
    const durationMs = Date.now() - start
    logger.error({ err: error, toolName: toolCall.name }, '[MCP] Tool execution failed')

    void logMcpCall({
      req,
      adminUserId: req.user?.id as string,
      tenantId,
      toolName: toolCall.name,
      args: argsWithTenant,
      resultCount: 0,
      success: false,
      durationMs,
      requestId,
    })

    throw error
  } finally {
    if (!success) {
      logger.warn({ toolName: toolCall.name }, '[MCP] Tool call failed')
    }
  }
}

function injectTenantFilter(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const existingWhere = typeof args.where === 'string' ? safeParseWhere(args.where) : {}
  const tenantClause = { tenant: { equals: tenantId } }

  let nextWhere: Record<string, unknown>
  if (!existingWhere || Object.keys(existingWhere).length === 0) {
    nextWhere = tenantClause
  } else if (Array.isArray(existingWhere.and)) {
    nextWhere = {
      ...existingWhere,
      and: [...existingWhere.and, tenantClause],
    }
  } else {
    nextWhere = {
      and: [existingWhere, tenantClause],
    }
  }

  return {
    ...args,
    where: JSON.stringify(nextWhere),
  }
}

function safeParseWhere(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }

  return {}
}

function buildForwardHeaders(req: PayloadRequest): HeadersInit {
  const headers: Record<string, string> = {}
  const cookie = req.headers.get('cookie')
  if (cookie) {
    headers.cookie = cookie
  }

  return headers
}
