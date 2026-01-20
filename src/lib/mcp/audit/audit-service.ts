import type { PayloadRequest } from 'payload'

import { logger } from '@/utilities/logger'

interface MCPAuditLogParams {
  req: PayloadRequest
  adminUserId: string
  tenantId: string
  toolName: string
  args: unknown
  resultCount: number
  success: boolean
  durationMs: number
  requestId: string
}

export async function logMcpCall(params: MCPAuditLogParams): Promise<void> {
  const {
    req,
    adminUserId,
    tenantId,
    toolName,
    args,
    resultCount,
    success,
    durationMs,
    requestId,
  } = params

  try {
    const safeArgs = sanitizeJsonValue(args)

    await req.payload.create({
      collection: 'mcp-audit-logs',
      data: {
        adminUserId,
        tenantId,
        toolName,
        args: safeArgs,
        resultCount,
        success,
        durationMs,
        requestId,
        timestamp: new Date().toISOString(),
      },
      req,
      overrideAccess: true,
    })
  } catch (error) {
    logger.error({ err: error, requestId, toolName }, '[MCP] Failed to write audit log')
  }
}

function sanitizeJsonValue(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value)) as
      | string
      | number
      | boolean
      | null
      | unknown[]
      | { [key: string]: unknown }
  } catch {
    return null
  }
}
