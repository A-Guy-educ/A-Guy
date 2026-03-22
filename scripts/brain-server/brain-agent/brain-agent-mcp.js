#!/usr/bin/env node
/**
 * Brain Agent - MCP Server with Claude + Context+
 *
 * Exposes:
 *   - brain_ask: Claude Opus 4.6 powered queries
 *   - neuron_*: Direct Context+ tools (prefixed for OpenCode compatibility)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http')
const https = require('https')

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const CONTEXTPLUS_URL = process.env.BRAIN_CONTEXTPLUS_URL || 'http://127.0.0.1:4097'
const PORT = parseInt(process.env.BRAIN_PORT || '4099', 10)
const MODEL = process.env.BRAIN_MODEL || 'claude-opus-4-6'
const CLAUDE_TIMEOUT_MS = parseInt(process.env.BRAIN_CLAUDE_TIMEOUT_MS || '60000', 10) // Default 60s
const CONTEXTPLUS_TIMEOUT_MS = parseInt(process.env.BRAIN_CONTEXTPLUS_TIMEOUT_MS || '30000', 10) // Default 30s

// OB1 Integration (optional - for user context)
const OB1_ENABLED = process.env.BRAIN_OB1_ENABLED === 'true'
const OB1_SUPABASE_URL = process.env.BRAIN_OB1_SUPABASE_URL || ''
const OB1_SUPABASE_KEY = process.env.BRAIN_OB1_SUPABASE_KEY || '' // anon or service role key
const OB1_MATCH_THRESHOLD = parseFloat(process.env.BRAIN_OB1_MATCH_THRESHOLD || '0.7')
const OB1_MATCH_COUNT = parseInt(process.env.BRAIN_OB1_MATCH_COUNT || '5')

// OpenRouter for embeddings (used with OB1)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY environment variable is required')
  process.exit(1)
}

// =============================================================================
// MCP Protocol Helpers
// =============================================================================

function parseMcpRequest(body) {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function mcpResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id: id,
    result: result,
  }
}

function mcpError(id, code, message) {
  return {
    jsonrpc: '2.0',
    id: id,
    error: { code: code, message: message },
  }
}

// =============================================================================
// Context+ MCP Client
// =============================================================================

// Exclude semantic search tools - they have issues with large codebases (timeout/hang)
// These can be re-enabled if/when Context+ is fixed
const EXCLUDED_TOOLS = ['semantic_code_search', 'semantic_identifier_search', 'semantic_navigate']

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

function callContextPlusToolWithRetry(toolName, args, retryCount) {
  if (retryCount === undefined) {
    retryCount = 0
  }

  return callContextPlusTool(toolName, args).catch(function (err) {
    // Check if it's a recoverable error and we have retries left
    const errorMessage = err.message || ''
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')
    const isConnectionRefused =
      errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')

    if ((isTimeout || isConnectionRefused) && retryCount < MAX_RETRIES) {
      console.log(
        '[brain] Retrying Context+ tool:',
        toolName,
        'attempt',
        retryCount + 1,
        'of',
        MAX_RETRIES,
      )
      return sleep(RETRY_DELAY_MS).then(function () {
        return callContextPlusToolWithRetry(toolName, args, retryCount + 1)
      })
    }

    // For context length errors, return a helpful message instead of failing completely
    if (
      errorMessage.includes('context length') ||
      errorMessage.includes('maximum context') ||
      errorMessage.includes('input length') ||
      errorMessage.includes('too large')
    ) {
      console.error(
        '[brain] Context+ tool hit context limit:',
        toolName,
        '- retry with smaller scope',
      )
      throw new Error(
        'Tool "' +
          toolName +
          '" hit context limit. Try a more specific query or target a smaller file/directory.',
      )
    }

    throw err
  })
}

function callContextPlusToolWithRetry(toolName, args, retryCount) {
  if (retryCount === undefined) {
    retryCount = 0
  }

  return callContextPlusTool(toolName, args).catch(function (err) {
    // Check if it's a recoverable error and we have retries left
    const errorMessage = err.message || ''
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')
    const isConnectionRefused =
      errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')

    if ((isTimeout || isConnectionRefused) && retryCount < MAX_RETRIES) {
      console.log(
        '[brain] Retrying Context+ tool:',
        toolName,
        'attempt',
        retryCount + 1,
        'of',
        MAX_RETRIES,
      )
      return sleep(RETRY_DELAY_MS).then(function () {
        return callContextPlusToolWithRetry(toolName, args, retryCount + 1)
      })
    }

    // For context length errors, return a special marker that brain_ask can handle
    if (
      errorMessage.includes('context length') ||
      errorMessage.includes('maximum context') ||
      errorMessage.includes('input length') ||
      errorMessage.includes('too large')
    ) {
      console.error('[brain] Context+ tool hit context limit:', toolName)
      // Return a special string that indicates the tool failed but we should continue
      return (
        '__CONTEXT_LIMIT_EXCEEDED__:Tool "' +
        toolName +
        '" could not process this request due to file size. Try a more specific query or use get_file_skeleton for individual files.'
      )
    }

    throw err
  })
}

function callContextPlusToolWithRetry(toolName, args, retryCount) {
  if (retryCount === undefined) {
    retryCount = 0
  }

  return callContextPlusTool(toolName, args).catch(function (err) {
    // Check if it's a recoverable error and we have retries left
    const errorMessage = err.message || ''
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')
    const isConnectionRefused =
      errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')

    if ((isTimeout || isConnectionRefused) && retryCount < MAX_RETRIES) {
      console.log(
        '[brain] Retrying Context+ tool:',
        toolName,
        'attempt',
        retryCount + 1,
        'of',
        MAX_RETRIES,
      )
      return sleep(RETRY_DELAY_MS).then(function () {
        return callContextPlusToolWithRetry(toolName, args, retryCount + 1)
      })
    }

    // Check for context length exceeded error
    if (
      errorMessage.includes('context length') ||
      errorMessage.includes('maximum context') ||
      errorMessage.includes('input length')
    ) {
      console.error('[brain] Context+ tool failed due to context limit:', toolName)
      throw new Error(
        'Tool "' +
          toolName +
          '" failed: file too large for embedding model context window. Try a more specific query or use get_file_skeleton instead.',
      )
    }

    throw err
  })
}

function callContextPlusTool(toolName, args) {
  return new Promise(function (resolve, reject) {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args || {} },
    })

    const url = new URL(CONTEXTPLUS_URL)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: CONTEXTPLUS_TIMEOUT_MS,
      },
      function (res) {
        let data = ''
        res.on('data', function (chunk) {
          data += chunk
        })
        res.on('end', function () {
          const lines = data.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.result && parsed.result.content) {
                  resolve(parsed.result.content)
                  return
                }
                if (parsed.result) {
                  resolve(parsed.result)
                  return
                }
              } catch (_e) {
                /* continue */
              }
            }
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.result) {
              resolve(parsed.result)
              return
            }
          } catch (_e) {
            /* continue */
          }
          resolve(data)
        })
      },
    )

    req.on('timeout', function () {
      console.error(
        '[brain] Context+ timeout after',
        CONTEXTPLUS_TIMEOUT_MS,
        'ms for tool:',
        toolName,
      )
      req.destroy()
      reject(
        new Error('Context+ timeout after ' + CONTEXTPLUS_TIMEOUT_MS + 'ms for tool: ' + toolName),
      )
    })

    req.on('error', function (err) {
      console.error('[brain] Context+ error:', err.message)
      reject(err)
    })

    req.write(body)
    req.end()
  })
}

