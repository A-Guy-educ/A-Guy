/**
 * @fileType utility
 * @domain brain
 * @pattern mcp-proxy, auth
 * @ai-summary Local MCP proxy that filters tools and injects auth for brain server
 */

import http from 'http'
import { URL } from 'url'

// Allowed tool names (without neuron_ prefix)
const ALLOWED_TOOLS = [
  'get_context_tree',
  'semantic_identifier_search',
  'get_file_skeleton',
  'semantic_code_search',
  'get_blast_radius',
  'run_static_analysis',
  'propose_commit',
  'list_restore_points',
  'undo_change',
  'semantic_navigate',
  'get_feature_hub',
  'upsert_memory_node',
  'create_relation',
  'search_memory_graph',
  'prune_stale_links',
  'add_interlinked_context',
  'retrieve_with_traversal',
]

const BRAIN_API_TOKEN = process.env.BRAIN_API_TOKEN
const BRAIN_SERVER_URL = process.env.BRAIN_SERVER_URL || 'http://184.174.39.227:4098'
const LOCAL_PORT = parseInt(process.env.LOCAL_PORT || '4099', 10)

if (!BRAIN_API_TOKEN) {
  console.error('BRAIN_API_TOKEN environment variable is required')
  process.exit(1)
}

// Normalize tool name - brain tools may come with or without neuron_ prefix
function normalizeToolName(toolName: string): string {
  return toolName.replace(/^neuron_/, '')
}

function isToolAllowed(toolName: string): boolean {
  const normalized = normalizeToolName(toolName)
  return ALLOWED_TOOLS.includes(normalized)
}

// Get auth header for brain server
function getAuthHeader(): Record<string, string> {
  const credentials = Buffer.from(`brain:${BRAIN_API_TOKEN}`).toString('base64')
  return {
    Authorization: `Basic ${credentials}`,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  }
}

// Proxy SSE connection to brain server
function proxySSE(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(BRAIN_SERVER_URL)

  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: '/mcp',
    method: 'GET',
    headers: {
      ...getAuthHeader(),
      Accept: 'text/event-stream',
      'MCP-Session-ID': req.headers['mcp-session-id'] || 'default',
    },
  }

  const proxyReq = http.request(options, (proxyRes) => {
    // Forward SSE headers
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Forward status
    res.writeHead(proxyRes.statusCode || 200)

    // Stream events to client
    proxyRes.on('data', (chunk) => {
      res.write(chunk)
    })

    proxyRes.on('end', () => {
      res.end()
    })
  })

  proxyReq.on('error', (err) => {
    console.error('SSE proxy error:', err)
    res.writeHead(500)
    res.end('Proxy error')
  })

  req.on('close', () => {
    proxyReq.destroy()
  })
}

// Proxy POST request to brain server
function proxyPost(
  body: Record<string, unknown>,
  sessionId: string,
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BRAIN_SERVER_URL)

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: '/mcp',
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
        'MCP-Session-ID': sessionId,
      },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        resolve({ status: res.statusCode || 500, data })
      })
    })

    req.on('error', reject)
    req.write(JSON.stringify(body))
    req.end()
  })
}

// Parse JSON body from request
function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${LOCAL_PORT}`)
  const sessionId = (req.headers['mcp-session-id'] as string) || 'default'

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Session-ID')
    res.writeHead(200)
    res.end()
    return
  }

  // Health endpoint
  if (url.pathname === '/health' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify({ status: 'ok', proxy: 'neuron-local' }))
    return
  }

  // MCP SSE endpoint (GET - for client initialization)
  if (url.pathname === '/mcp' && req.method === 'GET') {
    proxySSE(req, res)
    return
  }

  // MCP endpoint (POST - for tool calls)
  if (url.pathname === '/mcp' && req.method === 'POST') {
    try {
      const body = await parseBody(req)
      const method = body.method as string
      const params = body.params as Record<string, unknown> | undefined

      // Handle tools/call - filter to only allowed tools
      if (method === 'tools/call') {
        const toolName = (params?.name as string) || ''

        if (!isToolAllowed(toolName)) {
          res.setHeader('Content-Type', 'application/json')
          res.writeHead(403)
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32601,
                message: `Tool '${toolName}' is not allowed. Only brain tools are permitted.`,
              },
              id: null,
            }),
          )
          return
        }

        // Normalize tool name (remove neuron_ prefix)
        const normalizedParams = {
          ...params,
          name: normalizeToolName(toolName),
        }

        const result = await proxyPost({ ...body, params: normalizedParams }, sessionId)

        res.setHeader('Content-Type', 'application/json')
        res.writeHead(result.status)
        res.end(result.data)
        return
      }

      // For all other methods, proxy directly
      const result = await proxyPost(body, sessionId)

      res.setHeader('Content-Type', 'application/json')
      res.writeHead(result.status)
      res.end(result.data)
    } catch (error) {
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(500)
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        }),
      )
    }
    return
  }

  // Not found
  res.writeHead(404)
  res.end('Not found')
})

server.listen(LOCAL_PORT, () => {
  console.log(`Neuron local proxy listening on port ${LOCAL_PORT}`)
  console.log(`Brain server: ${BRAIN_SERVER_URL}`)
  console.log(`Allowed tools: ${ALLOWED_TOOLS.length}`)
})

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...')
  server.close(() => process.exit(0))
})
