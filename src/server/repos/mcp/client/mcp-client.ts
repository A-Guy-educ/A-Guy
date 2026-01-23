import { logger } from '@/infra/utils/logger'
import { getServerSideURL } from '@/infra/utils/getURL'
import type { MCPJsonRpcResponse, MCPListToolsResult, MCPTool, MCPToolResult } from './types'

const DEFAULT_MCP_PATH = '/api/mcp'
const MCP_PROTOCOL_VERSION = '2025-11-25'

export class MCPClient {
  private baseUrl: string
  private initialized = false
  private tools: MCPTool[] = []

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async listTools(headers?: HeadersInit): Promise<MCPTool[]> {
    if (!this.initialized) {
      await this.initialize(headers)
    }

    if (this.tools.length === 0) {
      const response = await this.request<MCPListToolsResult>('tools/list', {}, headers)
      this.tools = response.tools || []
    }

    return this.tools
  }

  async callTool(name: string, args: Record<string, unknown>, headers?: HeadersInit) {
    if (!this.initialized) {
      await this.initialize(headers)
    }

    return this.request<MCPToolResult>('tools/call', { name, arguments: args }, headers)
  }

  private async initialize(headers?: HeadersInit) {
    await this.request(
      'initialize',
      {
        protocolVersion: MCP_PROTOCOL_VERSION,
        clientInfo: {
          name: 'admin-chat-backend',
          version: '1.0.0',
        },
        capabilities: {},
      },
      headers,
    )
    this.initialized = true
  }

  private async request<T>(
    method: string,
    params: Record<string, unknown>,
    headers?: HeadersInit,
  ): Promise<T> {
    const id = crypto.randomUUID()
    const endpoint = new URL(DEFAULT_MCP_PATH, this.baseUrl)

    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        ...(headers || {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error({ status: response.status, body: text }, '[MCPClient] MCP request failed')
      throw new Error(`MCP request failed with status ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    let json: MCPJsonRpcResponse<T>

    if (contentType.includes('text/event-stream')) {
      const text = await response.text()
      json = parseEventStream(text) as MCPJsonRpcResponse<T>
    } else {
      json = (await response.json()) as MCPJsonRpcResponse<T>
    }
    if (json.error) {
      throw new Error(json.error.message || 'MCP error response')
    }

    if (!json.result) {
      throw new Error('MCP response missing result')
    }

    return json.result
  }
}

function parseEventStream(body: string): MCPJsonRpcResponse<unknown> {
  const lines = body.split(/\r?\n/)
  const dataLines = lines.filter((line) => line.startsWith('data:'))
  const lastDataLine = dataLines[dataLines.length - 1]
  if (!lastDataLine) {
    throw new Error('No data found in event-stream response')
  }

  const jsonText = lastDataLine.replace(/^data:\s*/, '')
  return JSON.parse(jsonText) as MCPJsonRpcResponse<unknown>
}

let mcpClient: MCPClient | null = null

export function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient(getServerSideURL())
  }

  return mcpClient
}