function listContextPlusTools() {
  return new Promise(function (resolve, reject) {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {},
    })

    const url = new URL(CONTEXTPLUS_URL)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      function (res) {
        let data = ''
        res.on('data', function (chunk) {
          data += chunk
        })
        res.on('end', function () {
          const lines = data.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.result && parsed.result.tools) {
                  resolve(parsed.result.tools)
                  return
                }
              } catch (_e) {
                /* continue */
              }
            }
          }
          resolve([])
        })
      },
    )

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// =============================================================================
// OB1 Context Integration (reads from OB1's Supabase)
// =============================================================================

/**
 * Fetch relevant context from OB1's Supabase database.
 * This queries the match_thoughts function to get user memories related to the query.
 */
async function fetchOB1Context(query, limit) {
  if (!OB1_ENABLED || !OB1_SUPABASE_URL || !OB1_SUPABASE_KEY) {
    return null
  }

  console.log('[brain] Fetching OB1 context for:', query.substring(0, 50))

  try {
    // First, get embeddings for the query using OpenRouter
    const queryEmbedding = await getOpenRouterEmbedding(query)
    if (!queryEmbedding) {
      console.log('[brain] Could not get embedding for query')
      return null
    }

    // Call Supabase match_thoughts function
    const result = await callSupabaseMatchThoughts(queryEmbedding, limit || OB1_MATCH_COUNT)

    if (result && result.length > 0) {
      console.log('[brain] Found', result.length, 'OB1 context entries')
      return result
    }

    return null
  } catch (err) {
    console.error('[brain] OB1 context fetch error:', err.message)
    return null
  }
}

