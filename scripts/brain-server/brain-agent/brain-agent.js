#!/usr/bin/env node
/**
 * Brain Agent - Claude Gateway with Context+ Tools
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http')
const https = require('https')

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BRAIN_SERVER_URL = process.env.BRAIN_SERVER_URL || 'http://127.0.0.1:4097'
const PORT = parseInt(process.env.PORT || '4099', 10)
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6'

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required')
  process.exit(1)
}

const TOOLS = [
  {
    name: 'get_context_tree',
    description: 'Get project structure with file headers, function names, classes, enums',
    input_schema: {
      type: 'object',
      properties: {
        target_path: { type: 'string' },
        depth_limit: { type: 'number' },
        max_tokens: { type: 'number' },
      },
    },
  },
  {
    name: 'semantic_code_search',
    description: 'Search codebase by MEANING using embeddings',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'number' },
      },
    },
  },
  {
    name: 'get_blast_radius',
    description: 'Find all files where a symbol is used',
    input_schema: {
      type: 'object',
      properties: {
        symbol_name: { type: 'string' },
        file_context: { type: 'string' },
      },
    },
  },
  {
    name: 'get_file_skeleton',
    description: 'Get function signatures without reading full body',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
      },
    },
  },
  {
    name: 'semantic_identifier_search',
    description: 'Find functions/classes by semantic intent',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'number' },
      },
    },
  },
  {
    name: 'run_static_analysis',
    description: 'Run linter/compiler checks',
    input_schema: {
      type: 'object',
      properties: {
        target_path: { type: 'string' },
      },
    },
  },
  {
    name: 'search_memory_graph',
    description: 'Search knowledge graph',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_depth: { type: 'number' },
      },
    },
  },
]

const SYSTEM_PROMPT = `You are Brain - an expert code analyst. Use tools when helpful. Be concise.`

// Simple fetch wrapper for Anthropic
function anthropicFetch(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let response = ''
        res.on('data', (chunk) => (response += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(response))
          } catch {
            resolve({ error: response })
          }
        })
      },
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// Call Context+
function callContextPlus(toolName, args) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args || {} },
    })

    const url = new URL(BRAIN_SERVER_URL)
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          // Parse SSE
          const lines = data.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.result?.content) {
                  resolve(parsed.result.content)
                  return
                }
              } catch {}
            }
          }
          resolve(data)
        })
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// Process query
async function processQuery(query) {
  let messages = [{ role: 'user', content: query }]

  const response = await anthropicFetch({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
    tools: TOOLS,
  })

  if (response.error) {
    throw new Error(response.error.message)
  }

  for (const content of response.content || []) {
    if (content.type === 'tool_use') {
      console.log('Tool call:', content.name)
      const toolResult = await callContextPlus(content.name, content.input)

      messages.push({ role: 'assistant', content: [content] })
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: content.id,
            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          },
        ],
      })

      const followUp = await anthropicFetch({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      })

      return followUp.content?.[0]?.text || JSON.stringify(followUp)
    }
  }

  return response.content?.[0]?.text || ''
}

// Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', model: MODEL }))
    return
  }

  if (url.pathname === '/query' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', async () => {
      try {
        const { query } = JSON.parse(body)
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'query is required' }))
          return
        }

        console.log('Query:', query.substring(0, 100))
        const result = await processQuery(query)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ result }))
      } catch (error) {
        console.error('Error:', error.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`Brain agent listening on port ${PORT}`)
  console.log(`Model: ${MODEL}`)
  console.log(`Context+: ${BRAIN_SERVER_URL}`)
})
