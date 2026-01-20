export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface MCPToolCall {
  name: string
  args: Record<string, unknown>
}

export interface MCPToolResult {
  content?: Array<{
    type: string
    text?: string
  }>
  [key: string]: unknown
}

export interface MCPListToolsResult {
  tools: MCPTool[]
}

export interface MCPJsonRpcResponse<T> {
  jsonrpc: '2.0'
  id: string
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}