/**
 * Get embedding for query text using OpenRouter
 * Returns array of floats (1536 dimensions for ada-002)
 */
async function getOpenRouterEmbedding(text) {
  if (!OPENROUTER_API_KEY) {
    console.log('[brain] OpenRouter API key not configured')
    return null
  }

  return new Promise(function (resolve, _reject) {
    const body = JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    })

    const req = https.request(
      {
        hostname: 'openrouter.ai',
        port: 443,
        path: '/api/v1/embeddings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + OPENROUTER_API_KEY,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      function (res) {
        let data = ''
        res.on('data', function (chunk) {
          data += chunk
        })
        res.on('end', function () {
          if (res.statusCode >= 400) {
            console.error('[brain] OpenRouter error:', res.statusCode, data.substring(0, 200))
            resolve(null)
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.data && parsed.data[0] && parsed.data[0].embedding) {
              resolve(parsed.data[0].embedding)
            } else {
              console.error('[brain] OpenRouter unexpected response:', data.substring(0, 200))
              resolve(null)
            }
          } catch (e) {
            console.error('[brain] OpenRouter parse error:', e.message)
            resolve(null)
          }
        })
      },
    )

    req.on('error', function (err) {
      console.error('[brain] OpenRouter request error:', err.message)
      resolve(null)
    })

    req.setTimeout(30000, function () {
      req.destroy()
      console.error('[brain] OpenRouter timeout')
      resolve(null)
    })

    req.write(body)
    req.end()
  })
}

/**
 * Call Supabase match_thoughts function directly via REST API
 */
async function callSupabaseMatchThoughts(embedding, limit) {
  return new Promise(function (resolve, _reject) {
    const body = JSON.stringify({
      query_embedding: embedding,
      match_threshold: OB1_MATCH_THRESHOLD,
      match_count: limit || OB1_MATCH_COUNT,
      filter: {},
    })

    const url = new URL(OB1_SUPABASE_URL)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/rest/v1/rpc/match_thoughts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(body),
          apikey: OB1_SUPABASE_KEY,
          Authorization: 'Bearer ' + OB1_SUPABASE_KEY,
        },
      },
      function (res) {
        let data = ''
        res.on('data', function (chunk) {
          data += chunk
        })
        res.on('end', function () {
          if (res.statusCode >= 400) {
            console.error('[brain] Supabase error:', res.statusCode, data.substring(0, 200))
            resolve([])
            return
          }
          try {
            const parsed = JSON.parse(data)
            resolve(parsed || [])
          } catch (e) {
            console.error('[brain] Failed to parse Supabase response:', e.message)
            resolve([])
          }
        })
      },
    )

    req.on('error', function (err) {
      console.error('[brain] Supabase request error:', err.message)
      resolve([])
    })

    req.write(body)
    req.end()
  })
}

/**
 * Format OB1 context for inclusion in prompt
 */
function formatOB1Context(ob1Results) {
  if (!ob1Results || ob1Results.length === 0) {
    return ''
  }

  const lines = ['\n\n=== USER CONTEXT FROM OB1 BRAIN ===']
  for (let i = 0; i < ob1Results.length; i++) {
    const thought = ob1Results[i]
    lines.push('')
    lines.push('[' + (i + 1) + '] ' + thought.content)
    if (thought.metadata) {
      const meta =
        typeof thought.metadata === 'string' ? JSON.parse(thought.metadata) : thought.metadata
      if (meta.topics && meta.topics.length > 0) {
        lines.push('    Topics: ' + meta.topics.join(', '))
      }
      if (meta.type) {
        lines.push('    Type: ' + meta.type)
      }
    }
  }
  lines.push('========================================\n')

  return lines.join('\n')
}

