import 'dotenv/config'
import { writeFileSync } from 'fs'
import path from 'path'

type JsonRpcResponse<T> = {
  jsonrpc: '2.0'
  id: string
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

const MCP_PROTOCOL_VERSION = '2025-11-25'

async function jsonRpcRequest<T>(
  url: string,
  method: string,
  params: Record<string, unknown>,
  apiKey: string,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`MCP request failed (${response.status}): ${text}`)
  }

  const contentType = response.headers.get('content-type') || ''
  let json: JsonRpcResponse<T>

  if (contentType.includes('text/event-stream')) {
    const bodyText = await response.text()
    json = parseEventStream(bodyText) as JsonRpcResponse<T>
  } else {
    json = (await response.json()) as JsonRpcResponse<T>
  }
  if (json.error) {
    throw new Error(`MCP error: ${json.error.message}`)
  }

  if (!json.result) {
    throw new Error('MCP response missing result')
  }

  return json.result
}

function parseEventStream(body: string): JsonRpcResponse<unknown> {
  const lines = body.split(/\r?\n/)
  const dataLines = lines.filter((line) => line.startsWith('data:'))
  const lastDataLine = dataLines[dataLines.length - 1]
  if (!lastDataLine) {
    throw new Error('No data found in event-stream response')
  }

  const jsonText = lastDataLine.replace(/^data:\s*/, '')
  return JSON.parse(jsonText) as JsonRpcResponse<unknown>
}

async function discoverTools() {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const apiKey = process.env.MCP_API_KEY
  if (!apiKey) {
    throw new Error('MCP_API_KEY is required to run discovery')
  }

  const endpoint = new URL('/api/mcp', baseUrl).toString()

  await jsonRpcRequest(endpoint, 'initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    clientInfo: { name: 'admin-chat-mcp-discovery', version: '1.0.0' },
    capabilities: {},
  }, apiKey)

  const tools = await jsonRpcRequest(endpoint, 'tools/list', {}, apiKey)

  const output = {
    capturedAt: new Date().toISOString(),
    endpoint,
    tools,
  }

  const outputPath = path.resolve(
    process.cwd(),
    'docs',
    'features',
    'admin-chat-mcp',
    'discovered-tools.json',
  )

  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`Wrote discovery output to ${outputPath}`)
}

discoverTools().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error))
  console.error(err.message)
  process.exitCode = 1
})