/**
 * Insert a thought into OB1 Supabase with embedding
 */
async function insertThought(content) {
  if (!OB1_ENABLED || !OB1_SUPABASE_URL || !OB1_SUPABASE_KEY) {
    console.log('[brain] OB1 not configured for insert:', {
      enabled: OB1_ENABLED,
      url: OB1_SUPABASE_URL ? 'set' : 'missing',
      key: OB1_SUPABASE_KEY ? 'set' : 'missing',
    })
    return { success: false, error: 'OB1 not configured' }
  }

  // Get embedding from OpenRouter
  console.log('[brain] Getting embedding for thought...')
  const embedding = await getOpenRouterEmbedding(content)
  if (!embedding) {
    console.log('[brain] No embedding available, storing without it')
    // Store without embedding - semantic search won't work but basic storage works
  } else {
    console.log('[brain] Got embedding, length:', embedding.length)
  }

  return new Promise(function (resolve) {
    const body = JSON.stringify({
      content: content,
      embedding: embedding, // Will be null if OpenRouter failed
      metadata: {},
    })

    const url = new URL(OB1_SUPABASE_URL)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/rest/v1/thoughts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          'Content-Length': Buffer.byteLength(body),
          apikey: OB1_SUPABASE_KEY,
          Authorization: 'Bearer ' + OB1_SUPABASE_KEY,
        },
      },
      function (res) {
        let data = ''
        res.on('data', function (chunk) {
          data += chunk
        })
        res.on('end', function () {
          if (res.statusCode >= 400) {
            console.error('[brain] Insert thought error:', res.statusCode, data.substring(0, 200))
            resolve({ success: false, error: 'Insert failed: ' + res.statusCode })
            return
          }
          try {
            const parsed = JSON.parse(data)
            console.log('[brain] Thought saved:', parsed.id || 'ok')
            resolve({ success: true, id: parsed.id })
          } catch (e) {
            // 201 with no body is still success
            if (res.statusCode === 201) {
              resolve({ success: true })
            } else {
              console.error('[brain] Failed to parse insert response:', e.message)
              resolve({ success: false, error: e.message })
            }
          }
        })
      },
    )

    req.on('error', function (err) {
      console.error('[brain] Insert thought error:', err.message)
      resolve({ success: false, error: err.message })
    })

    req.write(body)
    req.end()
  })
}

// =============================================================================
// Claude API
// =============================================================================

const SYSTEM_PROMPT =
  'You are Brain - an expert code analyst assistant with access to Context+ tools.\n\nYou have access to these Context+ tools for code analysis:\n- get_context_tree: Get project structure with file headers, function names, classes, enums and line ranges\n- semantic_code_search: Search codebase by MEANING using embeddings (semantic similarity)\n- get_blast_radius: Find all files/lines where a symbol is imported or used\n- get_file_skeleton: Get function signatures and type definitions without reading full body\n- semantic_identifier_search: Find functions/classes by natural language intent\n- semantic_navigate: Browse codebase by meaning clusters (Obsidian-style feature hubs)\n- search_memory_graph: Search knowledge graph for related concepts\n- upsert_memory_node: Add concept/file/symbol/note to knowledge graph\n- create_relation: Create typed edges between knowledge graph nodes\n\nWhen answering questions, consider any USER CONTEXT from OB1 brain that precedes the question. This context contains user memories and notes that may be relevant to the code you are analyzing.\n\nUse tools to gather information. Be thorough. Provide clear, actionable insights.'

function claudeWithTools(messages, tools) {
  return new Promise(function (resolve, reject) {
    const body = {
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages,
      tools: tools,
    }

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
        timeout: CLAUDE_TIMEOUT_MS,
      },
      function (res) {
        let response = ''
        res.on('data', function (chunk) {
          response += chunk
        })
        res.on('end', function () {
          try {
            resolve(JSON.parse(response))
          } catch (_e) {
            resolve({ error: { message: response } })
          }
        })
      },
    )

    req.on('timeout', function () {
      console.error('[brain] Claude API timeout after', CLAUDE_TIMEOUT_MS, 'ms')
      req.destroy()
      reject(new Error('Claude API timeout after ' + CLAUDE_TIMEOUT_MS + 'ms'))
    })

    req.on('error', function (err) {
      console.error('[brain] Claude API error:', err.message)
      reject(err)
    })

    req.write(data)
    req.end()
  })
}

// =============================================================================
// Tool Definitions
// =============================================================================

const BRAIN_TOOLS = [
  {
    name: 'brain_ask',
    description:
      'Ask Brain a question about the codebase. Brain uses Claude Opus 4.6 to understand the question and Context+ tools to analyze the code.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask about the codebase',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'brain_capture',
    description:
      'Save a thought or note to OB1 memory. Use this to remember context, goals, or important information for future sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'The thought or note to save to memory',
        },
      },
      required: ['thought'],
    },
  },
]

// =============================================================================
// Context+ Tools (fetched and prefixed at startup)
// =============================================================================

let contextPlusTools = []

async function loadContextPlusTools() {
  try {
    contextPlusTools = await listContextPlusTools()
    console.log('[brain] Loaded ' + contextPlusTools.length + ' Context+ tools')
  } catch (err) {
    console.error('[brain] Failed to load Context+ tools:', err.message)
    contextPlusTools = []
  }
}

function getNeuronTools() {
  return contextPlusTools.map(function (tool) {
    return {
      name: 'neuron_' + tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
    }
  })
}

function getAllTools() {
  return BRAIN_TOOLS.concat(getNeuronTools())
}

// =============================================================================
// Query Processing
// =============================================================================

async function processBrainAsk(question) {
  console.log('[brain] Processing question:', question.substring(0, 100))

  // Fetch OB1 context if enabled
  let ob1Context = ''
  if (OB1_ENABLED) {
    try {
      const ob1Results = await fetchOB1Context(question, OB1_MATCH_COUNT)
      if (ob1Results) {
        ob1Context = formatOB1Context(ob1Results)
        console.log('[brain] OB1 context fetched:', ob1Results.length, 'entries')
      }
    } catch (err) {
      console.error('[brain] Failed to fetch OB1 context:', err.message)
    }
  }

  const claudeTools = contextPlusTools.map(function (tool) {
    return {
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema || { type: 'object', properties: {} },
    }
  })

  // Prepend OB1 context to question if available
  const fullQuestion = ob1Context + question
  const messages = [{ role: 'user', content: fullQuestion }]

  console.log(
    '[brain] Calling Claude with',
    messages.length,
    'messages',
    ob1Context ? '(+ OB1 context)' : '',
  )
  const response = await claudeWithTools(messages, claudeTools)
  console.log('[brain] Claude response received, content blocks:', response.content?.length)

  if (response.error) {
    throw new Error(response.error.message || JSON.stringify(response.error))
  }

  let finalText = ''

  for (let i = 0; i < response.content.length; i++) {
    const content = response.content[i]
    if (content.type === 'text') {
      finalText += content.text
    } else if (content.type === 'tool_use') {
      const toolName = content.name
      const toolArgs = content.input || {}

      console.log('[brain] Claude called tool:', toolName)

      // Skip tools that are known to have issues
      if (EXCLUDED_TOOLS.includes(toolName)) {
        console.log('[brain] Skipping excluded tool:', toolName)
        finalText +=
          '\n\n[Tool "' +
          toolName +
          '" is temporarily disabled due to performance issues. Try using get_blast_radius or get_file_skeleton instead.]'
        continue
      }

      try {
        console.log(
          '[brain] Calling Context+ tool:',
          toolName,
          'with timeout:',
          CONTEXTPLUS_TIMEOUT_MS + 'ms',
        )
        const toolResult = await callContextPlusToolWithRetry(toolName, toolArgs)
        console.log(
          '[brain] Context+ tool result received, length:',
          JSON.stringify(toolResult).length,
        )

        messages.push({ role: 'assistant', content: [content] })

        const resultContent =
          typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: content.id,
              content: resultContent.substring(0, 8000),
            },
          ],
        })

        console.log('[brain] Calling Claude for follow-up synthesis, messages:', messages.length)
        const followUp = await claudeWithTools(messages, claudeTools)
        console.log('[brain] Follow-up synthesis complete')

        for (let j = 0; j < followUp.content.length; j++) {
          const fc = followUp.content[j]
          if (fc.type === 'text') {
            finalText += fc.text
          }
        }
      } catch (err) {
        console.error('[brain] Tool call failed:', err.message)
        finalText += '\n\n[Tool error: ' + err.message + ']'
      }
    }
  }

  return finalText || 'No response generated.'
}

// =============================================================================
// MCP Server
// =============================================================================

const server = http.createServer(function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = new URL(req.url, 'http://localhost:' + PORT)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'brain-agent',
        model: MODEL,
        contextplus_tools: contextPlusTools.length,
      }),
    )
    return
  }

  if (req.method === 'POST' && url.pathname === '/mcp') {
    let body = ''
    req.on('data', function (chunk) {
      body += chunk
    })
    req.on('end', async function () {
      const mcpReq = parseMcpRequest(body)

      if (!mcpReq) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(mcpError(null, -32700, 'Parse error')))
        return
      }

      const id = mcpReq.id
      const method = mcpReq.method
      const params = mcpReq.params || {}

      try {
        switch (method) {
          case 'initialize': {
            const result = {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'brain-agent', version: '1.0.0' },
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpResponse(id, result)))
            break
          }

          case 'tools/list': {
            const result = { tools: getAllTools() }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpResponse(id, result)))
            break
          }

          case 'tools/call': {
            const name = params.name
            const args = params.arguments || {}

            if (name === 'brain_ask') {
              const answer = await processBrainAsk(args.question || '')
              const result = {
                content: [
                  {
                    type: 'text',
                    text: answer,
                  },
                ],
              }
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(mcpResponse(id, result)))
            } else if (name === 'brain_capture') {
              const result = await insertThought(args.thought || '')
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify(
                  mcpResponse(id, {
                    content: [
                      {
                        type: 'text',
                        text: result.success
                          ? 'Thought saved to memory.'
                          : 'Failed to save: ' + result.error,
                      },
                    ],
                  }),
                ),
              )
            } else if (name.startsWith('neuron_')) {
              // Forward to Context+ (strip neuron_ prefix)
              const contextPlusToolName = name.substring(7)
              const result = await callContextPlusTool(contextPlusToolName, args)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify(
                  mcpResponse(id, {
                    content: [
                      {
                        type: 'text',
                        text: typeof result === 'string' ? result : JSON.stringify(result),
                      },
                    ],
                  }),
                ),
              )
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(mcpError(id, -32602, 'Unknown tool: ' + name)))
            }
            break
          }

          case 'ping': {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpResponse(id, null)))
            break
          }

          default: {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpError(id, -32601, 'Method not found: ' + method)))
          }
        }
      } catch (err) {
        console.error('[brain] MCP error:', err.message)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(mcpError(id, -32603, err.message)))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

// =============================================================================
// Startup
// =============================================================================

async function main() {
  console.log('[brain] Starting Brain Agent...')
  console.log('[brain] Model:', MODEL)
  console.log('[brain] Context+:', CONTEXTPLUS_URL)
  console.log('[brain] Claude timeout:', CLAUDE_TIMEOUT_MS + 'ms')
  console.log('[brain] Context+ timeout:', CONTEXTPLUS_TIMEOUT_MS + 'ms')
  console.log(
    '[brain] OB1 Integration:',
    OB1_ENABLED
      ? 'ENABLED (Supabase: ' + OB1_SUPABASE_URL + ')'
      : 'disabled (set OB1_ENABLED=true to enable)',
  )

  // Load Context+ tools
  await loadContextPlusTools()

  server.listen(PORT, '0.0.0.0', function () {
    console.log('[brain] Brain Agent listening on port ' + PORT)
    console.log('[brain] Tools: brain_ask + ' + contextPlusTools.length + ' neuron_* tools')
  })
}

server.on('error', function (err) {
  console.error('[brain] Server error:', err)
  process.exit(1)
})

main()
